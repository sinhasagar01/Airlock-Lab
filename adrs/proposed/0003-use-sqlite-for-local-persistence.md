# ADR 0003: Use SQLite For Local Workspace Persistence

## Status

Proposed.

## Context

The product is local-first. The MVP must persist workspace state, repository metadata, repository scans, facts, tasks, plans, agent runs, changes, validation records, approvals, activity events, jobs, and job events.

The persistence layer must support:

- Durable local data.
- Relational queries between core workspace objects.
- Schema versioning and migrations.
- Efficient lookup by workspace, repository, task, plan, run, change, status, and timestamp.
- A path to future sync without replacing the local domain model.

The technical spike recommends SQLite with a typed schema and migration layer.

## Decision

Use SQLite as the MVP local persistence engine.

Use a typed schema and migration layer from the beginning. Drizzle is the leading candidate, pending a short compatibility check with the selected Tauri SQLite integration.

## Stored Data

SQLite should store:

- Workspace records.
- Repository metadata.
- Repository snapshots.
- Repository facts.
- Document index metadata.
- Tasks.
- Plans.
- Agent runs.
- Changes.
- Validation records.
- Approvals.
- Jobs.
- Job events.
- Activity events.

SQLite should not store:

- Provider secrets in ordinary domain tables.
- Hidden model reasoning.
- Unbounded raw file contents.
- Large command logs without retention strategy.
- Transient UI state.

## Consequences

### Positive

- Strong fit for local-first desktop software.
- Single-file local persistence model.
- Transactional and durable.
- Supports relational queries across workspace objects.
- Works well for indexed local product state.
- Gives a practical path to schema migrations.

### Negative

- Requires schema discipline early.
- Index and event data can grow without retention rules.
- Driver and migration tooling must be validated inside the Tauri runtime.

### Neutral Or Tradeoffs

- A typed ORM or query builder improves developer experience but must not hide important SQL behavior.
- Raw SQL escape hatches should remain available for performance-sensitive queries.
- Future cloud sync should layer over local domain objects rather than replace them.

## Alternatives Considered

### Filesystem JSON

Rejected as the main persistence engine because the workspace needs relational queries, migrations, and durable event history. JSON may still be useful for exports or simple config files.

### Embedded Document Store

Rejected for MVP because the core object relationships are explicit and relational.

### Hosted Database

Rejected for MVP because local-first behavior is central to trust, speed, and privacy.

## Implementation Notes

- Define a schema version table from day one.
- Add explicit migrations.
- Keep persistence behind service interfaces.
- Do not let UI components read or write SQLite directly.
- Persist job events carefully and add retention policy later.
- Keep provider credentials outside ordinary workspace tables.

## Related Documents

- [Technical Spikes](../../tasks/research/technical-spikes.md)
- [Persistence Spec](../../specs/backend/persistence.md)
- [Workspace Model](../../docs/architecture/workspace-model.md)
- [Local-First Architecture](../../docs/architecture/local-first-architecture.md)
- [Core Package](../../packages/core/README.md)
