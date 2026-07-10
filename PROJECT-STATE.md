# Project State

## Current MVP State

The desktop app supports local repository selection, persisted repositories, Git metadata, read-only Git status and local diff preview, persisted indexing jobs, indexed file facts, repository intelligence summaries, inspectable agent run detail with structured proposed plans, approval detail review, approval request persistence, indexed-file browsing, and safe file content previews.

The desktop app now has an initial Vitest/jsdom smoke suite covering six-tab
rendering, sidebar navigation, approval actions, pending approval count updates,
visible safe file preview states, outside-repository blocking, and selected-file
preview updates.

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
- Repositories now includes a Repository Intelligence view that derives
  repository overview, Git/index state, top file extensions, important folders,
  key files, and path-based framework hints from safe repository metadata and
  indexed file facts.
- Agent Runs now includes a master/detail workflow with selectable runs,
  provider/model metadata, repository context, structured proposed plans,
  expected affected files, risk summaries, validation strategy, and approval
  handoff while clearly marking that real Git diffs are not generated yet.
- Approvals now includes a master/detail review workflow with selectable
  approval requests, linked agent run metadata, proposed plan review, affected
  files, risk and validation sections, repository context, decision controls,
  persisted approve/reject updates, and an honest diff placeholder.
- Changes now presents real read-only Git status with clean/dirty state,
  staged/unstaged/untracked counts, changed-file rows, manual refresh,
  repository status facts, selectable file rows, local Git diff preview, and the
  full indexed-file browser.
- The indexed-file browser and preview panel now use the dashboard design system
  with premium file rows, selected-file metadata, designed state panels, and a
  polished code preview frame.
- Settings now presents workspace settings rows and maintenance actions while
  keeping unavailable destructive behavior disabled.

## Active Safety Boundary

Safe file preview remains local-first and path-bounded to the selected repository. Repository Intelligence prefers persisted/indexed facts over new filesystem reads. Git status and local diff preview are read-only, use fixed native Git arguments, validate repository-relative paths, and do not expose arbitrary Git execution. Agent run and approval detail are inspectable mock/structured plan state only and do not write files, execute patches, stage, reset, checkout, commit, or generate approval-attached diffs. Visual changes do not weaken size limits, binary handling, or outside-repository blocking.
