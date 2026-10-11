import { execFile } from "node:child_process";
import { cpSync, existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { promisify } from "node:util";
import { createHash } from "node:crypto";

const run = promisify(execFile);

export const ROOT = resolve(import.meta.dirname, "..");
export const APP = join(ROOT, "app");

export type Edit =
  | { file: string; find: string; replace: string; all?: boolean }
  | { file: string; create: string }
  | { file: string; delete: true };

export type Case = {
  id: string;
  split: "dev" | "holdout" | "software";
  kind: "violation" | "safe" | "incomplete" | "trust";
  title: string;
  edits: Edit[];
  baseline_edits?: Edit[];
  labels?: Record<string, "violated" | "supported">;
  expect?: Expectation;
  args?: string[];
  visual?: { check: string; stale: boolean };
};

export type Expectation = {
  exit_code?: number;
  exit_nonzero?: boolean;
  checks?: Record<string, { verdict: string; reason_code?: string }>;
  check_present?: string[];
  unmapped_includes?: string[];
  change_kinds?: string[];
  evidence_includes?: Record<string, string>;
  severity?: Record<string, string>;
  min_probability?: number;
  endpoint_unchanged?: boolean;
};

export type CheckInfo = { id: string; contract: string; local: string; requirement: string };

// loadChecks reads the accepted contracts: every check's full ID and its
// requirement text with line breaks folded.
export function loadChecks(): Map<string, CheckInfo> {
  const dir = join(APP, ".sure", "contracts");
  const out = new Map<string, CheckInfo>();
  for (const f of readdirSync(dir).sort()) {
    const text = readFileSync(join(dir, f), "utf8");
    const contract = /^id: (\S+)$/m.exec(text)?.[1];
    if (!contract) throw new Error(`${f}: no contract id`);
    for (const section of text.split(/\n(?=## )/)) {
      const m = /^## (\S+) — [^\n]*\n([\s\S]*)$/.exec(section);
      if (!m) continue;
      const requirement = m[2].trim().replace(/\s+/g, " ");
      if (!/[.!?]$/.test(requirement)) throw new Error(`${f}: ${m[1]} was not read completely`);
      out.set(`${contract}/${m[1]}`, { id: `${contract}/${m[1]}`, contract, local: m[1], requirement });
    }
  }
  return out;
}

export function loadCases(filter?: (c: Case) => boolean): Case[] {
  const dir = join(ROOT, "cases");
  return readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .sort()
    .map((f) => JSON.parse(readFileSync(join(dir, f), "utf8")) as Case)
    .filter((c) => (filter ? filter(c) : true));
}

export function caseHash(c: Case): string {
  return createHash("sha256")
    .update(JSON.stringify({ edits: c.edits, baseline: c.baseline_edits ?? [] }))
    .digest("hex")
    .slice(0, 12);
}

const gitEnv = {
  ...process.env,
  GIT_CONFIG_GLOBAL: "/dev/null",
  GIT_CONFIG_NOSYSTEM: "1",
  GIT_AUTHOR_NAME: "eval",
  GIT_AUTHOR_EMAIL: "eval@example.com",
  GIT_COMMITTER_NAME: "eval",
  GIT_COMMITTER_EMAIL: "eval@example.com",
};

async function git(dir: string, ...args: string[]): Promise<string> {
  const { stdout } = await run("git", args, { cwd: dir, env: gitEnv });
  return stdout.trim();
}

export function applyEdits(dir: string, edits: Edit[]): void {
  for (const edit of edits) {
    const path = join(dir, edit.file);
    if ("delete" in edit) {
      rmSync(path);
      continue;
    }
    if ("create" in edit) {
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, edit.create);
      continue;
    }
    const text = readFileSync(path, "utf8");
    const count = text.split(edit.find).length - 1;
    if (count === 0 || (count > 1 && !edit.all)) {
      throw new Error(`${edit.file}: expected ${edit.all ? "at least one" : "exactly one"} match, found ${count}`);
    }
    writeFileSync(path, edit.all ? text.split(edit.find).join(edit.replace) : text.replace(edit.find, () => edit.replace));
  }
}

// materialize copies the fixture into a fresh repository outside this one:
// the baseline (with any reviewed baseline edits) is committed on main and the
// case's edits are committed on a candidate branch with an opaque message.
// Labels, titles and oracle results never enter it; the oracle files do, but
// Sure only reads src/.
export async function materialize(c: Case): Promise<string> {
  const dir = mkdtempSync(join(tmpdir(), "sure-eval-"));
  cpSync(APP, dir, { recursive: true });
  applyEdits(dir, c.baseline_edits ?? []);
  await git(dir, "init", "-q", "-b", "main");
  await git(dir, "add", "-A");
  await git(dir, "commit", "-q", "-m", "baseline");
  await git(dir, "checkout", "-q", "-b", "candidate");
  applyEdits(dir, c.edits);
  await git(dir, "add", "-A");
  await git(dir, "commit", "-q", "--allow-empty", "-m", "candidate");
  return dir;
}

export function cleanup(dir: string): void {
  if (dir.startsWith(tmpdir())) {
    rmSync(dir, { recursive: true, force: true });
  }
}

export function sureBin(): string {
  const bin = process.env.SURE_BIN ?? join(ROOT, "..", "sure", "sure");
  if (!existsSync(bin)) throw new Error(`Sure binary not found at ${bin}: build it (cd ../sure && make build) or set SURE_BIN`);
  return bin;
}

export type SureResult = { exitCode: number; json: any; stderr: string; ms: number };

export async function runSure(dir: string, args: string[], env: Record<string, string | undefined> = {}): Promise<SureResult> {
  const started = performance.now();
  try {
    const { stdout, stderr } = await run(sureBin(), ["--repo", dir, "--json", ...args], {
      env: { ...process.env, ...env },
      maxBuffer: 64 << 20,
    });
    return { exitCode: 0, json: JSON.parse(stdout), stderr, ms: performance.now() - started };
  } catch (err: any) {
    if (typeof err.code !== "number") throw err;
    let json: any = null;
    try {
      json = JSON.parse(err.stdout);
    } catch {
      // A crash without JSON is reported by the caller.
    }
    return { exitCode: err.code, json, stderr: err.stderr ?? "", ms: performance.now() - started };
  }
}

// writeVisualManifest records an artifact for a visual check. A current
// manifest uses the candidate's real source digest, read from a dry run.
export async function writeVisualManifest(dir: string, c: Case): Promise<void> {
  if (!c.visual) return;
  const plan = await runSure(dir, [...(c.args ?? []), "--dry-run"]);
  const digest: string = plan.json?.snapshot?.source_digest;
  if (!digest) throw new Error(`${c.id}: dry run returned no source digest`);
  const png = Buffer.from("89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c489", "hex");
  mkdirSync(join(dir, ".sure", "visual"), { recursive: true });
  writeFileSync(join(dir, ".sure", "visual", "home.png"), png);
  const manifest = {
    schema_version: "sure.visual-manifest/v1",
    entries: [
      {
        check: c.visual.check,
        scenario: "home",
        artifact: ".sure/visual/home.png",
        artifact_sha256: createHash("sha256").update(png).digest("hex"),
        source_digest: c.visual.stale ? "0".repeat(64) : digest,
        producer: { name: "eval-harness", version: "1" },
        viewport: { width: 390, height: 844 },
        locale: "en",
        theme: "light",
        text_size: "default",
      },
    ],
  };
  writeFileSync(join(dir, ".sure", "visual", "manifest.json"), JSON.stringify(manifest, null, 2));
}

export type OracleResult = { failing: Set<string>; baselineFailing: string[]; total: number; error?: string };

const CHECK_PREFIX = /^([A-Z][A-Z0-9]*-\d+)\b/;
const byLocal = new Map([...loadChecks().values()].map((c) => [c.local, c.id]));

// runOracle runs the independent Vitest expectations against a candidate and
// returns the check IDs whose behavior fails.
export async function runOracle(dir: string): Promise<OracleResult> {
  const out = join(dir, ".oracle.json");
  try {
    await run(join(ROOT, "node_modules", ".bin", "vitest"), ["run", "--config", join(ROOT, "vitest.config.ts"), "--reporter=json", `--outputFile=${out}`], {
      cwd: ROOT,
      env: { ...process.env, ORACLE_ROOT: dir },
    });
  } catch {
    // Failing tests exit non-zero; the report says which.
  }
  if (!existsSync(out)) return { failing: new Set(), baselineFailing: [], total: 0, error: "oracle produced no report" };
  const report = JSON.parse(readFileSync(out, "utf8"));
  const failing = new Set<string>();
  const baselineFailing: string[] = [];
  let total = 0;
  for (const file of report.testResults ?? []) {
    if (file.status === "failed" && (file.assertionResults ?? []).length === 0) {
      return { failing, baselineFailing, total, error: `${file.name}: ${file.message ?? "failed to load"}` };
    }
    for (const t of file.assertionResults ?? []) {
      total++;
      if (t.status === "passed") continue;
      const m = CHECK_PREFIX.exec(t.title);
      const id = m ? byLocal.get(m[1]) : undefined;
      if (id) failing.add(id);
      else baselineFailing.push(t.title);
    }
  }
  return { failing, baselineFailing, total };
}

export async function typecheck(dir: string): Promise<string | null> {
  try {
    await run(join(ROOT, "node_modules", ".bin", "tsc"), ["-p", join(dir, "tsconfig.json")], { cwd: dir });
    return null;
  } catch (err: any) {
    return String(err.stdout || err.stderr || err.message).trim().split("\n").slice(0, 3).join(" | ");
  }
}

// pool runs tasks with bounded concurrency, preserving input order.
export async function pool<T, R>(items: T[], limit: number, task: (item: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      results[i] = await task(items[i]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

export const color = process.stdout.isTTY && !process.env.NO_COLOR;
export const paint = (code: string, s: string) => (color ? `\x1b[${code}m${s}\x1b[0m` : s);
export const green = (s: string) => paint("32", s);
export const red = (s: string) => paint("31", s);
export const yellow = (s: string) => paint("33", s);
export const dim = (s: string) => paint("2", s);
