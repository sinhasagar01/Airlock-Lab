# Settings Maintenance Safety

## Current Boundary

Workspace maintenance actions must be explicit about what they can safely do.

- `Reindex repository` is implemented. It runs the existing selected-repository
  indexing flow, refreshes indexed file facts, updates indexing job state, and
  does not write to repository files or mutate Git state.
- `Clear workspace caches` is unavailable until cache boundaries are
  formalized. The app does not yet have a scoped cache delete API, so the
  control remains disabled.
- `Reset workspace` is unavailable until app-local delete boundaries are
  formalized. The UI shows the required `RESET WORKSPACE` confirmation phrase,
  but execution remains disabled.

## Non-Goals

- Do not delete repository files.
- Do not run Git mutation commands.
- Do not clear persisted repositories, approvals, proposed changes, indexed
  facts, or jobs without a scoped app-local delete contract.
- Do not implement broad filesystem cleanup from the frontend.

## Future Requirements

Before enabling cache clearing or reset:

- Add typed native/storage commands for the exact app-local data being removed.
- Keep destructive actions behind explicit confirmation.
- Preserve repository files and Git state.
- Add frontend and native tests proving the action cannot operate outside the
  app-local storage boundary.
