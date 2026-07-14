# Human Approval

## Purpose

This document defines how human approval works across AI workflows.

Human approval is a core product principle, not a modal dialog added at the end. The system should model approval as durable product state that governs agent runs, tool use, changes, Git actions, and external side effects.

## Core Rule

AI may propose, prepare, analyze, draft, and validate.

Humans approve consequential action.

## Actions That Require Approval

Approval should be required before:

- Starting implementation from a plan
- Writing files
- Deleting files
- Running risky commands
- Modifying Git state
- Changing files outside approved scope
- Sending broad or sensitive context to external providers
- Calling external integrations with side effects
- Creating commits
- Publishing pull requests
- Triggering CI or deployment workflows
- Changing provider, tool, or permission settings in ways that affect safety

## Approval Object

An approval should record:

- Action being approved
- Actor
- Timestamp
- Scope
- Preview shown to the user
- Risks presented
- Files or systems affected
- Tool or workflow requesting approval
- Conditions or limits
- Resulting action status

Approval should be queryable later as part of audit history.

## Approval Types

### Plan Approval

Approves a technical plan as the basis for implementation.

### Tool Approval

Approves a specific tool call or class of tool calls for a bounded run.

### Scope Expansion Approval

Approves work beyond the originally accepted task or plan.

### Change Acceptance

Approves keeping a proposed change after review.

### Git Approval

Approves commits, branch operations, or pull request preparation.

### External Side-Effect Approval

Approves actions that affect external systems.

## Approval Preview

Before approval, the user should see:

- Requested action
- Reason for action
- Scope
- Affected files or systems
- Expected result
- Risks
- Alternatives if relevant
- Whether action is reversible
- What happens next

Approval prompts should be specific, not generic.

## Approval Review Screen

The MVP approval review screen is a durable product surface, not a transient
confirmation dialog.

The review screen should show:

- Approval request title, reason, status, risk, and creation time
- Linked agent run when available
- Linked persisted proposed change when available
- Provider and model metadata when available
- Repository and branch context
- Proposed change plan summary
- Ordered implementation steps
- Expected affected files
- Risk summary
- Validation/check strategy
- Matching local Git diffs when the affected files also appear in Git status
- Decision controls for approve or reject

Approval review should distinguish three related concepts:

- Proposed affected files are plan or approval metadata.
- Generated patch artifacts are persisted provider diff records for proposed
  files. They may exist as `not_generated`, `generated`, `failed`, or
  `unavailable` records.
- Generated text artifacts may carry a structure/dry-run validation status.
  `dry_run_passed` means only that `git apply --check` succeeded against the
  current working tree; it does not apply the patch or grant permission.
- Agent Runs and Approval Review show Apply Readiness gates for the selected
  artifact. Approval state is one input; an approved, dry-run-passed artifact
  becomes eligible only when every remaining native/runtime, repository,
  persistence, path, digest, fingerprint, and staleness gate also passes.
  Validation is bound to
  a normalized SHA-256 artifact digest and a repository snapshot.
  Native validation also records bounded target-file fingerprints and an
  authoritative snapshot digest. If patch content, branch, HEAD, Git state,
  relevant paths, or target fingerprints differ, readiness is blocked until
  validation runs again.
- Current digest and snapshot checks are review evidence, not application
  authorization. The native application command repeats them inside the same
  protected request as the write and requires exact `APPLY PATCH` confirmation.
- `Apply unavailable` remains disabled until every gate passes. Approval alone
  does not enable or trigger application.
- Native startup and review entry reconcile attempts left in `pending` or
  `applying`. Clear applied evidence repairs only durable status; no patch is
  re-applied. Incomplete or conflicting evidence becomes `interrupted` or
  `needs_inspection` and requires manual working-tree review.
- Repository-scoped app-local OS locks and durable lock records prevent two
  processes or review surfaces from applying concurrently. Stale-lock recovery
  never grants permission to bypass an unresolved attempt.
- Fixed Git dry-run and application children terminate after 15 seconds. A
  timeout after application starts is durable `interrupted` evidence, not an
  approval failure and not permission to retry automatically.
- Human approval remains valid review history after an interruption, but it
  does not authorize an automatic retry or rollback.
- Matching local Git diffs are read-only repository diffs for affected files
  that currently appear in Git status.
- Generated patch diffs are persisted provider artifacts, separate from the
  local Git diffs that appear after application.

The MVP can show matching local Git diffs, but it must not claim those diffs
were generated by the agent unless a generated patch artifact explicitly stores
that diff content. Failed, unavailable, and not-generated artifact states should
remain honest state panels without fake replacement diffs.

Approving or rejecting updates approval state and the linked persisted
proposed-change status only. It does not write files, execute patches, or run
Git commands. A later, separately confirmed native Apply Patch action may write
one eligible persisted artifact.

The seeded demo approval, `approval-provider-rfc`, is linked to the seeded
agent run and proposed change so the user can traverse the MVP review path. It
still follows the same boundary: approval changes durable review status only and
does not itself apply or generate code.

## Permission Scope

Approvals should be scoped.

Scope dimensions:

- Time
- Agent run
- Tool
- Repository
- File path
- Command
- External integration
- Action type

The system should avoid broad, indefinite permission grants in early versions.

## Denial And Revision

The user should be able to:

- Deny approval
- Request changes
- Narrow scope
- Add constraints
- Ask for more explanation
- Cancel the workflow

Denial should be treated as useful signal, not failure noise.

## Approval And Agent Runs

Agent runs should pause when approval is needed.

The run should record:

- Why approval was requested
- What was approved or denied
- How the run resumed or stopped

If an agent cannot proceed safely without approval, it should stop.

## Destructive Actions

Destructive actions require the strongest approval behavior.

Examples:

- File deletion
- Overwriting user changes
- Resetting Git state
- Removing branches
- Running destructive shell commands
- Modifying production systems

The system should show clear previews and prefer reversible alternatives.

## External Side Effects

External side effects include:

- Publishing PRs
- Creating issues
- Triggering CI
- Deploying
- Posting comments
- Calling third-party APIs that write data

These should never happen silently.

## MVP Scope

The MVP should support:

- Plan approval
- Implementation approval
- File write approval
- Scope expansion approval
- Change acceptance
- Validation command approval where needed
- Basic approval history

The MVP can defer:

- Organization-wide policies
- Role-based team approvals
- Multi-party approval workflows
- Advanced policy engine

## Success Criteria

Human approval is successful when:

- Users know what they are approving
- Approvals are specific and scoped
- Agents stop at meaningful boundaries
- Approval history can explain what happened
- The system never hides destructive or external side effects
