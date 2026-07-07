# Core Package

## Purpose

`packages/core` owns shared product domain types, lifecycle rules, and domain utilities.

It should be independent of frontend UI, provider SDKs, filesystem implementation, and external integrations.

## Responsibilities

- Workspace types
- Repository types
- Task types
- Plan types
- Agent run types
- Change types
- Validation record types
- Approval types
- Decision and activity event types
- Domain status enums
- Domain lifecycle helpers
- Shared error types

## Must Not Own

- React components
- Provider SDK calls
- Filesystem scanning
- Git command execution
- Persistence engine implementation
- External integration clients

## Dependency Rules

`packages/core` should have minimal dependencies.

Allowed:

- Type utilities
- Schema validation library if selected

Avoid:

- UI libraries
- Provider SDKs
- Node-only filesystem APIs unless abstracted
- App-specific routing

## MVP Exports

Expected exports:

- `Workspace`
- `Repository`
- `RepositorySnapshot`
- `RepositoryFact`
- `Task`
- `Plan`
- `AgentRun`
- `Change`
- `ValidationRecord`
- `Approval`
- `ActivityEvent`
- Shared status enums
- Shared error categories

## Acceptance Criteria

- UI, backend services, AI package, and indexing package can share domain types.
- Core package does not import UI or provider SDKs.
- Domain status names match product specs.
