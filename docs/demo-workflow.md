# Demo Workflow

## Purpose

The MVP includes one connected safe demo workflow so the product can show the
full review path before real agent execution or patch generation exists.

The visible path is:

1. Selected repository
2. Indexed repository intelligence
3. Agent run
4. Persisted proposed change
5. Approval review
6. Generated patch artifact states
7. Matching local Git diff review
8. Approve or reject

## Seeded Objects

The demo workflow is seeded from durable local models:

- Agent run: `run-mvp-shell`
- Proposed change: `proposal-mvp-shell`
- Approval request: `approval-provider-rfc`
- Repository: `repo-workspace` when the workspace seed is used
- Proposed files with generated patch artifact records

Saved approval and proposed-change rows are preserved when present. Missing
seed rows are merged back in so a fresh or older local database still has the
connected demo path.

## What Is Real

- Repository selection and saved repository loading are real local state.
- Repository Intelligence is derived from indexed file facts and repository
  metadata.
- Git status and local Git diff preview are read-only native Git queries
  bounded to the selected repository.
- Approval approve/reject updates are persisted and update the linked proposed
  change status.

## What Is Seeded

- The demo agent run is seeded; it is not produced by a provider call.
- The proposed change is seeded persisted review metadata.
- Generated patch artifact records are seeded placeholders or demo records.
- Stored generated artifact preview content is sample/demo data and must remain
  visually separate from local Git diffs.

## Not Implemented Yet

The demo workflow does not:

- Run a real agent
- Generate patches
- Write files
- Apply patches
- Stage, reset, checkout, commit, clean, or otherwise mutate Git state
- Claim local Git diffs were produced by the seeded proposed change

## UI Surfaces

- Repository Intelligence shows a `Demo workflow` card with a `Continue review
  workflow` action.
- Agent Runs marks the connected run as `demo workflow`, shows the linked
  proposal and approval, and links to approval review or local diff inspection.
- Approval Review marks the connected request and shows proposed change,
  generated patch artifact states, matching local Git diff availability, and
  approve/reject controls.
- Changes marks local changed-file rows as `matches approval` only when the path
  exactly matches a proposed affected file.
