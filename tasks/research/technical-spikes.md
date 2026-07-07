# Technical Spikes

## Purpose

This document records the MVP technical spike recommendations.

Each spike answers a specific implementation question and produces a recommendation that can guide the first implementation scaffold.

## Recommendation Summary

| Spike | Recommendation |
| --- | --- |
| Application stack | Tauri 2 + React + TypeScript + Vite |
| Local persistence | SQLite with a typed schema/migration layer |
| Repository indexing | Custom local indexer first, structured parser hooks later |
| Provider runtime integration | Provider abstraction with mock adapter first, then thin OMP adapter |
| Diff and change review | Git raw diff parsing plus CodeMirror-based review surface |
| Job and progress events | Local persisted job/event log with in-memory live subscription |

## Research Notes

Sources checked:

- [Tauri](https://tauri.app/)
- [Electron docs](https://www.electronjs.org/docs/latest/)
- [SQLite overview](https://www.sqlite.org/about.html)
- [Drizzle ORM overview](https://orm.drizzle.team/docs/overview)
- [CodeMirror](https://codemirror.net/)
- [TanStack Router](https://tanstack.com/router/latest)
- [TanStack Query](https://tanstack.com/query/latest/docs/framework/react/overview)

## 1. Application Stack

### Question

Which application stack should power the local-first MVP?

### Recommendation

Use Tauri 2 with React, TypeScript, Vite, TanStack Router, and TanStack Query.

### Rationale

The product is local-first, repository-aware, permission-sensitive, and UI-heavy. Tauri fits the product direction because it is designed for small, fast, secure cross-platform apps and supports web frontends with system integration through Rust. It gives us a desktop app path without making Chromium and Node the default runtime boundary.

React and TypeScript match the builder’s strengths and are the fastest path to a high-quality product surface. Vite keeps development fast. TanStack Router gives type-safe app routing, and TanStack Query is a strong fit for async service state such as repository scans, agent runs, validations, and job status.

### Why Not Electron First

Electron remains a proven choice for cross-platform desktop apps and would be a reasonable fallback if Tauri blocks critical workflows. However, Electron embeds Chromium and Node into the app binary, which is heavier and creates a broader runtime surface than the MVP needs.

### Architecture Shape

- `apps/desktop`: Tauri shell and frontend app.
- `packages/ui`: React design-system primitives.
- `packages/core`: shared domain types.
- `packages/indexing`: repository scanning logic.
- `packages/ai`: provider abstraction and agent contracts.
- Tauri commands expose local capabilities to the frontend through explicit command boundaries.

### Risks

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Rust/Tauri learning curve | Slower initial setup | Keep Rust layer thin in MVP |
| Tauri plugin/API constraints | May affect filesystem/process needs | Spike filesystem, shell, and SQLite integration early |
| Webview differences | UI rendering inconsistencies | Visual QA on macOS first, then Windows/Linux later |

### Follow-Up Tasks

- Create a Tauri + React + TypeScript spike app.
- Verify local filesystem repository selection.
- Verify command execution approval path.
- Verify SQLite access from Tauri side.
- Verify app packaging assumptions.

## 2. Local Persistence Engine

### Question

What local storage engine should store workspace state and indexes?

### Recommendation

Use SQLite as the MVP persistence engine with a typed schema and migration layer.

### Rationale

SQLite is a strong fit for local-first software. It is single-file, zero-configuration, transactional, durable, and widely deployed. The workspace needs relational queries across repositories, tasks, plans, runs, changes, validations, approvals, documents, and activity events, which maps naturally to SQLite.

Use a typed TypeScript schema layer such as Drizzle after a short implementation check. Drizzle supports SQLite and keeps schema/query code close to TypeScript without forcing a heavy framework model.

### Data Layout

Store:

- Workspace records
- Repository metadata
- Repository snapshots
- Repository facts
- Document index
- Tasks
- Plans
- Agent runs
- Changes
- Validation records
- Approvals
- Jobs and job events
- Activity events

Do not store:

- Provider secrets in ordinary domain tables
- Hidden model reasoning
- Unbounded raw file contents
- Large command logs without retention strategy

### Risks

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Schema churn during MVP | Migration friction | Keep schema versioned from day one |
| Index data grows quickly | Performance and file size issues | Store summaries and metadata first; add retention policy |
| ORM abstraction mismatch | Slower low-level tuning | Keep SQL escape hatch available |

### Follow-Up Tasks

- Choose SQLite driver compatible with Tauri.
- Prototype schema migrations.
- Define MVP tables.
- Test read/write from app shell.
- Add export/backup consideration to persistence spec.

## 3. Repository Indexing Approach

### Question

How should MVP repository indexing be implemented?

### Recommendation

Implement a custom local indexer first, using structured parsers and ecosystem-specific detectors where practical. Defer full language-server integration and semantic code graph.

### Rationale

The MVP needs reliable observed facts more than deep semantic intelligence. A custom indexer can quickly produce file tree, package/script, documentation, Git, and validation facts while preserving control over privacy, exclusions, and fact classification.

Start with TypeScript/JavaScript repository support because it aligns with the likely implementation stack and the builder’s expertise.

### MVP Indexing Scope

Index:

- File tree
- Ignored paths
- Package manifests
- Scripts
- Dependencies
- Documentation files
- Test files
- Git status
- Validation command candidates
- Repository facts

Defer:

- Full call graph
- Full symbol graph
- Language server integration
- Cross-repository indexing
- Background file watching

### Implementation Shape

- `packages/indexing` owns scan logic.
- Repository service owns persistence of scan results.
- Context engine consumes repository facts.
- AI summaries must cite index facts and classify inference.

### Risks

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Shallow understanding | Weak planning context | Combine facts with selected source excerpts |
| Slow scans | Poor UX | Respect ignores and add incremental scans later |
| Secret exposure | Privacy issue | Exclude sensitive paths and add secret detection spike |

### Follow-Up Tasks

- Implement filesystem scan prototype.
- Implement `package.json` script detection.
- Implement docs discovery.
- Implement Git status reader.
- Generate first repository facts.

## 4. Provider Runtime Integration

### Question

How should the first provider adapter integrate OMP while preserving provider independence?

### Recommendation

Implement the provider abstraction and a mock provider adapter first, then implement a thin OMP adapter behind the same interface.

### Rationale

The product principle is clear: OMP is not the product. Building the internal provider contract against a mock first forces product workflows to depend on the abstraction, not OMP behavior. The OMP adapter can then map internal requests, responses, tool calls, and errors to OMP-specific behavior.

### MVP Provider Order

1. Define provider request and response types.
2. Implement mock provider for deterministic tests and UI development.
3. Implement capability metadata.
4. Implement normalized provider errors.
5. Implement thin OMP adapter.
6. Add routing intent placeholder.

### Required Boundaries

- UI never imports OMP or provider SDKs.
- Agent runtime calls provider service.
- Tool calls return to the permission layer before execution.
- Provider errors are normalized before reaching the UI.

### Risks

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Mock diverges from real provider | Integration surprises | Add adapter contract tests |
| OMP assumptions leak | Architecture debt | Keep OMP-specific code in adapter folder |
| Tool calls bypass permission | Safety issue | Runtime owns tool mediation |

### Follow-Up Tasks

- Write provider contract tests.
- Implement mock provider.
- Define OMP adapter interface.
- Validate one planning workflow through mock provider.
- Validate one planning workflow through OMP adapter.

## 5. Diff And Change Review Surface

### Question

What should power the MVP diff review experience?

### Recommendation

Use Git raw diff parsing for the MVP data source and build a review surface on top of CodeMirror when interactive code viewing becomes necessary.

### Rationale

The MVP needs reviewability before it needs a full IDE-grade editor. Git diffs provide the canonical change source. A simple parsed diff view can support changed files, hunks, additions, deletions, and comments. CodeMirror is a strong candidate for richer review UI because it is an extensible web code editor with accessibility and keyboard support.

Avoid Monaco as the default first choice unless the MVP needs VS Code-like editor behavior early. It is powerful, but heavier than the first review surface likely needs.

### MVP Diff Scope

Support:

- Changed file list
- File status
- Hunk display
- Added and removed lines
- Large diff warning
- Binary/generated file handling
- Risk and validation side panel

Defer:

- Inline commenting
- Rich merge conflict resolution
- Full editor mode
- Multi-file patch editing

### Risks

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Custom diff UI underpowered | Review friction | Keep path open to CodeMirror review surface |
| Large diffs slow rendering | UX issue | Add file and hunk virtualization later |
| Accessibility gaps | Review quality issue | Use semantic line rendering and keyboard navigation |

### Follow-Up Tasks

- Parse `git diff --no-ext-diff` output.
- Render file and hunk list.
- Add large diff guard.
- Prototype CodeMirror read-only file view.
- Define change review component API.

## 6. Job And Progress Event Model

### Question

How should long-running jobs report progress to the UI?

### Recommendation

Use a local persisted job/event log as the source of truth, with an in-memory subscription layer for live UI updates.

### Rationale

Repository scans, agent runs, provider calls, and validation commands need visible progress and replayable history. Pure in-memory events are simple but disappear on restart. Fully stream-based infrastructure is more than the MVP needs. A persisted job/event model gives durability, while in-memory subscriptions keep the UI responsive.

### Job Model

Jobs:

- Repository scan
- Provider invocation
- Agent run
- Validation command

Statuses:

- Queued
- Running
- Awaiting approval
- Paused
- Completed
- Failed
- Cancelled

Events:

- Created
- Started
- Progress
- Approval requested
- Tool requested
- Output produced
- Warning
- Error
- Completed
- Cancelled

### Risks

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Event log grows too large | Storage bloat | Add retention and summarization |
| Live events and persisted state diverge | UI inconsistency | Persist first, then publish event |
| Cancellation semantics unclear | User confusion | Record whether partial side effects occurred |

### Follow-Up Tasks

- Define job and job event tables.
- Implement job service interface.
- Implement in-memory subscription.
- Wire repository scan as first job.
- Add job status UI component.

## Implementation Order

Recommended first build sequence:

1. Scaffold Tauri + React + TypeScript app.
2. Create package workspace.
3. Implement `packages/core` domain types.
4. Add SQLite persistence proof of concept.
5. Implement repository registration and scan job.
6. Implement repository overview UI.
7. Implement provider abstraction with mock provider.
8. Implement task and plan flows.
9. Implement agent run lifecycle with mock provider.
10. Add OMP adapter.

## Decisions To Promote

These recommendations should become ADRs before implementation:

- Application stack decision.
- Local persistence decision.
- Provider abstraction implementation sequence.

Repository indexing may become an accepted RFC after the first prototype validates the approach.
