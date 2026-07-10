# Project State

## Current MVP State

The desktop app supports local repository selection, persisted repositories, Git metadata, read-only Git status and local diff preview, approval-attached matching local diffs, persisted indexing jobs, persisted proposed changes with generated patch artifact records and detail states, indexed file facts, repository intelligence summaries, inspectable agent run detail with structured proposed plans, approval detail review, approval request persistence, a connected safe demo workflow seed, indexed-file browsing, and safe file content previews.

The desktop app now has an initial Vitest/jsdom smoke suite covering six-tab
rendering, sidebar navigation, approval actions, pending approval count updates,
visible safe file preview states, outside-repository blocking, and selected-file
preview updates. It also covers the seeded demo workflow path from Repository
Intelligence to Agent Runs, Approval Review, and Changes. The desktop test
script also runs Rust native boundary tests for path safety, safe preview
rejection, Git status parsing, Git diff parsing, non-Git handling, and unsafe
Git diff path rejection.

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
- Repository Intelligence now includes a `Demo workflow` card that opens the
  seeded connected agent run and approval review path.
- Agent Runs now includes a master/detail workflow with selectable runs,
  provider/model metadata, repository context, structured proposed plans,
  persisted proposed-change status, expected affected files, patch artifact
  state, generated patch artifact detail states, risk summaries, validation
  strategy, and approval handoff while clearly marking that generated patch
  diffs are only available when stored on a generated artifact.
- Approvals now includes a master/detail review workflow with selectable
  approval requests, linked agent run metadata, proposed plan review, affected
  files, persisted proposed-change status, risk and validation sections,
  repository context, generated patch artifact detail states, decision controls,
  persisted approve/reject updates that also update linked proposed-change
  status, and matching local Git diff review for affected files that appear in
  Git status.
- Changes now presents real read-only Git status with clean/dirty state,
  staged/unstaged/untracked counts, changed-file rows, manual refresh,
  repository status facts, selectable file rows, approval-match indicators for
  exact proposed-file path matches, local Git diff preview, and the full
  indexed-file browser.
- The indexed-file browser and preview panel now use the dashboard design system
  with premium file rows, selected-file metadata, designed state panels, and a
  polished code preview frame.
- Settings now presents workspace settings rows and maintenance actions while
  keeping unavailable destructive behavior disabled.

## Active Safety Boundary

Safe file preview remains local-first and path-bounded to the selected repository. Repository Intelligence prefers persisted/indexed facts over new filesystem reads. Git status, local diff preview, and approval-attached matching local diffs are read-only, use fixed native Git arguments, validate repository-relative paths, and do not expose arbitrary Git execution. File preview and Git diff paths reject traversal, absolute paths, empty paths, and null-byte paths before native reads or Git diff commands. Persisted proposed changes and generated patch artifact records are durable review metadata only. Agent run and approval detail do not write files, execute patches, stage, reset, checkout, commit, or generate patch diffs. The demo workflow is seeded review state plus real read-only repository state; it does not claim real agent execution happened. Generated artifact previews render stored `rawDiff` only and failed/unavailable/not-generated states do not fake diff content. Visual changes do not weaken size limits, binary handling, or outside-repository blocking.
