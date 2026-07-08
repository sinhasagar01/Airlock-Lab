# Project State

## Current MVP State

The desktop app supports local repository selection, persisted repositories, Git metadata, persisted indexing jobs, indexed file facts, approval request persistence, indexed-file browsing, and safe file content previews.

## Current UI Direction

The product is in the final dashboard design migration, using
`references/final-dashboard-design/final-dashboard-design.png` as the visual
source of truth.

- Warm off-white background.
- Fixed sidebar with deep navy brand mark and independent main content scrolling.
- Coral active navigation and action accents.
- White rounded cards with soft shadows.
- Pill status badges and calm state surfaces.
- Polished indexed-file browsing and preview panel.
- Generalized typography tokens/classes for display, title, heading, body, metadata, and hero lead roles.
- Shared CSS icon primitive used across navigation, dashboard metrics, and sidebar actions.
- Shared UI primitives now include status pills, summary cards, dashboard cards,
  icon badges, primary/secondary buttons, and compatibility wrappers for earlier
  dashboard components.
- Overview now matches the final dashboard composition with Active Work, Recent
  Activity, and Quick Start cards.
- Repositories, Agent Runs, and Approvals now use the same premium dashboard
  card system while preserving repository picker, indexing, Git metadata, agent
  run state, approval persistence, and approve/reject actions.
- Changes and Settings still need their final tab-specific content migration.

## Active Safety Boundary

Safe file preview remains local-first and path-bounded to the selected repository. Visual changes do not weaken size limits, binary handling, or outside-repository blocking.
