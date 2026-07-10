# Frontend Implementation

## Current Stack

The desktop MVP uses Tauri, React, TypeScript, and Vite. Styling is plain CSS with semantic custom properties in `apps/desktop/src/styles.css`.

## UI Architecture

- `apps/desktop/src/App.tsx` owns the current MVP shell and product flows.
- `packages/ui/src/index.tsx` provides shared primitives for status pills,
  summary cards, dashboard cards, icon badges, primary/secondary buttons, icons,
  and empty states.
- Storage and Tauri command wrappers remain under `apps/desktop/src/storage`.
- The final dashboard migration keeps desktop-specific shell composition in
  `App.tsx` through `AppShell`, `Sidebar`, `SidebarNavItem`, `AppHeader`, and
  `UpgradeCard` while the low-level primitives live in `packages/ui`.
- All six top-level tabs use the shared header, summary cards, card surfaces,
  status pills, icon badges, and primary/secondary button treatments.
- Repository Intelligence data is derived in `packages/indexing` from indexed
  file facts, then rendered by the desktop Repositories tab. Keep this boundary
  fact-based and avoid UI-local ad hoc filesystem reads.
- Agent run detail uses `packages/ai` contracts for `AgentRun` and
  `ProposedChangePlan`. Keep proposed plans separate from real Git diffs until
  the diff model and approval review attachment are explicitly implemented.
- Persisted proposed changes use `PersistedProposedChange` from `packages/ai`
  and `apps/desktop/src/storage/proposedChangeStore.ts` for SQLite storage.
  This is durable review metadata only; it does not generate, apply, or write
  patches.
- Proposed changes are normalized through `ensureProposedPatchArtifacts` so
  every proposed file has a placeholder patch artifact record, usually
  `not_generated`, before any generated diff content exists.
- `PatchArtifactList` and `PatchArtifactDetail` render generated patch artifact
  records as a selectable review surface in Agent Runs and Approval Review.
  `generated` artifacts may show a read-only preview only when `rawDiff` is
  present; `not_generated`, `failed`, `unavailable`, binary, and too-large
  states should render designed state panels instead of fake diff text.
- Approval review reuses the linked `AgentRun`, `ApprovalRequest`, and
  `ProposedChangePlan` state plus the linked `PersistedProposedChange` record.
  It may match proposed affected files to local Git status paths and render
  read-only local diffs through `loadGitFileDiff`. Decision buttons may update
  approval status and the linked proposed-change status, but they must not
  execute patches, write files, or run Git commands.
- Git status uses the shared `GitStatusSummary` model in `packages/core` and the
  `loadGitStatusSummary` Tauri wrapper. It must remain read-only and bounded to
  the selected repository.
- Local diff preview uses the shared `GitFileDiff` model in `packages/core` and
  the `loadGitFileDiff` Tauri wrapper. It is selected from changed-file rows and
  must remain read-only, repository-relative, and unavailable for unsafe paths.

## Design System Rules

- Use CSS tokens for color, spacing, radius, and shadow.
- Keep shared primitives class-based instead of inline-styled.
- Preserve native button, input, and select semantics.
- Keep focus-visible states obvious.
- Do not introduce a large UI library until repeated component needs justify it.
- Use the final dashboard reference at
  `references/final-dashboard-design/final-dashboard-design.png` as the visual
  direction for shell, cards, pills, typography, and spacing.
- Preserve the state-driven six-tab navigation until a routing migration is
  intentionally scoped.
- Changes must keep indexed-file browsing and safe preview access available
  while presenting real read-only Git status and local diff preview. It must not
  stage, unstage, discard, commit, reset, checkout, or apply changes.
- Repositories must use safe indexed metadata for intelligence summaries:
  extension counts, important folders, key files, and path-derived framework
  hints. If package scripts or dependencies are not available through a bounded
  safe reader, show an unavailable state.
- Agent Runs may show expected affected files, plan steps, risks, validation,
  and approval handoff from seeded/structured run data. It must not imply real
  generated diffs or file writes before those systems exist.
- Agent Runs should prefer persisted proposed-change status and file artifact
  state when present, while continuing to render the structured plan for
  explanation. Generated patch artifacts must be rendered separately from
  matching local Git diffs.
- Approvals may present matching local repository diffs for affected files, but
  generated patch diffs remain planned until approval-specific diff attachment
  exists. Do not label local Git diffs as agent-generated diffs.
- Settings must not add destructive behavior unless it is implemented with an
  explicit confirmation gate.

## File Preview Rules

- File previews must call the safe Tauri preview command through `previewRepositoryFile`.
- The UI must preserve normal, loading, binary, too-large, outside-repository, and unavailable states.
- Visual changes must not increase preview size limits or expand filesystem access.
