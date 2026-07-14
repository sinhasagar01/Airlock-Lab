# Testing Strategy

## Purpose

This document defines the product-level testing strategy.

Testing in this project must validate not only code behavior, but also AI workflows, provider abstraction, permissions, reviewability, and documentation alignment.

## Testing Principles

- Test critical behavior close to its owner.
- Prefer deterministic tests for domain logic.
- Use integration tests for workflow boundaries.
- Treat provider adapters as replaceable and mockable.
- Validate permission and approval behavior explicitly.
- Do not rely on AI output alone as proof of correctness.
- Record validation gaps honestly.

## Test Layers

### Unit Tests

Unit tests should cover:

- Domain lifecycle rules
- Permission policy logic
- Provider request normalization
- Context ranking helpers
- Risk classification helpers
- Validation state transitions
- Document graph link logic

### Integration Tests

Integration tests should cover:

- Repository indexing flow
- Task to plan workflow
- Plan approval to agent run
- Agent tool request through permission layer
- Provider adapter contract
- Change review workflow
- Validation record creation

### End-To-End Tests

End-to-end tests should cover:

- Opening a workspace
- Selecting a repository
- Viewing repository summary
- Creating a task
- Generating a plan
- Approving an agent run
- Reviewing a change
- Seeing validation results

E2E tests should focus on the core MVP journey first.

### AI Workflow Tests

AI workflow testing should cover:

- Prompt output format
- Structured output parsing
- Provider fallback behavior
- Tool call mediation
- Context package construction
- Approval boundary behavior
- Refusal and failure handling

Where model output is nondeterministic, tests should focus on contracts, schemas, and guardrails.

### Provider Adapter Tests

Provider adapters should be tested against:

- Native configuration unavailable and configured states
- Read-only connection-test success, authentication, model, rate-limit,
  timeout, and unavailable diagnostics
- Diagnostic serialization that excludes credentials, headers, and provider
  response bodies
- Request mapping
- Response normalization
- Error normalization
- Streaming events
- Tool call handling
- Cancellation
- Capability metadata

Adapters should be replaceable without breaking product workflows.

### Permission And Safety Tests

Safety tests should verify:

- File writes require approval
- Destructive actions require approval
- Git writes require approval
- External side effects require approval
- Agents pause on scope expansion
- Tool calls cannot bypass permission policy

These are product-critical tests.

## Validation Strategy

The workspace should help discover and run:

- Typecheck
- Lint
- Unit tests
- Integration tests
- E2E tests
- Build
- Accessibility checks
- Visual checks where applicable

Validation records should capture what ran, what passed, what failed, and what was skipped.

## MVP Testing Scope

The MVP should prioritize tests for:

- Workspace domain objects
- Repository indexing
- Provider abstraction
- Agent run lifecycle
- Permission gates
- Change review state
- Basic validation records
- Core UI workflow smoke tests

## Current Test Harness

The desktop app uses Vitest with jsdom and React Testing Library for MVP smoke
coverage. Tests should prefer visible behavior over component internals.

Current desktop smoke coverage includes:

- Six-tab rendering and sidebar navigation.
- Approval queue actions and pending-count updates.
- Connected demo workflow navigation across Repository Intelligence, Agent
  Runs, Approval Review, and Changes.
- Mock-provider run creation, including the linked durable run, review-only
  proposed change, pending approval, and `not_generated` patch artifacts.
- Safe file preview panel states for no file selected, loading, text preview,
  binary content, too-large files, outside-repository blocking, preview errors,
  and selected-file changes.
- Graceful UI states when native Git status, Git diff, or preview wrappers are
  unavailable.

Tauri filesystem, SQL, dialog, Git, and scan calls should be mocked at the
desktop storage-wrapper boundary in UI tests. Tests must not mock broader
filesystem access or weaken the native safe-preview command contract.

Native Tauri boundary coverage now runs through `npm run test` via the desktop
`test:native` script. Rust tests cover:

- Safe relative path validation for file preview and Git diff paths.
- File preview rejection for traversal and absolute paths outside the selected
  repository.
- Non-Git repository handling for Git status.
- Git diff rejection for traversal, absolute paths, and unsafe old paths.
- Git porcelain parsing for modified, added, deleted, renamed, untracked,
  staged/unstaged/both, and conflicted files.
- Git diff parsing for metadata, hunk, added, removed, context, and binary
  lines.

The MVP can defer:

- Large browser matrix
- Complex performance tests
- Production observability simulation
- Full plugin ecosystem tests

## Success Criteria

The testing strategy is successful when:

- Core workflows can change safely
- Provider swaps are testable
- Permission regressions are caught
- AI workflow contracts are validated
- Validation state is honest
- The product can grow without losing confidence
