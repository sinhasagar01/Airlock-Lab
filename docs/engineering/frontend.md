# Frontend Implementation

## Current Stack

The desktop MVP uses Tauri, React, TypeScript, and Vite. Styling is plain CSS with semantic custom properties in `apps/desktop/src/styles.css`.

## UI Architecture

- `apps/desktop/src/App.tsx` owns the current MVP shell and product flows.
- `packages/ui/src/index.tsx` provides shared primitives for status pills,
  summary cards, dashboard cards, icon badges, primary/secondary buttons, icons,
  and empty states.
- Storage and Tauri command wrappers remain under `apps/desktop/src/storage`.
- Phase 1 of the final dashboard migration keeps desktop-specific shell
  composition in `App.tsx` through `AppShell`, `Sidebar`, `SidebarNavItem`,
  `AppHeader`, and `UpgradeCard` while the low-level primitives live in
  `packages/ui`.

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

## File Preview Rules

- File previews must call the safe Tauri preview command through `previewRepositoryFile`.
- The UI must preserve normal, loading, binary, too-large, outside-repository, and unavailable states.
- Visual changes must not increase preview size limits or expand filesystem access.
