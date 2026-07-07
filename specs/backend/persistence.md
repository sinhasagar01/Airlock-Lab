# Persistence

## Status

Draft implementation spec.

## Purpose

This spec defines MVP local persistence requirements.

Persistence must store durable workspace state, repository metadata, scans, tasks, plans, agent runs, changes, validations, approvals, documents, and activity.

## Persistence Principles

- Store durable domain records locally.
- Keep transient UI state out of persistence.
- Preserve enough history to explain AI-assisted work.
- Version schemas for future migrations.
- Keep provider-specific data behind adapter metadata.
- Avoid storing secrets in plain workspace records.

## Required Record Types

### Workspace

Stores:

- ID
- Name
- Settings
- Active repository ID
- Created and updated timestamps

### Repository

Stores:

- ID
- Workspace ID
- Name
- Path
- Status
- Last scan timestamp

### Repository Snapshot

Stores:

- Repository ID
- Branch
- Commit SHA where available
- Working tree state
- Scan version
- Created timestamp

### Repository Fact

Stores:

- Type
- Claim
- Source
- Evidence
- Confidence
- Freshness

### Task

Stores:

- Task fields
- Status
- Linked repository
- Created and updated timestamps

### Plan

Stores:

- Task ID
- Approach
- Affected areas
- Assumptions
- Risks
- Validation plan
- Status

### Agent Run

Stores:

- Agent ID
- Task ID
- Plan ID
- Status
- Context package ID
- Timeline events
- Outputs
- Summary

### Change

Stores:

- Repository ID
- Run ID
- Changed files
- Diff metadata
- Rationale
- Risk summary
- Status

### Validation Record

Stores:

- Target type and ID
- Command or checklist
- Status
- Output summary
- Gaps
- Timestamp

### Approval

Stores:

- Target type and ID
- Action
- Scope
- Preview
- Risks
- Status
- Resolution

### Activity Event

Stores:

- Actor
- Event type
- Target
- Summary
- Timestamp

## Migration Requirements

- Storage schema must have a version.
- Migrations must be explicit.
- Failed migrations must not silently corrupt workspace state.
- Backups or export should be considered before destructive migrations.

## Index Requirements

The persistence layer should support efficient lookup by:

- Workspace ID
- Repository ID
- Task ID
- Plan ID
- Agent run ID
- Change ID
- Status
- Created timestamp
- Target type and ID

## Data Boundaries

Do not persist:

- Raw provider credentials in domain records
- Hidden model reasoning transcripts
- Large command logs without summarization strategy
- Unbounded file contents unless specifically indexed
- Transient component state

## MVP Acceptance Criteria

- Workspace can be closed and reopened with state intact.
- Repository scan metadata persists.
- Tasks, plans, runs, changes, validations, approvals, and activity persist.
- Schema version exists.
- Domain records are queryable by primary relationships.
