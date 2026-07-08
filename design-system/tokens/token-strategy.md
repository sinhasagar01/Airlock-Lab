# Token Strategy

## Strategy

The MVP uses CSS custom properties as the token transport because the current product is a Tauri, React, TypeScript, and Vite app without Tailwind or a larger component library.

## Implementation Rules

- Define palette, radius, spacing, shadow, typography scale, and typography weight decisions in `:root`.
- Use semantic names such as `--color-background` and `--color-accent-primary`.
- Keep shared package components class-based so app-level styling can evolve without changing package contracts.
- Prefer component classes such as `.panel`, `.status-pill`, `.summary-card`,
  `.primary-action`, and `.file-preview` over scattered inline styles.
- Add new tokens only when a repeated visual decision appears across screens.

## Current Direction

The active direction is the final dashboard design foundation from
`references/final-dashboard-design/final-dashboard-design.png`.

Phase 1 implements the shared shell and primitive layer, not the full six-tab
screen migration.

- Warm off-white app canvas through `--color-app-background`.
- Fixed warm sidebar through `--color-sidebar-background` and
  `--layout-sidebar-width`.
- Deep navy text and primary actions.
- Coral primary accent.
- White cards with soft large shadows.
- Quiet pill badges for status and metadata; badges should not compete with primary actions.
- Calm pale blue-gray panels for repository and file facts.
- Compact micro-badges for recent-activity timeline states.
- Purple agent and blue context accents for summary cards and future workflow
  surfaces.
- Shared radius, badge-height, and icon-badge sizing tokens for consistent
  component composition.
