# Frontend Routing

## Status

Draft implementation spec.

## Purpose

This spec defines the MVP route structure for the frontend.

Routes should reflect durable workspace objects and allow direct navigation to repositories, tasks, plans, agent runs, changes, documents, and settings.

## Route Principles

- Routes should map to durable objects.
- Active workspace and repository context should remain visible.
- Deep links should open meaningful detail views.
- Pending approvals and active runs should be reachable globally.
- Route names should remain stable as implementation evolves.

## Route Map

### Workspace Home

Path:

```text
/
```

Purpose:

- Workspace overview
- Recent activity
- Registered repositories
- Open tasks
- Active runs
- Pending approvals

### Repositories

Path:

```text
/repositories
```

Purpose:

- List registered repositories
- Register repository
- Select active repository

### Repository Detail

Path:

```text
/repositories/:repositoryId
```

Purpose:

- Repository overview
- Scan status
- Git state
- Documentation summary
- Validation command candidates

### Tasks

Path:

```text
/tasks
```

Purpose:

- Task list
- Create task
- Filter by repository or status

### Task Detail

Path:

```text
/tasks/:taskId
```

Purpose:

- Task fields
- Linked plans
- Linked runs
- Linked changes

### Plan Detail

Path:

```text
/plans/:planId
```

Purpose:

- Technical plan review
- Approval state
- Start implementation run

### Agent Runs

Path:

```text
/runs
```

Purpose:

- Run history
- Active runs
- Failed or paused runs

### Agent Run Detail

Path:

```text
/runs/:runId
```

Purpose:

- Run timeline
- Context sources
- Tool calls
- Outputs
- Approvals

### Changes

Path:

```text
/changes
```

Purpose:

- Proposed and accepted changes
- Review status

### Change Detail

Path:

```text
/changes/:changeId
```

Purpose:

- Diff review
- Risk and validation
- Accept, revise, reject

### Documents

Path:

```text
/documents
```

Purpose:

- Documentation index
- Document graph entry point

### Settings

Path:

```text
/settings
```

Purpose:

- Workspace settings
- Provider configuration
- Permission settings

## Modal Routes

Modal-like surfaces may include:

- Command palette
- Approval prompt
- Create task
- Register repository

Modal state should not prevent direct links to underlying objects.

## Route Guards

Routes should handle:

- Missing object
- Deleted or archived object
- Repository path missing
- Stale scan
- Provider unavailable

## MVP Acceptance Criteria

- Every MVP object has a navigable detail route.
- Refreshing a detail route restores the view.
- Missing objects render useful errors.
- Command palette can navigate to routes.
- Pending approval links route to the requesting object.
