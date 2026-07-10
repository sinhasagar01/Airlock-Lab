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
  future patch artifact slots.
- Proposed files include path, optional old path, operation, reason, risk level,
  and patch artifact status.
- Approval decisions update the linked proposed-change status to `approved` or
  `rejected`.
- Agent Runs and Approval Review consume persisted proposed-change records while
  keeping the existing structured plan steps, risks, and validation strategy.

## Boundaries

This feature does not:

- Generate patches
- Write files
- Apply diffs
- Stage or commit changes
- Run real agent execution

Generated patch artifacts are represented as data contracts only. Local Git
diffs remain separate read-only repository state and must not be labeled as
agent-generated patch diffs.

## Data Model

The shared model lives in `packages/ai`:

- `PersistedProposedChange`
- `ProposedChangeStatus`
- `ProposedChangeFile`
- `ProposedChangeFileOperation`
- `ProposedPatchArtifact`
- `ProposedPatchArtifactStatus`
