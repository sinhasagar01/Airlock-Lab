# Changelog

## Unreleased

- Added normalized SHA-256 digests for retained generated patch content and
  persisted the digest checked by validation.
- Added read-only validation snapshots with repository ID, branch, short HEAD,
  clean state, changed-file count, relevant paths, and capture time.
- Replaced the future-only staleness placeholder with digest, snapshot, and
  current-repository comparison gates that require revalidation after changes.
- Added AI, frontend, and native coverage for digest availability, validation
  evidence persistence, unchanged snapshots, stale artifacts, stale
  repositories, and pre-validation states.
- Added shared informational Apply Readiness gates to Agent Run and Approval
  artifact details without adding a write-capable application path.
- Added a permanently disabled `Apply unavailable` boundary and explicit copy
  that approval, validation, and dry-run do not apply repository changes.
- Added readiness tests for approved/dry-run-passed, pending approval, failed
  structure, failed dry-run, missing repository, binary, oversized, and
  protected-path states.
- Completed a native MVP demo rehearsal across repository indexing,
  Repository Intelligence, mock run creation, approval decisions, artifact
  validation, Changes, Settings, and restart hydration.
- Repaired the legacy seeded generated artifact into a complete single-file
  unified diff and added an exact-match migration for existing demo data.
- Reconciled linked Agent Run completion from persisted approval decisions so
  pending counts and run status remain consistent after approve/reject and
  restart.
- Made Overview Active Work status derive from the durable seeded proposal
  instead of continuing to show a stale waiting-for-approval label.
- Added persisted patch validation states covering unvalidated, structurally
  valid/invalid, dry-run passed/failed, and unavailable artifacts.
- Added shared structure validation for repository-relative paths, traversal,
  single-file unified diffs, matching operations, binary/link metadata, 64 KiB
  size limits, and 4,000-line limits.
- Added a dedicated read-only Tauri dry-run command using fixed
  `git apply --check --whitespace=nowarn -` arguments with patch data on stdin.
- Added Validate & dry-run controls to Agent Run and Approval Review, with
  synchronized persisted results and graceful browser/native-unavailable state.
- Added provider, frontend, and native tests proving pass/fail behavior and that
  dry-run does not create files or change Git status.
- Extended the provider plan contract and strict OpenAI response schema with
  review-only patch artifact records linked to proposed affected files.
- Added validation for safe unique artifact paths, matching single-file unified
  diffs, non-previewable states, binary records, and a 64 KiB inline-preview
  limit before any run, proposal, or approval is persisted.
- Persisted generated, failed, unavailable, binary, and too-large artifact
  states with locally derived additions/deletions while keeping missing Mock
  Provider artifacts in `not_generated`.
- Updated Agent Run and Approval Review artifact copy to distinguish provider
  proposals from local Git diffs and applied repository changes.
- Added provider contract, persistence, UI workflow, and native schema tests for
  generated artifacts without adding patch apply, file writes, tools, shell
  execution, or Git mutation.
- Added a native OpenAI connection test that performs a fixed read-only model
  lookup with a short timeout and sends no repository or task context.
- Added sanitized connection diagnostics for configured, connected,
  authentication-failed, model-unavailable, rate-limited, timeout, invalid
  configuration, and unavailable states without returning response bodies,
  headers, account data, or credentials.
- Updated the Settings provider row with native configuration source, model,
  connection-test action, loading state, last session result, timestamp, and
  latency while keeping the action disabled when credentials are unavailable.
- Added frontend and native tests for secure model URL construction, diagnostic
  serialization, status mapping, configured/unconfigured UI, successful tests,
  sanitized failures, and unavailable native runtime behavior.
- Fixed native repository selection by granting the existing app-local SQLite
  persistence path `sql:allow-execute`, which prevents a successful Tauri
  directory selection from failing while repositories are saved.
- Added a Tauri v2 repository-picker boundary that attempts the native dialog
  first, uses `isTauri()` only to classify failures, and keeps browser preview,
  native dialog, and post-selection storage errors distinct.
- Added repository-picker and desktop regression tests for native selection,
  cancellation, browser fallback, native dialog failure, and persistence
  failure without adding manual path entry or changing filesystem scope.
- Added optional OpenAI-backed structured plan generation behind the existing
  provider adapter contract, while keeping Mock Provider as the default.
- Added a native Tauri credential and request boundary using `OPENAI_API_KEY`
  and optional `OPENAI_MODEL`; credentials never enter React or app storage.
- Limited real-provider context to task text and bounded repository/index/Git
  summaries, excluding file contents, secret files, environment files, and
  internal run/repository IDs from the outbound prompt.
- Added strict OpenAI structured-output validation and normalized provider
  errors so malformed or failed requests cannot create partial runs, proposed
  changes, or approvals.
- Added Agent Run provider selection, configured/unavailable states, planning
  progress, provider-specific success/error feedback, and actual provider/model
  labels on run and approval detail surfaces.
- Added provider contract, desktop workflow, and native request-boundary tests
  while preserving `not_generated` patch artifacts, read-only repository
  behavior, and the deterministic mock demo flow.
- Added the provider-independent `AgentProviderAdapter` contract with typed
  provider identity, capabilities, indexed run context, plan input, and
  normalized structured plan output.
- Moved mock plan generation behind the new adapter contract while preserving
  the existing persisted run, proposed-change, approval, and `not_generated`
  artifact workflow.
- Added contract tests proving the Mock Provider supports planning while patch
  generation, streaming, and tool use remain explicitly unsupported.
- Added a full native-app demo script with setup checks, presenter talk track,
  the complete repository-to-approval walkthrough, recovery states, a
  five-minute version, and explicit real/mock/not-implemented boundaries.
- Rehearsed all six tabs in the rendered app and clarified demo-facing copy so
  mock-provider runs, proposed plans, generated patch artifacts, local Git
  diffs, and approval decisions cannot be mistaken for one another.
- Added task-driven Agent Run creation through the mock provider, producing a
  structured review-only plan from selected repository metadata and indexed
  file facts.
- Added SQLite persistence for agent run and plan records, linked each new run
  to a persisted proposed change and pending approval request, and kept every
  generated patch artifact in the honest `not_generated` state.
- Added provider-contract and desktop smoke coverage for mock-run creation and
  its linked persistence records without file writes, patch generation, or Git
  mutation.
- Rebuilt the Agent Runs and Approval Review desktop grids at the 1512px app
  viewport, replacing cramped three-column auto-placement with deliberate
  master/detail, full-width plan, balanced support, artifact, and diff regions.
- Repaired the five non-Overview desktop pages with page-specific compact
  headers, compact context metrics, width-safe Agent Runs and Approval Review
  workspaces, overflow-safe card content, and height-aware sidebar spacing.
- Added smoke assertions for the distinct Repository Intelligence, Agent Runs,
  Approval Review, Workspace Changes, and Workspace Settings page headings.
- Added confirmation-gated Settings maintenance actions: safe selected-repo
  reindexing with loading/success/error states, disabled cache clearing until
  cache boundaries are formalized, and disabled reset workspace with visible
  `RESET WORKSPACE` confirmation copy.
- Added smoke coverage for Settings maintenance actions, including no-repo
  reindex disabled state, reindex success/error feedback, disabled cache
  clearing, and reset remaining disabled after confirmation text.
- Split desktop `App.tsx` into focused component, feature, and helper modules
  for shell, seed data, UI-state helpers, file preview, Git diff preview,
  generated patch artifacts, and demo workflow constants without changing
  product behavior.
- Added native Tauri boundary smoke tests for safe relative paths, preview
  traversal/absolute-path rejection, non-Git status handling, Git status
  parsing, Git diff parsing, and unsafe Git diff path rejection.
- Hardened safe file preview to reject traversal, absolute, empty, and null-byte
  paths before resolving or reading files.
- Expanded frontend smoke coverage for graceful Git status failures and demo
  workflow navigation when native status/preview wrappers are unavailable.
- Added the first connected safe demo workflow seed across Repository
  Intelligence, Agent Runs, persisted proposed changes, Approval Review,
  generated patch artifact states, and matching local Git diff indicators.
- Added cross-tab demo workflow navigation and smoke coverage for the connected
  review path without adding real agent execution, patch generation, or file
  writes.
- Added generated patch artifact detail panels in Agent Runs and Approval
  Review, including not-generated, generated preview, failed, unavailable,
  binary, and too-large states.
- Added smoke coverage for selectable patch artifact states and stored generated
  patch preview rendering without confusing those artifacts with local Git
  diffs.
- Added generated patch artifact placeholder records for persisted proposed
  changes, with normalization so every proposed file has a `not_generated`
  artifact slot.
- Added Agent Runs and Approval Review UI sections that render generated patch
  artifact placeholders separately from matching local Git diffs.
- Updated tests and docs to preserve the distinction between proposed files,
  generated patch artifacts, local Git diffs, and approval decisions.
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
