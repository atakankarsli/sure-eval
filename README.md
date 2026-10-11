# sure-eval

Measures whether [Sure](../sure)'s verdicts are right. A small TypeScript shop (`app/`) has five flows and 12 checks. Forty cases change it in controlled ways, and independent Vitest oracles decide what is really broken.

```sh
npm install
npm run validate                      # corpus check, no model: every case breaks exactly what its label says
SURE_BIN=../sure/sure npm run eval    # dev split with the provider from app/.sure/config.yaml
npm run eval -- --split holdout       # dev | holdout | software | all, or --case C001,C014
npm run eval -- --adhoc               # pass the requirements with --expect instead of contracts
npm run eval -- --provider jev        # override the provider
```

The model key comes from the environment (`SURE_ANTHROPIC_API_KEY`, `AI_GATEWAY_API_KEY`). Results go to `results/<timestamp>/` (`summary.json`, `results.jsonl`, raw Sure JSON per case).

## Layout

| Path | What |
|---|---|
| `app/src/` | The code Sure reads: catalog, cart, checkout, orders |
| `app/.sure/` | Accepted config and contracts |
| `app/oracle/` | Independent behavior tests; test names start with the check ID |
| `cases/C001.json`… | Edits, split, labels. Harness-only: never copied into a candidate |
| `harness/` | `validate.ts`, `eval.ts`, `lib.ts` (Node 26 runs them directly) |

## Cases

| Kind | IDs | What is scored |
|---|---|---|
| violation | C001–C018 (12 dev, 6 holdout) | The target check must be `violated`; the other checks of the affected flows `supported` |
| safe | C019–C030 (8 dev, 4 holdout) | Every check of the affected flows `supported` |
| incomplete | C031–C036 | Missing context, budget, unmapped change, empty scope, visual evidence |
| trust | C037–C040 | Contract edits on the candidate branch never weaken the trusted base |

For each case the harness copies `app/` into a temporary Git repository, commits the baseline on `main`, commits the case edits on a `candidate` branch with an opaque message, runs Sure, and deletes the copy. Labels, titles and oracle results never reach the candidate or the model.

Outcomes per check: `caught`, `cleared`, `unknown` (abstained), `unsafe_clear` (a labeled violation called supported), `false_alarm`, `not_selected`, `error`. Unknowns count as misses, never as passes.

## Rules

- Never tune prompts or thresholds on the holdout split.
- Never weaken an oracle or a label to match Sure. Change a case only together with `npm run validate`.
- Do not paste results without the split, provider and model they came from.
