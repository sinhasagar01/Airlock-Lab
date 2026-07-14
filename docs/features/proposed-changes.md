# Proposed Changes Feature

## Purpose

Proposed changes connect agent runs, proposed plans, approval requests, and
future generated patch artifacts without writing files.

This layer is durable review state. It lets the app persist what an agent
expects to change before implementation, patch generation, or approval side
effects exist.

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
- Agent Runs and Approval Review consume persisted proposed-change records while
  keeping the existing structured plan steps, risks, and validation strategy.
- The MVP seed includes one connected demo proposed change,
  `proposal-mvp-shell`, linked to `run-mvp-shell` and
  `approval-provider-rfc`.

## Boundaries

This feature does not:

- Write files
- Apply diffs
- Stage or commit changes
- Run real agent execution

Generated patch artifacts are provider-produced, persisted review contracts
only. Local Git diffs remain separate read-only repository state and must not
be labeled as agent-generated patch diffs.

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

## Data Model

The shared model lives in `packages/ai`:

- `PersistedProposedChange`
- `ProposedChangeStatus`
- `ProposedChangeFile`
- `ProposedChangeFileOperation`
- `ProposedPatchArtifact`
- `ProposedPatchArtifactStatus`
