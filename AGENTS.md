# AGENTS.md

Evaluation corpus and harness for Sure (`../sure`). Read `README.md` first.

- `npm run validate` must pass before and after any change to `app/`, `cases/` or the oracles. It needs no model.
- `npm run eval` calls a real model and spends money; run the smallest split that answers the question.
- A violation case must typecheck (`app/tsconfig.json`) and fail exactly its labeled check's oracle tests. A safe case must keep all 19 oracle tests green.
- Labels and titles live in `cases/` and the harness only. Never put them, or anything that hints at them, under `app/src/`.
- Holdout is for reporting, not tuning.
- No AI attribution in commits.
