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
  while presenting the change-review empty/readiness state.
- Repositories must use safe indexed metadata for intelligence summaries:
  extension counts, important folders, key files, and path-derived framework
  hints. If package scripts or dependencies are not available through a bounded
  safe reader, show an unavailable state.
- Agent Runs may show expected affected files, plan steps, risks, validation,
  and approval handoff from seeded/structured run data. It must not imply real
  generated diffs or file writes before those systems exist.
- Settings must not add destructive behavior unless it is implemented with an
  explicit confirmation gate.

## File Preview Rules

- File previews must call the safe Tauri preview command through `previewRepositoryFile`.
- The UI must preserve normal, loading, binary, too-large, outside-repository, and unavailable states.
- Visual changes must not increase preview size limits or expand filesystem access.
