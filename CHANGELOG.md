# Changelog

## Unreleased

- Added a persisted proposed-change model that links agent runs, approval
  requests, repositories, proposed files, and future patch artifact records.
- Added SQLite storage for proposed changes and seed-on-empty hydration in the
  desktop app.
- Updated Agent Runs and Approval Review to consume persisted proposed-change
  status, file risk, and patch artifact state.
- Approval decisions now update the linked proposed-change status to approved
  or rejected without writing files, running Git, or applying patches.
- Attached matching local Git diffs to the Approval Detail review screen by
  matching proposed affected files against read-only Git status paths.
- Reused the safe local diff panel in approval review with loading, rendered
  text diff, missing-local-diff, unavailable, binary, and too-large states.
- Expanded smoke coverage for approval diff availability, rendered local diff
  content, loading state, error state, and approve/reject continuity.
- Added a safe read-only local Git diff viewer for changed files in the Changes
  tab, including staged, unstaged, combined, untracked, binary, too-large,
  unavailable, and no-diff states.
- Added shared Git diff types, a `loadGitFileDiff` wrapper, and a bounded Tauri
  command that validates repository-relative paths before running fixed
  read-only Git diff commands.
- Expanded smoke coverage for rendered local diff content and untracked-file
  diff states.
- Added a read-only Git status data model and Tauri command for the selected
  repository using fixed safe Git arguments.
- Updated the Changes tab to show real clean/dirty state, branch, changed file
  count, staged/unstaged counts, changed-file rows, last refresh time, and
  manual refresh while preserving indexed-file browsing and safe previews.
- Expanded smoke coverage for real Git status rendering and refresh behavior.
- Added an Approval detail review workflow with selectable approval requests,
  linked agent run metadata, proposed plan review, affected files, risk and
  validation sections, repository context, decision controls, and an honest
  diff placeholder.
- Kept approval decisions bounded to persisted approve/reject status updates;
  no file writes, patch execution, Git commands, or generated diffs were added.
- Added an Agent Run detail workflow with selectable runs, provider/model
  metadata, repository context, structured proposed plan, expected affected
  files, risk summary, validation strategy, and approval handoff.
- Added proposed change plan types and seeded mock plans in `packages/ai` to
  prepare for future approval and diff attachment work without generating real
  file edits.
- Expanded desktop smoke coverage for agent run detail, proposed plan
  rendering, run selection, disabled diff action, and approval handoff.
- Added a Repository Intelligence view on the Repositories tab with repository
  overview, Git/index state, extension summary, important folders, key files,
  path-derived framework hints, and clear entry points into file browsing,
  reindexing, agent runs, and changes.
- Added safe indexing helpers that derive repository intelligence from indexed
  file facts without adding arbitrary filesystem reads.
- Expanded desktop smoke coverage for repository intelligence with selected and
  empty repository states.
- Upgraded the indexed-file browser and file preview panel to the final
  dashboard design system with premium file rows, selected-file metadata,
  designed preview states, and a polished safe-read code preview frame.
- Expanded desktop smoke coverage for outside-repository preview blocking and
  selecting a different indexed file.
- Added the first desktop smoke tests with Vitest, jsdom, React Testing
  Library, and user-event.
- Covered six-tab rendering, sidebar navigation, approval approve/reject
  controls, pending-count updates, and safe file preview states for no file,
  loading, text, binary, too-large, and preview-error fallback.
- Configured workspace tests to pass cleanly when packages do not yet contain
  test files.
- Completed the 10-task design migration loop for Overview, Repositories, Agent
  Runs, and Approvals with visual verifier passes against the final dashboard
  reference.
- Tuned Overview spacing, typography, sidebar polish, summary cards, Active
  Work, Recent Activity, and Quick Start to better match
  `references/final-dashboard-design/final-dashboard-design.png`.
- Migrated the Repositories tab to final-dashboard cards while preserving the
  repository picker, saved repositories, Git metadata, and indexing actions.
- Migrated the Agent Runs tab to final-dashboard cards with active run, provider
  context, recent runs, repository metadata, and approval-aware status.
- Migrated the Approvals tab to final-dashboard cards with queue summary,
  provider reasoning, risk/status pills, file summaries, and persisted
  approve/reject actions.
- Migrated the Changes tab to a final-dashboard review surface with a polished
  no-local-changes state, repository status facts, change-readiness feature
  blocks, agent-run CTA, and preserved indexed-file browsing/file previews.
- Migrated the Settings tab to final-dashboard workspace settings and
  maintenance cards with icon rows, status values, enabled reindex/review
  actions, and disabled unavailable/destructive maintenance controls.
- Completed a cross-tab visual consistency QA pass across Overview,
  Repositories, Agent Runs, Approvals, Changes, and Settings for shared header,
  summary cards, card spacing, badges, icons, CTAs, and overflow behavior.
- Began Phase 1 of the final dashboard design migration using
  `references/final-dashboard-design/final-dashboard-design.png` as the visual
  source of truth.
- Added shared UI primitives for `StatusPill`, `SummaryCard`, `DashboardCard`,
  `IconBadge`, `PrimaryButton`, and `SecondaryButton` while preserving
  compatibility wrappers for existing tab code.
- Refactored the desktop shell around `AppShell`, `Sidebar`,
  `SidebarNavItem`, `AppHeader`, and `UpgradeCard` without changing the
  six-tab state model or Tauri storage/indexing flows.
- Expanded semantic CSS tokens for app/sidebar backgrounds, navy primary
  actions, subtle text, agent/context accents, layout width, badge sizing, and
  icon-badge sizing.
- Updated the desktop UI to a warm premium SaaS dashboard direction.
- Added semantic CSS tokens for color, spacing, radius, shadows, typography, buttons, cards, badges, navigation, and preview states.
- Refactored shared status badges to use reusable classes instead of inline colors.
- Added generalized typography tokens/classes and improved visual hierarchy across the dashboard.
- Added a shared icon primitive and replaced route-local dashboard/nav glyphs.
- Tuned the desktop shell toward the provided PNG proportions, including a 1512x832 default window, narrower sidebar, tighter metric cards, and muted active-repository header band.
- Reworked the desktop shell so the sidebar is fixed and the main dashboard content scrolls independently.
- Tightened repository and activity panels to preserve the first-viewport dashboard composition with real repository data.
- Preserved safe file preview behavior while improving selected-file detail and preview state styling.
- Documented frontend styling, file preview, repository indexing, and app shell screen behavior.
