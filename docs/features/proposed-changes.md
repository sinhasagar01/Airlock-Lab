# Proposed Changes Feature

## Purpose

Proposed changes connect agent runs, proposed plans, approval requests,
generated patch artifacts, validation evidence, and Safe Patch Application.

This layer is durable review state. It lets the app persist what an agent
expects to change and preserves the reviewed state before any explicitly
confirmed working-tree application.

## MVP Behavior

- Proposed changes are stored in SQLite as `proposed_changes`.
- Each proposed change links to an agent run, repository, and optionally an
  approval request.
- Each proposed change records title, summary, status, proposed files, and
  patch artifact slots and validated provider-generated proposal artifacts.
- Proposed files include path, optional old path, operation, reason, risk level,
  and patch artifact status.
- Every proposed file has a placeholder `ProposedPatchArtifact` record. Existing
  saved rows are normalized on load so older proposed changes gain placeholder
  artifacts without generating patch content.
- Mock and missing artifacts remain `not_generated`. OpenAI-backed runs may
  persist validated `generated`, `failed`, or `unavailable` artifact records.
- Agent Runs and Approval Review render generated patch artifacts as selectable
  records with detail states for `not_generated`, `generated`, `failed`, and
  `unavailable`.
- A generated artifact preview is shown only when the artifact has stored
  `rawDiff` content. `not_generated`, `failed`, and `unavailable` states must
  not fabricate diff text.
- Approval decisions update the linked proposed-change status to `approved` or
  `rejected`.
- Generated text artifacts expose an explicit **Validate & dry-run** action.
  Its persisted validation status is shared by Agent Run and Approval Review.
- Selected artifact details expose the same **Apply Readiness**
  gates in Agent Runs and Approval Review. Gates derive from approval,
  generation, validation, repository, Git-state, path, binary, size, artifact
  digest, target-file fingerprint, and validation-snapshot data.
- Apply readiness can be ready to apply, applied, blocked, or pending checks.
  A changed artifact digest or changed repository snapshot blocks readiness and
  requires revalidation.
- **Apply unavailable** remains disabled until every gate passes. Eligible
  artifacts expose **Apply Patch**, require the exact phrase `APPLY PATCH`, and
  invoke a native command using durable IDs only.
- Native application reloads the saved repository, proposal, approval, and
  artifact; reruns validation and dry-run; creates a bounded target-file backup;
  applies the persisted patch; and stores applied/failed state plus refreshed
  Git status.
- Agent Runs and Approval Review consume persisted proposed-change records while
  keeping the existing structured plan steps, risks, and validation strategy.
- The MVP seed includes one connected demo proposed change,
  `proposal-mvp-shell`, linked to `run-mvp-shell` and
  `approval-provider-rfc`.

## Boundaries

This feature does not:

- Apply from browser preview
- Accept arbitrary patch content or repository paths from React
- Stage or commit changes
- Automatically roll back an applied artifact
- Apply multiple artifacts transactionally

Generated patch artifacts are provider-produced, persisted review contracts.
Only an approved, fresh, validated artifact can cross the dedicated native
apply boundary. Local Git diffs remain separate repository state and must not be
labeled as agent-generated patch diffs.

The demo workflow may show sample generated artifact content, but that content
is seeded review data. It is not produced by real agent execution.

## Artifact Separation

- `ProposedChangeFile` means an agent intends to affect a file.
- `ProposedPatchArtifact` is the future generated patch record for that file.
- `GitFileDiff` is the current local repository diff for a changed file.
- `ApprovalRequest` records the human decision state.

The MVP renders generated patch artifact placeholders separately from matching
local Git diffs so the review surface does not confuse current repository
changes with future generated patch output.

## Artifact Detail States

- `not_generated`: shows an honest placeholder explaining that no patch exists
  yet.
- `generated`: shows stored patch metadata and a read-only preview when
  `rawDiff` exists. If no preview content is stored, it shows a no-preview
  state.
- `failed`: shows the failed artifact state without inventing replacement diff
  content.
- `unavailable`: shows that the artifact cannot be reviewed yet.
- Binary or too-large artifacts use dedicated states and do not inline unsafe or
  oversized content.

Provider artifact paths must match proposed files exactly. Text previews are
accepted only for one matching single-file unified diff. Addition/deletion
counts are derived locally, and raw previews above 64 KiB are discarded while
the too-large review state is retained.

## Validation And Dry-Run

Artifact validation uses these persisted states:

- `not_validated`: generated text exists but has not been checked.
- `valid_structure`: path, size, line count, unified-diff shape, and operation
  checks pass, but a native applicability check was unavailable.
- `invalid_structure`: the artifact violates a path, format, operation, binary,
  size, or line-count rule.
- `dry_run_passed`: native Git reports that the patch can apply to the current
  working tree.
- `dry_run_failed`: native Git reports that the patch does not apply cleanly.
- `unavailable`: no reviewable text exists, or the binary/rename boundary is
  unsupported.

The native dry-run is a dedicated Tauri command. It canonicalizes the selected
Git repository, repeats all structure checks, and invokes only
`git apply --check --whitespace=nowarn -`. Patch content is sent over stdin.
The command exposes no arbitrary Git arguments or shell strings, suppresses raw
Git stderr, and never applies, stages, writes, or commits changes. The separate
application command repeats the same checks before its one permitted write.

Retained patch text is normalized to LF line endings with a terminal newline
and assigned a SHA-256 digest. Generated artifacts persist their current
digest. Validation persists the digest it checked, `validatedAt`, `dryRunAt`
when Git completed the check, and a repository validation snapshot. The
snapshot contains no file contents: only repository ID, branch, short HEAD,
clean state, changed-file count, relevant proposal paths, bounded target-file
fingerprints, and capture time. Existing regular UTF-8 targets up to 256 KiB
receive a content SHA-256; missing, binary, oversized, forbidden, symlink, and
unavailable targets retain typed metadata states instead.

Apply Readiness derives staleness by comparing the current artifact digest with
the validated digest and a freshly recomputed native repository snapshot digest
with the validation snapshot digest. The digest canonically summarizes
repository identity, branch, HEAD, Git state, relevant paths, artifact digest,
and sorted fingerprints. Capture timestamps are excluded so unchanged state
remains comparable. Digest or repository changes produce a blocked state and
require a new validation. Missing native evidence remains explicitly
unavailable; it is not treated as a pass.

Apply readiness is a frontend explanation of existing review state, not a
security decision. Approval does not apply a patch and `dry_run_passed` does not
apply a patch. The native application command independently repeats every
authoritative check described in the patch application safety design, requires
typed confirmation, and applies only persisted patch content.

## Interrupted Application State

Native application records `pending` before an artifact enters `applying` and
stores pre-apply snapshot, fingerprint, digest, Git-status, and backup evidence.
On startup and when a user opens Agent Runs or Approval Review, a read-only
native reconciliation command classifies unfinished records without retrying
the patch.

- Clear reverse-check and target-change evidence repairs state to `applied`.
- A fully unchanged pre-apply state becomes `failed`.
- Missing backup or pre-apply evidence becomes `interrupted`.
- Conflicting or uncertain evidence becomes `needs_inspection`.

Interrupted and needs-inspection artifacts show attempt and backup references
and keep Apply disabled. There is no automatic retry or rollback action.

## Data Model

The shared model lives in `packages/ai`:

- `PersistedProposedChange`
- `ProposedChangeStatus`
- `ProposedChangeFile`
- `ProposedChangeFileOperation`
- `ProposedPatchArtifact`
- `ProposedPatchArtifactStatus`
- `PatchValidationStatus`
- `PatchValidationResult`
- `RepositoryValidationSnapshot`
- `TargetFileFingerprint`
- `PatchApplyStatus`
- `PatchApplyAttemptStatus`
- `PatchApplyAttempt`
- `PatchApplyEvidence`

Applied artifacts persist `appliedAt`, the `local_user` marker, backup ID,
sanitized failure text when applicable, and a post-apply Git status summary.
The proposed change becomes `applied` only after the native Git command exits
successfully and final state persistence succeeds.
