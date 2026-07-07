# Git Workflows

## Purpose

This document defines how the workspace should interact with Git.

Git is infrastructure for change management. It is not the product. The workspace should expose Git state and support Git workflows while preserving human control.

## Core Principle

The workspace may analyze Git state and prepare Git actions, but it should not modify Git state without explicit approval.

## Git State

The workspace should display:

- Current branch
- Working tree status
- Staged files
- Unstaged files
- Untracked files
- Recent commits
- Remote status where available
- Files changed by agent runs

Git state should be refreshed before meaningful actions.

## Read-Only Git Operations

Read-only operations may include:

- Status
- Diff
- Log
- Branch list
- Remote metadata
- File history
- Blame where useful

These should be safe by default, though expensive operations may still need user awareness.

## Write Git Operations

Write operations require approval.

Examples:

- Stage files
- Unstage files
- Create commit
- Create branch
- Switch branch
- Merge
- Rebase
- Reset
- Stash
- Push
- Tag

Riskier operations should receive stronger previews and may require additional confirmation.

## AI-Assisted Git Behavior

AI may help:

- Explain current Git state
- Summarize diffs
- Suggest commit grouping
- Draft commit messages
- Identify unrelated changes
- Warn about risky operations
- Prepare PR summaries

AI should not silently stage, commit, reset, or push.

## Change Ownership

The workspace should distinguish:

- User-authored changes
- Agent-authored changes
- Pre-existing dirty worktree changes
- Generated files
- Validation artifacts

This distinction matters for review and safety.

Agents must not overwrite unrelated user changes.

## Commit Preparation

Commit preparation should include:

- Selected files
- Diff summary
- Linked task or plan
- Validation status
- Risk notes
- Suggested commit message
- Approval prompt

The user should choose what gets committed.

## Destructive Git Actions

Destructive actions require strong approval.

Examples:

- Reset hard
- Clean untracked files
- Force push
- Rebase public branch
- Delete branch
- Checkout that overwrites local changes

The workspace should prefer non-destructive alternatives and clear previews.

## MVP Scope

The MVP should support:

- Git status display
- Diff retrieval
- Changed file tracking
- AI diff summary
- Commit message drafting
- Approval before Git writes

The MVP can defer:

- Full branch management
- Push flows
- Conflict resolution UI
- Remote PR publishing
- Advanced history analysis

## Success Criteria

Git workflows are successful when:

- Users understand working tree state
- Agent changes are distinguishable
- Commit preparation is reviewable
- Destructive actions are never hidden
- Git remains a governed workflow, not an accidental side effect
