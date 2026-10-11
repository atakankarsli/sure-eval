// Validates the corpus without calling any model: the baseline must pass every
// oracle; each violation must typecheck and fail exactly its labeled check;
// each safe change must typecheck and keep every oracle green.
import { cleanup, dim, green, loadCases, materialize, pool, red, runOracle, typecheck, type Case } from "./lib.ts";

type Outcome = { id: string; ok: boolean; detail: string };

async function validate(c: Case): Promise<Outcome> {
  const dir = await materialize(c);
  try {
    if (c.kind === "incomplete" || c.kind === "trust") {
      return { id: c.id, ok: true, detail: "software case (scored on Sure output only)" };
    }
    const tsc = await typecheck(dir);
    if (tsc) return { id: c.id, ok: false, detail: `does not typecheck: ${tsc}` };
    const oracle = await runOracle(dir);
    if (oracle.error) return { id: c.id, ok: false, detail: oracle.error };
    if (oracle.baselineFailing.length) return { id: c.id, ok: false, detail: `baseline tests fail: ${oracle.baselineFailing.join(", ")}` };
    const want = Object.entries(c.labels ?? {}).filter(([, v]) => v === "violated").map(([k]) => k).sort();
    const got = [...oracle.failing].sort();
    if (want.join() !== got.join()) {
      return { id: c.id, ok: false, detail: `oracle fails [${got.join(", ")}], labels say [${want.join(", ")}]` };
    }
    return { id: c.id, ok: true, detail: want.length ? `fails ${want.join(", ")} only` : `all ${oracle.total} oracle tests pass` };
  } finally {
    cleanup(dir);
  }
}

const started = performance.now();
const baseline: Case = { id: "baseline", split: "dev", kind: "safe", title: "unchanged fixture", edits: [], labels: {} };
const cases = [baseline, ...loadCases()];
const results = await pool(cases, 6, validate);
for (const r of results) {
  console.log(`${r.ok ? green("✓") : red("✗")} ${r.id.padEnd(9)} ${dim(r.detail)}`);
}
const bad = results.filter((r) => !r.ok);
console.log(`\n${bad.length === 0 ? green("corpus valid") : red(`${bad.length} invalid`)} · ${cases.length} cases · ${((performance.now() - started) / 1000).toFixed(1)}s`);
process.exitCode = bad.length === 0 ? 0 : 1;
