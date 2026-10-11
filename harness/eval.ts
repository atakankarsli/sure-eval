// Runs Sure on each case in an isolated copy, scores its verdicts against the
// frozen labels, and writes raw results under results/<timestamp>/.
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";
import {
  ROOT,
  caseHash,
  cleanup,
  dim,
  green,
  loadCases,
  materialize,
  pool,
  red,
  runOracle,
  runSure,
  writeVisualManifest,
  yellow,
  type Case,
} from "./lib.ts";

const { values } = parseArgs({
  options: {
    split: { type: "string", default: "dev" },
    case: { type: "string" },
    provider: { type: "string" },
    "no-cache": { type: "boolean", default: false },
    concurrency: { type: "string", default: "4" },
    oracle: { type: "boolean", default: false },
    json: { type: "boolean", default: false },
  },
});

const ids = values.case?.split(",").map((s) => s.trim());
const cases = loadCases((c) => (ids ? ids.includes(c.id) : values.split === "all" || c.split === values.split));
if (cases.length === 0) {
  console.error(`No cases match. Use --split dev|holdout|software|all or --case C001,C002.`);
  process.exit(2);
}

type CheckScore = { check: string; label: string; verdict: string; confidence: number | null; outcome: string };
type CaseResult = {
  id: string;
  split: string;
  kind: string;
  hash: string;
  exit: number;
  ms: number;
  confidence: number | null;
  checks: CheckScore[];
  assertions: { name: string; ok: boolean; detail?: string }[];
  oracle?: string[];
  error?: string;
};

function outcome(label: string, verdict: string): string {
  if (verdict === "missing" || verdict === "not_checked") return "not_selected";
  if (verdict === "error") return "error";
  if (verdict === "unknown") return "unknown";
  if (label === "violated") return verdict === "violated" ? "caught" : "unsafe_clear";
  return verdict === "supported" ? "cleared" : "false_alarm";
}

function assert(c: Case, json: any, exit: number): { name: string; ok: boolean; detail?: string }[] {
  const e = c.expect ?? {};
  const out: { name: string; ok: boolean; detail?: string }[] = [];
  const checks: Record<string, any> = Object.fromEntries((json?.checks ?? []).map((ch: any) => [ch.id, ch]));
  const kinds = new Set<string>((json?.contract_changes ?? []).map((ch: any) => (ch.field && ch.kind !== "config_invalid" ? `${ch.kind}:${ch.field}` : ch.kind)));
  if (e.exit_code !== undefined) out.push({ name: `exit ${e.exit_code}`, ok: exit === e.exit_code, detail: `got ${exit}` });
  if (e.exit_nonzero) out.push({ name: "exit non-zero", ok: exit !== 0, detail: `got ${exit}` });
  for (const [id, want] of Object.entries(e.checks ?? {})) {
    const got = checks[id];
    const ok = got && got.verdict === want.verdict && (!want.reason_code || got.reason_code === want.reason_code);
    out.push({ name: `${id} ${want.verdict}/${want.reason_code ?? ""}`, ok: !!ok, detail: got ? `${got.verdict}/${got.reason_code}` : "missing" });
  }
  for (const id of e.check_present ?? []) {
    const got = checks[id];
    out.push({ name: `${id} still evaluated`, ok: !!got && got.verdict !== "not_checked", detail: got?.verdict ?? "missing" });
  }
  for (const p of e.unmapped_includes ?? []) {
    out.push({ name: `unmapped ${p}`, ok: (json?.unmapped_changes ?? []).includes(p) });
  }
  for (const k of e.change_kinds ?? []) {
    out.push({ name: `change ${k}`, ok: kinds.has(k), detail: [...kinds].join(",") });
  }
  for (const [contract, path] of Object.entries(e.evidence_includes ?? {})) {
    const ce = (json?.contracts ?? []).find((x: any) => x.id === contract);
    out.push({ name: `${contract} read ${path}`, ok: !!ce?.files?.some((f: any) => f.path === path) });
  }
  for (const [id, sev] of Object.entries(e.severity ?? {})) {
    out.push({ name: `${id} severity ${sev}`, ok: checks[id]?.severity === sev, detail: checks[id]?.severity });
  }
  if (e.min_probability !== undefined) {
    out.push({ name: `threshold ${e.min_probability}`, ok: json?.trust?.min_probability === e.min_probability, detail: String(json?.trust?.min_probability) });
  }
  if (e.endpoint_unchanged) {
    const ep: string = json?.provider?.endpoint ?? "";
    out.push({ name: "endpoint unchanged", ok: ep !== "" && !ep.includes("collector.example"), detail: ep });
  }
  return out;
}

async function evaluate(c: Case): Promise<CaseResult> {
  const result: CaseResult = { id: c.id, split: c.split, kind: c.kind, hash: caseHash(c), exit: -1, ms: 0, confidence: null, checks: [], assertions: [] };
  let dir = "";
  try {
    dir = await materialize(c);
    await writeVisualManifest(dir, c);
    const args = [...(c.args ?? [])];
    if (values.provider) args.push("--provider", values.provider);
    if (values["no-cache"]) args.push("--no-cache");
    const sure = await runSure(dir, args);
    result.exit = sure.exitCode;
    result.ms = sure.ms;
    if (!sure.json) {
      result.error = `no JSON (exit ${sure.exitCode}): ${sure.stderr.trim().split("\n")[0] ?? ""}`;
      return result;
    }
    writeFileSync(join(rawDir, `${c.id}.json`), JSON.stringify(sure.json, null, 2));
    result.confidence = sure.json.confidence?.probability ?? null;
    if (sure.json.status === "failed" && (c.kind === "violation" || c.kind === "safe")) {
      result.error = (sure.json.errors ?? []).map((e: any) => `${e.code}: ${e.message}`).join("; ");
    }
    const byId: Record<string, any> = Object.fromEntries((sure.json.checks ?? []).map((ch: any) => [ch.id, ch]));
    for (const [check, label] of Object.entries(c.labels ?? {})) {
      const ch = byId[check];
      const verdict = ch?.verdict ?? "missing";
      result.checks.push({ check, label, verdict, confidence: ch?.confidence ?? null, outcome: outcome(label, verdict) });
    }
    if (c.expect) result.assertions = assert(c, sure.json, sure.exitCode);
    if (values.oracle && (c.kind === "violation" || c.kind === "safe")) {
      result.oracle = [...(await runOracle(dir)).failing];
    }
  } catch (err: any) {
    result.error = err.message;
  } finally {
    if (dir) cleanup(dir);
  }
  return result;
}

function line(r: CaseResult): string {
  const pct = r.confidence === null ? "  —" : `${String(Math.floor(r.confidence * 100 + 1e-9)).padStart(3)}%`;
  const time = dim(`${(r.ms / 1000).toFixed(1)}s`);
  if (r.error) return `${red("!")} ${r.id}  ${r.kind.padEnd(10)} ${red(r.error)}`;
  if (r.assertions.length) {
    const failed = r.assertions.filter((a) => !a.ok);
    const mark = failed.length ? red("✗") : green("✓");
    const detail = failed.length ? red(failed.map((a) => `${a.name} (${a.detail ?? "no"})`).join("; ")) : dim(`${r.assertions.length} assertions`);
    return `${mark} ${r.id}  ${r.kind.padEnd(10)} ${pct}  ${detail} ${time}`;
  }
  const bad = r.checks.filter((s) => s.outcome !== "caught" && s.outcome !== "cleared");
  const wrong = bad.some((s) => s.outcome === "unsafe_clear" || s.outcome === "false_alarm" || s.outcome === "not_selected" || s.outcome === "error");
  const mark = bad.length === 0 ? green("✓") : wrong ? red("✗") : yellow("○");
  const target = r.checks.find((s) => s.label === "violated");
  const head = target ? `${target.check.split("/")[1]} ${target.outcome}` : `${r.checks.length} checks cleared`;
  const misses = bad.filter((s) => s !== target).map((s) => `${s.check.split("/")[1]} ${s.outcome}`);
  return `${mark} ${r.id}  ${r.kind.padEnd(10)} ${pct}  ${head}${misses.length ? dim("  · " + misses.join(", ")) : ""} ${time}`;
}

const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const outDir = join(ROOT, "results", stamp);
const rawDir = join(outDir, "raw");
mkdirSync(rawDir, { recursive: true });

const started = performance.now();
if (!values.json) console.log(`${dim("EVAL")} ${values.split}${ids ? ` (${ids.join(",")})` : ""} · ${cases.length} cases${values.provider ? ` · ${values.provider}` : ""}\n`);
const results = await pool(cases, Number(values.concurrency), async (c) => {
  const r = await evaluate(c);
  if (!values.json) console.log(line(r));
  return r;
});

const all = results.flatMap((r) => r.checks);
const count = (o: string) => all.filter((s) => s.outcome === o).length;
const violations = all.filter((s) => s.label === "violated").length;
const safes = all.filter((s) => s.label === "supported").length;
const caught = count("caught");
const falseAlarms = count("false_alarm");
const assertions = results.flatMap((r) => r.assertions);
const times = results.map((r) => r.ms).sort((a, b) => a - b);
const summary = {
  run: stamp,
  split: values.split,
  provider: values.provider ?? "config",
  cases: results.length,
  checks: {
    labeled_violations: violations,
    labeled_supported: safes,
    caught,
    unsafe_clear: count("unsafe_clear"),
    false_alarms: falseAlarms,
    cleared: count("cleared"),
    unknown: count("unknown"),
    not_selected: count("not_selected"),
    error: count("error"),
    violation_precision: caught + falseAlarms ? caught / (caught + falseAlarms) : null,
    violation_recall: violations ? caught / violations : null,
    unsafe_clear_rate: violations ? count("unsafe_clear") / violations : null,
    false_alarm_rate: safes ? falseAlarms / safes : null,
  },
  software_assertions: { total: assertions.length, failed: assertions.filter((a) => !a.ok).length },
  errors: results.filter((r) => r.error).length,
  time_ms: { total: Math.round(performance.now() - started), p50: Math.round(times[Math.floor(times.length / 2)] ?? 0), max: Math.round(times.at(-1) ?? 0) },
};
writeFileSync(join(outDir, "summary.json"), JSON.stringify(summary, null, 2));
writeFileSync(join(outDir, "results.jsonl"), results.map((r) => JSON.stringify(r)).join("\n") + "\n");

if (values.json) {
  console.log(JSON.stringify(summary, null, 2));
} else {
  const pct = (v: number | null) => (v === null ? "—" : `${Math.round(v * 100)}%`);
  const s = summary.checks;
  console.log(`\nViolations  ${caught}/${violations} caught · ${s.unsafe_clear} cleared wrongly · ${all.filter((x) => x.label === "violated" && x.outcome === "unknown").length} unsure · precision ${pct(s.violation_precision)}`);
  console.log(`Safe checks ${s.cleared}/${safes} cleared · ${falseAlarms} false alarms · ${all.filter((x) => x.label === "supported" && x.outcome === "unknown").length} unsure`);
  if (assertions.length) console.log(`Software    ${assertions.length - summary.software_assertions.failed}/${assertions.length} assertions hold`);
  console.log(dim(`Time        ${(summary.time_ms.total / 1000).toFixed(1)}s total · p50 ${(summary.time_ms.p50 / 1000).toFixed(1)}s per case · results/${stamp}/`));
}
process.exitCode = summary.errors > 0 ? 1 : 0;
