# Project State

## Current MVP State

The desktop app supports local repository selection, persisted repositories, Git metadata, read-only Git status and local diff preview, approval-attached matching local diffs, persisted indexing jobs, persisted proposed changes with generated patch artifact records and detail states, indexed file facts, repository intelligence summaries, task-driven mock-provider agent runs with durable structured plans and linked pending approvals, inspectable agent run detail, approval detail review, approval request persistence, a connected safe demo workflow seed, indexed-file browsing, and safe file content previews. Native repository selection now attempts the Tauri v2 dialog directly and persists successful selections through the explicitly allowed app-local SQLite execute capability; browser, native-dialog, and storage failures remain separately labeled.

The desktop app now has an initial Vitest/jsdom smoke suite covering six-tab
rendering, sidebar navigation, approval actions, pending approval count updates,
visible safe file preview states, outside-repository blocking, and selected-file
preview updates. It also covers the seeded demo workflow path from Repository
Intelligence to Agent Runs, Approval Review, and Changes, plus Settings
maintenance states for safe reindexing and disabled destructive controls. The
desktop test script also runs Rust native boundary tests for path safety, safe
preview rejection, Git status parsing, Git diff parsing, non-Git handling, and
unsafe Git diff path rejection.

The current MVP workflow has a presenter-facing rehearsal script covering the
native repository picker, indexing, Repository Intelligence, mock-provider run
creation, proposal and approval linkage, generated artifact states, read-only
local diffs, approval decisions, Changes, and guarded Settings maintenance.
Entry-point copy explicitly labels the mock run and keeps generated artifacts
separate from local Git diffs.

The AI package now exposes a provider-independent `AgentProviderAdapter`
contract for structured plan generation. Mock Provider remains the default.
The native desktop app also supports optional OpenAI plan generation when
`OPENAI_API_KEY` is configured in the Tauri process environment. OpenAI receives
only bounded task, repository, index, folder/file-name, extension, and Git
summary facts; it receives no arbitrary file contents. Strict schema and app
validation run before any run, proposal, or approval is persisted. OpenAI may
now return review-only generated patch artifact data alongside the plan.
Artifact paths must match proposed files, text previews must be single-file
unified diffs, counts are derived locally, and oversized raw content is not
retained. Provider tool use, streaming, staging, committing, and arbitrary Git
mutation remain unavailable.

Generated text artifacts now support persisted structure validation and a
read-only native applicability dry-run. The dedicated command repeats path,
single-file diff, operation, binary, size, and line-count checks before running
fixed `git apply --check --whitespace=nowarn -` arguments with patch content on
stdin. Results are sanitized and shared across Agent Run and Approval Review.
The seeded generated sample is a complete unified diff, and existing legacy
seed data is migrated without changing user-created proposals. Agent Run
completion is derived from durable approval decisions so run summaries remain
consistent after approval and restart.

Agent Runs and Approval Review now show shared Apply Readiness
gates for selected artifacts. The evaluator reports approval, generation,
structure, dry-run, repository, working-tree, path, protected-file, binary,
size, artifact-digest, validation-snapshot, and repository-staleness state.
Retained patch text receives a normalized SHA-256 digest. Validation persists
the checked digest plus a read-only snapshot of repository ID, branch, short
HEAD, clean state, changed-file count, relevant proposal paths, and capture
time. Native validation now adds bounded target-file fingerprints and an
authoritative snapshot digest over repository identity, Git state, artifact
digest, relevant paths, and sorted fingerprints. Existing safe UTF-8 files up
to 256 KiB are content-hashed; missing, binary, oversized, forbidden, symlink,
and unavailable targets receive typed states without exposing file content.
Digest or repository changes block readiness until revalidation.
`Apply unavailable` stays disabled until every gate passes. An eligible artifact
requires exact `APPLY PATCH` confirmation before the dedicated native command
can run.

## Safe Patch Application v1

Safe Patch Application v1 applies one persisted, generated, single-file patch
artifact to a clean selected Git working tree. React passes only repository,
proposal, approval, and artifact IDs plus the exact confirmation phrase. Native
code reloads the durable SQLite records, verifies their links and approved
state, recomputes the artifact digest, repeats structure validation and
`git apply --check`, refreshes target fingerprints and the repository snapshot,
and rejects stale, forbidden, binary, oversized, browser, dirty-tree, or replay
states.

Before the write, native code persists a bounded backup and an `applying` audit
record with pre-apply evidence. It then runs fixed
`git apply --whitespace=nowarn -` with the persisted patch over stdin, reloads
Git status, and persists verified, quarantined, or failed evidence. Startup and the Agent
Runs/Approval Review surfaces reconcile every attempt that does not already
carry a verdict: clearly applied state is repaired without reapplying, unchanged
state becomes failed, incomplete evidence becomes interrupted, and ambiguity
becomes needs inspection. An attempt in a state this version does not recognise
is reconciled to needs inspection without probing — the patch checks are
evidence about a patch and say nothing about an operation the app cannot name —
and it blocks the repository until a human records an inspection. The gate that
blocks and the query that reconciles keep separate lists: an attempt can carry a
verdict (so reconciliation has nothing to add) while still blocking because a
human has not acted. Successful application leaves changes unstaged and
uncommitted. Apply now holds a repository-scoped OS advisory lock under the
app-local data directory and records its lock ID, process, operation, artifact,
start time, and stale deadline in SQLite. Duplicate windows and processes fail
closed; abandoned durable locks become stale only after the OS lock is safely
reacquired. Fixed Git dry-run, reconciliation probes, and application children
have a 15-second deadline and are killed and reaped on timeout. An in-flight
apply timeout is persisted as interrupted with its backup and available Git
evidence. After Git succeeds, native code compares the exact artifact,
proposal, parsed diff, backup, fingerprint, and post-apply Git paths. Only an
exact, unstaged match becomes `applied_verified`; any missing, unexpected,
staged, or conflicting evidence becomes durable `quarantine_required`, keeps
Apply disabled, and requires manual inspection. Multi-artifact transactions and
retained packaged QA evidence remain future work.

## Rollback v1

An `applied_verified` patch can now be restored from its app-local pre-apply
backup through a dedicated native command behind the exact phrase `ROLL BACK`.
React passes repository, proposal, and artifact IDs plus the phrase; it never
sends a path, file contents, or a Git argument. Restores read **only** app-local
backups — no `reset`, `checkout`, `clean`, `add`, or `commit` appears in the
path, and Git history is never touched.

Native reloads every durable record and re-derives every precondition: the
artifact must be `applied_verified`, the apply must have positively asserted a
rollback baseline (`recorded`, with the target's post-apply content hash plus
branch and HEAD, written by a checked update from ingredients that involve no
git subprocess), the current file must still match that baseline, HEAD and the
branch must be unchanged, the target must be unstaged, and the pre-apply backup
must pass a SHA-256 integrity check before a byte is written. Anything that is
not an explicit `recorded` refuses with its reason: a file that outgrew the
256 KiB rollback backup bound, an apply whose outcome was reconciled after a
crash (its snapshot is reconciliation-time, so crash-window edits cannot be
ruled out), or a legacy row with nothing usable. Ineligibility and its reason
are shown where the artifact is displayed, before any action, so an artifact
that can never be rolled back is never offered a button that could only refuse
— and for a modify, the copy states that the pre-apply contents are exactly
what was committed at apply time.

Write ordering deliberately inverts apply's: the `rolling_back` attempt row lands
*before* the pre-rollback backup, because that backup records bytes about to be
destroyed and the "we started" marker must exist first. The overwritten bytes are
retained in a separate `patch_rollback_backups` table, never mixed with the
pre-apply backups a rollback restores from.

After the write, native verifies the target holds exactly its pre-apply bytes (or
is gone, for a create), that no other path changed, that the index is untouched,
and that HEAD did not move. Verification compares changed and staged paths as a
delta against the pre-restore tree rather than demanding a clean tree, so the
user's own unrelated work does not falsely quarantine a correct rollback. Only a
provable result becomes `rolled_back`; anything else becomes durable
`quarantine_required`. A rolled-back artifact and its proposal are permanently
ineligible for re-application, enforced by the native apply guard rather than by
the UI. An interrupted rollback is seen by reconciliation, blocks the repository,
and classifies unconditionally to `quarantine_required` with no probe.

## App-Local Storage Address

`workspace.db` — and therefore `patch_apply_backups`, `patch_rollback_backups`,
and `patch_apply_attempts` — lives at a path derived from the Tauri bundle
**identifier** and nothing else. `app_config_dir()` (used by the SQL plugin) and
`app_local_data_dir()` (used by the apply lock) both resolve to
`<platform dir>/<identifier>`; `productName` is never consulted by any path
resolver, which is why the display name is free to change and the identifier is
not. Changing the identifier makes the plugin lazily create a fresh empty
database at the new address: existing records stay on disk, unreachable, while
the app renders a calm empty state — and rollback keeps truthfully claiming it
restores only from app-local backups it can no longer see.

The identifier was changed exactly once, from `com.aidev.workspace` to
`com.airlocklab.airlock`, alongside the rename to Airlock and before any
distribution, while no patch backup existed in any database. It is now pinned by
a native test carrying that reasoning. Verified rather than inferred: the renamed
build creates its database under the new identifier and leaves a pre-existing
old-identifier database byte-identical.

Settings now reports whether OpenAI is configured through the native process
and can run a read-only connection test for the configured model. The test sends
no repository or task context, reads no provider response body, persists no
diagnostic state, and returns only sanitized status, model, timestamp, latency,
and message fields to React. API keys remain native environment state only.

`App.tsx` remains the top-level state orchestrator, but stable seed data,
desktop shell components, UI-state helpers, generated patch artifact panels,
local Git diff preview, and indexed-file browser/preview now live in focused
desktop modules under `components`, `features`, and `lib`.

## MVP Demo v1 Release Checkpoint

As of 2026-07-15, the project is at an internal recorded-demo checkpoint.
Release-accurate scope, recording instructions, and release notes are maintained
in:

- `docs/mvp-scope.md`
- `docs/demo-script.md`
- `docs/release-notes/mvp-demo-v1.md`
- `docs/security/patch-application-safety.md`

The checkpoint is ready for a recorded demo when the verification suite passes
on the recording machine and the presenter uses a non-sensitive disposable
repository. The packaged `.app` and DMG demonstrate the macOS ARM64 build path;
they do not imply signing, notarization, public distribution, or production
support.

The automated disposable-repository apply, quarantine, reconciliation, lock,
and timeout matrix passed on 2026-07-15. The production `.app` launched with an
isolated disposable home, and exact bundle hashes and results are retained in
`docs/qa/evidence/mvp-demo-v1-disposable-apply-qa.md`. A human-driven packaged
UI click-through and screenshots remain pending and are not claimed by that
record.

The release decision is deliberately split:

- Internal recorded MVP demo: ready after the documented preflight passes.
- Production or autonomous repository modification: not ready.
- Safe Patch Application v1: implemented for one locally reviewed artifact with
  authoritative native lookup, same-request revalidation, backup persistence,
  typed confirmation, and exact-path post-apply verification.
- Recovery and broader distribution: interrupted-attempt reconciliation and a
  disposable-repository QA protocol are implemented, including cross-process
  locking, bounded Git child-process timeouts, and quarantine for unexpected
  post-apply paths. Release-specific QA evidence and rollback remain
  incomplete.

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
- Non-Overview tabs use compact, page-specific headers and context metrics so
  their primary workflows remain in the first viewport. Agent Runs and Approval
  Review reflow around the usable width beside the fixed sidebar, and the
  sidebar compacts vertically in shorter desktop windows without dropping its
  upgrade card or user footer.
- Repositories now includes a Repository Intelligence view that derives
  repository overview, Git/index state, top file extensions, important folders,
  key files, and path-based framework hints from safe repository metadata and
  indexed file facts.
- Repository Intelligence now includes a `Demo workflow` card that opens the
  seeded connected agent run and approval review path.
- Agent Runs now includes a master/detail workflow with selectable runs,
  a task composer backed by the mock provider, provider/model metadata,
  repository context, structured proposed plans,
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
- Settings now presents workspace settings rows and confirmation-gated
  maintenance actions. Reindexing the selected repository is enabled through
  the existing safe indexing boundary with loading, success, and error states.
  Cache clearing is disabled until cache boundaries are formalized. Reset
  workspace shows the `RESET WORKSPACE` confirmation guard but remains disabled
  until app-local delete boundaries exist.

## Repository Selection

There is no repository until a human picks one. The app shipped with a fixture
repository as its initial state — a hardcoded absolute home directory presented
as saved and indexed — and hydration's failure path never calls
`setRepositories`, so a storage failure left that fabrication active for the
whole session with every surface describing it as chosen. The fixture is retired
rather than re-pathed: re-pathing hardcodes a new home directory, which is the
same hazard with a fresh string. `activeRepository` falls back to
`emptyRepository`, which says "No repository selected", and the agent-run
composer names the obstacle ("repository required") instead of a repository and
does not offer the control that would act. The browser preview renders an empty
app as a result, deliberately: it could only ever show a workspace by using the
fixture, and it cannot reach the native picker.

The saved repository list is selectable, and the selection drives every
repository-scoped surface: Overview, Repositories, Changes, indexed files and
previews, and the apply/rollback readiness gates. Selecting a repository clears
the previous one's files, diffs, previews, and fingerprint snapshot before the
new repository's data loads, so no window renders one repository's contents
under another's name.

Live Git facts are only trusted for the repository they were read from: a
summary whose repository id does not match the active repository is treated as
absent, falling back to that repository's own saved record or to `unknown`
rather than to another repository's numbers. This matters beyond the screen —
those facts, and the indexed file list, are sent to the provider as context
describing the active repository. Indexing progress is likewise scoped by
repository id.

Switching is blocked while an apply or rollback is in flight, with the reason
shown, and the post-apply and post-rollback status writes are guarded by
repository id so a late result cannot install itself as a different
repository's live status. Native is unaffected either way: a destructive command
targets the repository its proposal names and re-derives every check from
durable records.

Agent Runs and Approvals are scoped to the active repository. Neither record can
identify its own repository — both carry `repository` as a display name — so each
is resolved through its linked proposal's `repositoryId`, the same link the apply
readiness gate compares. Another saved repository's work is not shown; a record
whose link does not resolve is grouped under "Not linked to a saved repository"
rather than dropped, because those links can dangle and hiding a real approval is
its own dishonesty. A record that is not scoped to the active repository no longer
prints that repository's branch beside its own name. Counts that label a scoped
list count that list; Overview and Settings keep the workspace total and say so.

The selection is in-memory; a restart falls back to the first saved repository.

## Active Safety Boundary

Safe file preview remains local-first and path-bounded to the selected repository. Repository Intelligence prefers persisted/indexed facts over new filesystem reads. Git status, local diff preview, approval-attached matching local diffs, and patch dry-runs are read-only, use fixed native Git arguments, validate repository-relative paths, and do not expose arbitrary Git execution. File preview and Git diff paths reject traversal, absolute paths, empty paths, and null-byte paths before native reads or Git commands. Persisted proposed changes, generated patch artifacts, and validation results are durable review metadata only. Provider-backed runs persist review records only after validated plan and artifact output and never write or apply files, use tools, or mutate Git. OpenAI credentials remain in the native process and sensitive paths are excluded from its bounded planning context. Agent run and approval detail do not write files, execute patches, stage, reset, checkout, or commit. A dry-run pass does not approve or apply an artifact. The demo workflow is seeded review state plus real read-only repository state; it does not claim real agent execution happened. Generated artifact previews render stored `rawDiff` only and failed/unavailable/not-generated states do not fake diff content. Visual changes do not weaken size limits, binary handling, or outside-repository blocking.

Settings maintenance keeps the same boundary: reindex refreshes derived indexed
facts for the selected repository, while cache clearing and reset do not execute
until scoped app-local delete commands and tests exist. Reset confirmation UI is
present, but the disabled action cannot delete workspace state or repository
data.
