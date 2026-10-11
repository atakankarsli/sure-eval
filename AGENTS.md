# AGENTS.md

Evaluation corpus and harness for Sure (`../sure`). Read `README.md` first.

- `npm run validate` and `npm run typecheck` must pass before and after any change to `app/`, `cases/`, the oracles or the harness. Neither needs a model.
- `npm run eval` calls a real model and spends money. Run the smallest split or `--case` list that answers the question.
- A violation case must typecheck (`app/tsconfig.json`) and fail exactly its labeled check's oracle tests. A safe case must keep all 19 oracle tests green.
- Labels and titles live in `cases/` and the harness only. Never put them, or anything that hints at them, under `app/src/`.
- Tune prompts and thresholds on the dev split only. Holdout is for reporting.
- Never weaken an oracle or a label to match Sure.
- Report results with their track, split, provider and model (`summary.json` records all four).
- No AI attribution in commits.
