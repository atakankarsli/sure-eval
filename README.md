# sure-eval

Measures whether [Sure](https://github.com/atakankarsli/sure)'s verdicts are right. A small TypeScript shop in `app/` has five flows with 12 checks. Forty cases change it in controlled ways, and independent Vitest oracles decide what is really broken. The model's answers are scored against those labels.

## Run

```sh
npm install
npm run validate                         # no model: every case breaks exactly what its label says
npm run typecheck

export SURE_BIN=../sure/sure             # default; build it with `make build` in ../sure
export TYPESAFE_API_KEY=...              # or AI_GATEWAY_API_KEY, or SURE_ANTHROPIC_API_KEY

npm run eval -- --provider jev                   # contracts track, dev split
npm run eval -- --provider jev --split all       # dev | holdout | software | all
npm run eval -- --provider jev --case C003,C015  # specific cases
npm run eval -- --provider jev --adhoc           # ad-hoc track (see below)
npm run eval -- --oracle                         # also rerun the oracle on every candidate
```

Each run writes `results/<timestamp>/`: `summary.json` (track, split, provider, models, counts, rates, timings), `results.jsonl` (one line per case), and `raw/<case>.json` (Sure's full output). `results/` is not committed.

## Tracks

- **contracts**: Sure checks the candidate against the accepted contracts in `app/.sure/contracts`, as a project with Sure set up would.
- **adhoc**: the candidate has no contracts. Each labeled check's requirement is passed with `--expect`, so Sure reads only the changed files plus what they import and what imports them. This measures an agent checking its own expectations on a diff.

## Cases

| Kind | IDs | Scored on |
|---|---|---|
| violation | C001–C018 (12 dev, 6 holdout) | The target check must be `violated`; the other checks of the affected flows `supported` |
| safe | C019–C030 (8 dev, 4 holdout) | Every check of the affected flows `supported` |
| incomplete | C031–C036 | Missing context, budget, unmapped change, empty scope, visual evidence: software assertions |
| trust | C037–C040 | Contract edits on the candidate branch never weaken the trusted base: software assertions |

For each case the harness copies `app/` into a temporary Git repository. It commits the baseline (plus any reviewed `baseline_edits`) on `main`, commits the case's `edits` on a `candidate` branch with an opaque message, runs Sure, and deletes the copy. Labels, titles and oracle results never reach the candidate or the model.

Outcomes per labeled check:
- `caught`: a labeled violation reported as violated.
- `cleared`: a supported check reported as supported.
- `unknown`: the model abstained. It counts as a miss, never as a pass.
- `unsafe_clear`: a violation called supported. This is the worst outcome.
- `false_alarm`: a supported check called violated.
- `not_selected` and `error`.

## Results so far (2026-10-11, one run each, not calibrated)

| Track | Provider | Violations caught | Wrongly cleared | Safe checks cleared | False alarms | Time |
|---|---|---|---|---|---|---|
| contracts, all 30 semantic cases | Jev `jev-1.13.0` | 13/18 | 2 | 88/95 | 0 | 40 cases in 7.4 s |
| contracts, all 30 semantic cases | Claude Haiku 5.5 | 16/18 | 0 | 82/95 | 0 | 30 cases in 33 s |
| ad-hoc, dev | Jev | 11/12 | 0 | 49/59 | 0 | 3.1 s |
| ad-hoc, holdout | Jev | 2/6 | 1 | 30/36 | 0 | 2.0 s |
| ad-hoc, dev | Haiku | 11/12 | 0 | 50/59 | 0 | 19.0 s |
| ad-hoc, holdout | Haiku | 6/6 | 0 | 36/36 | 0 | 11.4 s |
| software (incomplete + trust) | either | — | — | 27/27 assertions | — | under 7 s |

Jev's wrong clears are the CHK-003 mutants (C003, C015): a removed `submitting: false` that object spread keeps `true`, across two files. Jev catches it when the question names the path and the incoming value. Details are in `../sure/docs/PLAN.md`.

## Adding a case

1. Copy a case in `cases/` and give it the next ID. Set `split` (`dev` or `holdout`), `kind`, `title` and `labels` (every check of the flows the edit touches: `violated` for the one it breaks, `supported` for the rest). Write `edits` as `{file, find, replace}` (exactly one match, or `"all": true`), `{file, create}` or `{file, delete: true}`.
2. Run `npm run validate`. A violation must typecheck and fail exactly its labeled check's oracle tests; a safe change must keep all 19 green.
3. Only then run it against a model.

## Layout

| Path | What |
|---|---|
| `app/src/` | The code Sure reads: catalog, cart, checkout, orders |
| `app/.sure/` | Accepted config and contracts |
| `app/oracle/` | Independent behavior tests; each name starts with its check ID |
| `cases/` | Edits, splits and labels. Harness-only: never copied into a candidate |
| `harness/` | `validate.ts`, `eval.ts`, `lib.ts`; Node 26 runs TypeScript directly |
