# Engineering Backlog

## Purpose

This backlog tracks engineering work required to implement the MVP.

## MVP Engineering Epics

### 1. Project Scaffold

### Tasks

- Select application stack.
- Initialize package manager and workspace configuration.
- Create app and package directories.
- Configure TypeScript.
- Configure linting and formatting.
- Configure test runner.
- Configure build scripts.

### Acceptance Criteria

- Repository has runnable development environment.
- Core packages can compile.
- Basic quality commands exist.

### 2. Core Domain Package

### Tasks

- Define workspace types.
- Define repository types.
- Define task and plan types.
- Define agent run types.
- Define change, validation, approval, and activity types.
- Define shared status enums.
- Define shared error categories.

### Acceptance Criteria

- Domain types match MVP specs.
- Package has no UI or provider dependencies.

### 3. Local Persistence

### Tasks

- Select local storage engine.
- Define schema versioning.
- Implement workspace persistence.
- Implement repository metadata persistence.
- Implement task, plan, run, change, validation, approval, and activity persistence.
- Add migration structure.

### Acceptance Criteria

- Workspace can be closed and reopened with state intact.
- Schema version exists.

### 4. Repository Indexing

### Tasks

- Implement file tree scan.
- Implement ignore handling.
- Implement package/script detection.
- Implement documentation discovery.
- Implement Git state read.
- Implement validation command candidates.
- Generate repository facts.

### Acceptance Criteria

- Repository scan produces snapshot, facts, docs, scripts, Git state, and validation candidates.

### 5. Provider Abstraction

### Tasks

- Implement provider request and response types.
- Implement provider adapter contract.
- Implement capability metadata.
- Implement provider error categories.
- Implement initial OMP adapter boundary.
- Implement model routing placeholder.

### Acceptance Criteria

- Agent runtime can call provider through abstraction.
- Product code does not import provider SDKs directly.

### 6. Job System

### Tasks

- Implement job record model.
- Implement job statuses.
- Implement progress events.
- Implement cancellation state.
- Implement approval pause state.
- Wire repository scan as first job.

### Acceptance Criteria

- Long-running work has visible progress and final status.

### 7. Agent Runtime

### Tasks

- Implement agent definitions.
- Implement run creation.
- Implement context package assembly.
- Implement run lifecycle.
- Implement tool call mediation placeholder.
- Implement run timeline.

### Acceptance Criteria

- A run can move through created, preparing, awaiting approval, running, paused, completed, failed, and cancelled states.

### 8. Frontend App Shell

### Tasks

- Implement app shell layout.
- Implement primary navigation.
- Implement repository switcher.
- Implement command palette foundation.
- Implement pending approval indicator.
- Implement active run indicator.

### Acceptance Criteria

- User can navigate core MVP surfaces.
- Active workspace and repository are visible.

### 9. MVP Product Surfaces

### Tasks

- Workspace home.
- Repository overview.
- Task detail.
- Plan detail.
- Agent run detail.
- Change review.
- Documents index.

### Acceptance Criteria

- MVP user journey can be completed in UI using real or stubbed services.

### 10. Validation And Quality

### Tasks

- Add unit tests for core domain.
- Add integration tests for repository indexing.
- Add provider abstraction tests.
- Add permission and approval tests.
- Add frontend smoke tests.

### Acceptance Criteria

- Critical domain and workflow behavior has test coverage.
