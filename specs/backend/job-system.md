# Job System

## Status

Draft implementation spec.

## Purpose

This spec defines the MVP job system for long-running and observable operations.

Jobs make scans, provider calls, agent runs, validation commands, and future integration tasks inspectable, cancellable where practical, and visible to the UI.

## Job Principles

- Long-running work should be represented as a job.
- Jobs should emit progress events.
- Jobs should record final status.
- Jobs should be linkable to domain objects.
- Jobs should support cancellation where practical.
- Jobs should not bypass permissions or approvals.

## Job Types

### Repository Scan

Targets:

- Repository

Outputs:

- Snapshot
- Facts
- Index updates
- Scan warnings

### Provider Invocation

Targets:

- Agent run
- Planning request

Outputs:

- Provider response
- Tool call requests
- Errors

### Agent Run

Targets:

- Task
- Plan
- Repository

Outputs:

- Timeline events
- Tool calls
- Artifacts
- Changes
- Summary

### Validation Command

Targets:

- Change
- Task
- Plan

Outputs:

- Validation record
- Command output summary
- Status

## Job Record

Required fields:

- `id`
- `type`
- `status`
- `targetType`
- `targetId`
- `createdAt`
- `startedAt`
- `completedAt`
- `progress`
- `error`
- `cancellable`

## Job Statuses

- `queued`
- `running`
- `awaiting_approval`
- `paused`
- `completed`
- `failed`
- `cancelled`

## Job Events

Events should include:

- Job queued
- Job started
- Progress update
- Approval requested
- Tool requested
- Output produced
- Warning
- Error
- Job completed
- Job cancelled

Events should be streamable to the UI and persisted when meaningful.

## Cancellation

Cancellation should:

- Stop future work where possible.
- Record cancellation status.
- Explain whether partial side effects occurred.
- Preserve partial outputs where useful.

Cancellation may not be possible for already-completed external calls.

## Approval Integration

Jobs must pause when approval is required.

Examples:

- Agent wants to write files.
- Validation wants to run a command.
- Git action is requested.
- External provider context policy needs confirmation.

## MVP Acceptance Criteria

- Repository scan runs as a job.
- Agent run is represented as a job.
- Validation command runs as a job.
- UI can show job progress and final status.
- Jobs can pause for approval.
- Failed jobs expose actionable error information.
