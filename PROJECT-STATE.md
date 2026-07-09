# Project State

## Current MVP State

The desktop app supports local repository selection, persisted repositories, Git metadata, persisted indexing jobs, indexed file facts, approval request persistence, indexed-file browsing, and safe file content previews.

The desktop app now has an initial Vitest/jsdom smoke suite covering six-tab
rendering, sidebar navigation, approval actions, pending approval count updates,
and visible safe file preview states.

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
- Repositories, Agent Runs, Approvals, Changes, and Settings now use the same
  premium dashboard card system while preserving repository picker, indexing,
  Git metadata, agent run state, approval persistence, approve/reject actions,
  indexed-file browsing, and safe file previews.
- Changes now presents a polished no-local-changes review state, change-readiness
  feature blocks, repository status facts, and the full indexed-file browser.
- Settings now presents workspace settings rows and maintenance actions while
  keeping unavailable destructive behavior disabled.

## Active Safety Boundary

Safe file preview remains local-first and path-bounded to the selected repository. Visual changes do not weaken size limits, binary handling, or outside-repository blocking.
