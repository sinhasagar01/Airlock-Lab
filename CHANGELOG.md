# Changelog

## Unreleased

- Agent Runs and Approvals now show the selected repository's work instead of
  every repository's. Both lists rendered everything under one repository's
  selector, and two places printed one repository's name directly above
  another's branch — each row accurate, the screen as a whole misleading. A
  record's repository is resolved through the proposal it links to, because the
  run and the approval only carry a repository *name*, not an identity.
- A record whose repository link does not resolve is grouped under "Not linked
  to a saved repository" rather than hidden. Hiding it would be its own
  dishonesty: those links can dangle, so filtering alone would silently
  disappear a real approval. The shipped demo records land here once you save a
  real repository, and stay marked "Demo record".
- Counts now agree with the lists they label. The Approvals heading, the queue
  counts, and the sidebar badge count the repository you are looking at;
  Overview and Settings still report the whole workspace and now say so.

- Saved repositories can now be selected. The list was display-only: you could
  add repositories and only ever use the first. Selecting one switches every
  repository-scoped surface to it, and switching is unavailable while an apply
  or rollback is running, so an operation's result cannot land under a
  repository you have moved away from.
- Fixed one repository's state being reported as another's. Live Git facts —
  branch, cleanliness, changed-file count — were read without checking which
  repository they described, which was safe only while the app could never
  change repository. They now fall back to the repository's own saved record, or
  to "unknown", never to the other repository's numbers.
- Fixed the wrong repository's file list and Git facts being sent to the
  provider. Indexed files were loaded once at startup for the first repository
  and never reloaded, and they are part of the context describing the active
  repository: a run created after switching would have sent the previous
  repository's file paths, branch, and changed-file count to OpenAI under this
  repository's name.
- Fixed another repository's indexing progress being shown as the active
  repository's.

- An apply attempt left in a state this version does not recognise now blocks
  the repository and is reconciled, rather than being silently ignored by both.
  The two gates enumerated the statuses they acted on, so an unrecognised one
  fell through: the repository kept accepting applies as though nothing were
  pending, and the attempt was never seen, classified, or resolved. They now
  allow-list the statuses that need no action — two different lists, because
  "resolved" and "already classified" are different questions.
- Reconciliation no longer judges an operation it cannot name. Its forward and
  reverse patch checks are evidence about a patch; applying them to an unknown
  operation could declare it a harmless no-op and free the repository. Such an
  attempt is now classified as needing inspection, which blocks until a human
  records one with `INSPECTED`.

- Fixed rollback destroying an edit made between a crashed apply and its
  reconciliation. A crashed apply that reconciliation classified as verified
  got its undo baseline from a snapshot taken at reconciliation time, so an
  edit made in the crash window was inside the baseline's hash, invisible to
  the drift check — rollback restored the pre-apply bytes over the edit and
  reported a verified undo. Proven end-to-end by test before the fix. Only an
  apply-time observation may now claim a baseline; reconciled outcomes are
  permanently un-rollbackable and the surface says why.
- The rollback baseline is now asserted positively rather than inferred from
  absence. Apply records what it observed (or why it could not) in a checked
  write, built from ingredients that cannot involve a git subprocess; rollback
  and the review surfaces consult only that assertion. Rows from before this
  change are filled once by copying their recorded evidence — never by
  deriving — and anything unusable becomes an explicit "not recorded".
- Fixed rollback misdiagnosing a file that grew past 256 KiB during an apply.
  It refused with "no content hash was recorded", implying a recording failure
  when nothing failed, and the surface claimed no record was kept when one was.
  Both now state the true obstacle: rollback must back up a file before
  overwriting it and cannot store one past the 256 KiB bound.

- Added rollback for an applied patch. A pre-apply backup nobody can restore is
  a receipt, not a safety net. A dedicated native command now restores one
  `applied_verified` artifact from its app-local pre-apply backup behind the
  typed phrase `ROLL BACK`. React passes durable IDs and the phrase only — never
  a path, file contents, or a Git argument. Restores happen **only** from
  app-local backups: no `reset`, `checkout`, `clean`, `add`, or `commit` exists
  anywhere in the path, and Git history is never touched.

  It refuses, before writing anything, when the target changed since the apply,
  was deleted, or is staged; when HEAD or the branch moved; when the apply left
  no post-apply baseline to compare against; when the backup fails its integrity
  check; or when the current file cannot itself be backed up. After the write it
  verifies what it restored — the target holds exactly its pre-apply bytes (or is
  gone, for a create), no other path changed, and the index is untouched — and
  quarantines anything it cannot prove.
- Fixed a rolled-back patch being re-appliable. The native apply guard
  enumerates blocked statuses rather than allow-listing eligible ones, so a
  status it had not heard of fell through every arm and reached the write: an
  artifact marked `rolled_back` applied successfully and reported
  `applied_verified`. It is now refused natively, along with an apply attempted
  while a rollback is in flight.
- Fixed a rolled-back proposal still rendering as `applied`. The proposal now
  moves to `rolled_back` alongside its artifact, shown as a calm completed
  outcome rather than a success or a failure.
- An interrupted rollback no longer disappears. `rolling_back` is persisted
  before the write, is seen by reconciliation, blocks every later apply or
  rollback for the repository, and classifies unconditionally to
  `quarantine_required` — no probe, no retry, no re-restore. The existing
  `INSPECTED` acknowledgement remains the exit.
- The repository apply lock now records which destructive operation held it
  rather than always claiming `apply_patch`.

- Fixed a fail-open working-tree check. A failed `git status` was defaulted to
  empty output, so an unreadable index (for example while another process holds
  `index.lock`) reported zero changed files and a clean working tree, letting
  the clean-tree apply gate pass on evidence that was never read. An
  undeterminable status now fails the snapshot closed.
- Added an inspection acknowledgement for unresolved apply attempts.
  `quarantine_required`, `needs_inspection`, and `interrupted` previously
  blocked every future apply for a repository with no command to exit them, so
  the only recovery was editing SQLite by hand. A dedicated native command now
  records a human inspection behind the exact phrase `INSPECTED`, preserves the
  original classification for audit, and clears only the repository-wide block.
  It never applies, retries, restores, or reads the repository.
- Blocked artifacts left in `interrupted` or `needs_inspection` from native
  application. Acknowledgement clears the repository-wide block, so an
  artifact-level guard now permanently holds any artifact whose outcome was
  never proven.
- Fixed a native patch-structure bypass that allowed a second file section to be
  smuggled into an approved single-file artifact. Header counting stopped at the
  first `@@ ` hunk, so a traditional patch section carrying no `diff --git` line
  passed structure validation and `git apply --check`, then wrote a second file
  outside the approved path with no backup and no pre-apply boundary check.
  Unified diffs are now parsed hunk-aware: hunk bodies are consumed by their
  declared line counts, every file section is counted wherever it appears, and
  `parsed_unified_diff_paths` reports paths from all sections.
- Fixed native Git status parsing that truncated the path of the first porcelain
  line. `git_output` trimmed leading whitespace, but porcelain v1 encodes an
  unstaged change as a leading space in `XY PATH`, so every successful `modify`
  apply reported a garbled path, appeared staged, and was wrongly quarantined.
  Only trailing whitespace is stripped now.
- Added native coverage for the gap that hid both defects: an end-to-end
  disposable-repository `modify` apply, unstaged-modification status parsing,
  smuggled second-section rejection, multi-section path parsing, and a guard
  proving hunk content such as `--- signature` is not read as a file header.
- Marked the MVP Demo v1 screenshot set incomplete. The packaged click-through
  was aborted against a remembered non-disposable repository before indexing,
  approval, validation, or apply, and mutated no files or Git state. Packaged
  UI click-through QA remains pending and unclaimed.
- Executed and retained the MVP Demo v1 disposable-repository safety matrix at
  `docs/qa/evidence/mvp-demo-v1-disposable-apply-qa.md`, including production
  bundle identity, isolated packaged launch, apply, quarantine, reconciliation,
  lock, timeout, frontend-state, and full verification results.
- Added a native QA fixture proving that unexpected-path verification persists
  `quarantine_required`, preserves backup linkage, and blocks future apply.
- Added authoritative native post-apply path verification. A successful Git
  process is finalized as `applied_verified` only when the artifact path,
  proposal path, parsed unified-diff path, backup path, target fingerprint, and
  complete post-apply Git changed-path set agree exactly.
- Added durable `quarantine_required` outcomes for unexpected, missing,
  malformed, staged, or conflicting post-apply path evidence. Quarantine keeps
  the backup and Git evidence, blocks future Apply, and requires manual
  inspection without retry or rollback.
- Added Agent Run and Approval Review quarantine diagnostics for expected,
  observed, unexpected, and missing paths, plus native and frontend coverage
  for exact-path success and fail-closed outcomes.
- Added repository-scoped cross-process apply locking through app-local OS
  advisory lock files plus durable SQLite lock records containing operation,
  process, artifact, timing, and stale-state metadata.
- Added stale-lock recovery that marks abandoned records only after the OS lock
  is reacquired, skips reconciliation for a live holder, and continues to block
  application while any attempt remains unresolved.
- Added a fixed 15-second timeout for Git patch dry-run, reconciliation probes,
  and application. Timed-out children are killed and reaped; an in-flight apply
  timeout preserves its backup and becomes an interrupted manual-inspection
  state without retry or rollback.
- Added native lock contention, stale-lock, unresolved-attempt, and child
  termination tests plus expanded disposable-repository QA instructions.
- Added durable `pending`/`applying` apply evidence and native reconciliation
  for attempts interrupted before a terminal result was persisted.
- Added conservative recovery classifications: clearly applied attempts repair
  persisted state without reapplying, unchanged attempts become failed,
  incomplete evidence becomes interrupted, and ambiguity requires inspection.
- Added Agent Run and Approval Review recovery diagnostics with attempt ID,
  backup ID, Git-state comparison, manual-inspection copy, and disabled Apply.
- Added disposable-repository native coverage for applied, untouched,
  incomplete, and ambiguous interruption states plus a packaged-app QA
  checklist at `docs/qa/disposable-repository-apply-qa.md`.
- Added Safe Patch Application v1 for one approved, generated, single-file
  artifact through the dedicated native `apply_approved_patch_artifact`
  command. React supplies durable IDs and exact `APPLY PATCH` confirmation, not
  patch text or filesystem paths.
- Added authoritative native SQLite reload, linked approval/proposal/artifact
  checks, same-request digest/snapshot/fingerprint revalidation, final
  `git apply --check`, and fixed `git apply --whitespace=nowarn -` application.
- Added bounded pre-apply backup and application-attempt persistence, applied or
  failed artifact state, refreshed post-apply Git status, and replay blocking.
- Added Agent Run and Approval Review typed-confirmation, loading, success,
  sanitized error, and applied-state UI while keeping blocked gates disabled.
- Added frontend and native coverage for wrong confirmation, approval-only and
  dry-run-only boundaries, stale/unsafe artifacts, missing backups, actual
  disposable-repository application, backup persistence, and no staging or
  commit creation.
- Prepared the MVP Demo v1 release checkpoint with a complete root README,
  release-accurate MVP scope, recorded-demo run sheet, release notes, recovery
  guidance, and explicit internal-demo versus production-readiness decisions.
- Consolidated `docs/mvp-scope.md` as the canonical implemented scope and kept
  the older product-area path as a compatibility link.
- Recorded the pre-apply evidence checkpoint that preceded Safe Patch
  Application v1, including its then-unimplemented native authority and write
  boundary.
- Added native bounded target-file fingerprints for patch validation evidence,
  including captured, missing, binary, too-large, forbidden, and unavailable
  states without returning file content to React.
- Added a canonical SHA-256 repository snapshot digest over repository identity,
  branch, HEAD, Git state, artifact digest, relevant paths, and sorted target
  fingerprints, with capture timestamps excluded for stable comparison.
- Added a read-only native current-snapshot refresh and readiness blocking when
  authoritative validation and current snapshot digests differ.
- Added native safety coverage for fingerprint limits, sensitive paths,
  traversal, absolute paths, outside-root symlinks, and target changes that do
  not alter Git changed-file counts.
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
