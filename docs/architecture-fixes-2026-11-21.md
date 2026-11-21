# Architecture fixes — 2026-11-21

This change set establishes the following invariants:

- Group schedules are the source of future recurring lesson occurrences. Synthetic rolling-window rows are no longer materialized, and untouched legacy generated rows are reconciled against the current group slots before projection.
- Dashboard and calendar date keys use the shared local-date normalization helper.
- HOD visits are stored in `hod_visit_records`; legacy profile visits are imported once, canonical tombstones win, and the migration marker is loaded before app initialization.
- A Zoom API meeting created for a group becomes the canonical link for every active weekly slot in that group. Previous active meeting records are superseded and historical URLs remain history-only.
- Regression coverage is included in `npm test` via `src/tests/architectureRegression.test.ts`, alongside the expanded Zoom integration assertions in `src/tests/zoomGrainV2.test.ts`.

Run validation with `npm run lint`, `npm run build`, and `npm test`.
