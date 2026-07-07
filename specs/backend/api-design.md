# Backend API Design

## Status

Draft implementation spec.

## Purpose

This spec defines the internal API design for application services.

The MVP may run locally in one process, but it should still use clear service boundaries so UI, domain logic, persistence, indexing, jobs, AI providers, and tools do not become tangled.

## API Principles

- Product APIs expose domain commands and queries.
- UI should call application services, not persistence directly.
- Provider adapters sit behind AI service APIs.
- Tool execution sits behind permission APIs.
- Long-running operations are jobs with progress events.
- API responses should be typed and structured.

## Service Areas

### Workspace Service

Commands:

- Create workspace
- Open workspace
- Update workspace settings
- Set active repository

Queries:

- Get workspace
- List activity
- Get dashboard summary

### Repository Service

Commands:

- Register repository
- Rescan repository
- Refresh Git state

Queries:

- List repositories
- Get repository
- Get repository snapshot
- List repository facts
- Get validation candidates

### Task Service

Commands:

- Create task
- Update task
- Archive task
- Generate task draft

Queries:

- List tasks
- Get task
- List linked plans, runs, changes

### Planning Service

Commands:

- Generate plan
- Update plan
- Approve plan
- Reject plan

Queries:

- Get plan
- List plans for task

### Agent Service

Commands:

- Create run
- Start run
- Pause run
- Cancel run
- Resume run
- Submit user input

Queries:

- List runs
- Get run
- Get run timeline
- Get run outputs

### Approval Service

Commands:

- Request approval
- Approve
- Deny
- Cancel approval

Queries:

- List pending approvals
- Get approval
- List approvals for target

### Change Service

Commands:

- Create change record
- Request revision
- Accept change
- Reject change

Queries:

- List changes
- Get change
- Get diff summary

### Validation Service

Commands:

- Create validation plan
- Run validation command
- Record manual validation

Queries:

- List validation records
- Get validation record

### AI Provider Service

Commands:

- Invoke model
- Stream model
- Cancel invocation

Queries:

- List providers
- List models
- Get provider health

### Job Service

Commands:

- Start job
- Cancel job
- Retry job

Queries:

- Get job
- Subscribe to job events
- List active jobs

## Error Model

APIs should return normalized errors:

- `not_found`
- `invalid_input`
- `permission_required`
- `approval_required`
- `conflict`
- `stale_state`
- `provider_error`
- `job_failed`
- `filesystem_error`
- `git_error`
- `unknown`

Errors should include a user-facing summary and developer-facing metadata.

## MVP Acceptance Criteria

- UI can complete the MVP flow through service APIs.
- Long-running scans and agent runs are represented as jobs.
- Provider errors are normalized before reaching UI.
- Approval-required actions return explicit approval state.
- Persistence details do not leak into UI components.
