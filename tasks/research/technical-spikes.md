# Technical Spikes

## Purpose

This document tracks research spikes needed before or during MVP implementation.

Spikes should answer specific technical questions and produce a recommendation, not become open-ended exploration.

## Spike Template

Each spike should define:

- Question
- Context
- Options
- Evaluation criteria
- Recommendation
- Risks
- Follow-up tasks

## MVP Spikes

### 1. Application Stack

### Question

Which application stack should power the local-first MVP?

### Options

- Desktop-first app shell.
- Web app with local backend.
- Hybrid local app architecture.

### Evaluation Criteria

- Local filesystem access.
- Developer experience.
- UI velocity.
- Packaging complexity.
- Long-term extensibility.

### Output

Architecture recommendation and initial setup plan.

### 2. Local Persistence Engine

### Question

What local storage engine should store workspace state and indexes?

### Options

- SQLite.
- Embedded document store.
- Filesystem JSON with migration layer.

### Evaluation Criteria

- Reliability.
- Query support.
- Migration support.
- Portability.
- Developer experience.

### Output

Persistence recommendation and schema strategy.

### 3. Repository Indexing Approach

### Question

How should MVP repository indexing be implemented?

### Options

- Custom filesystem scanner.
- Existing parser/indexing libraries.
- Language-server-assisted indexing.

### Evaluation Criteria

- Speed.
- Accuracy.
- Complexity.
- Extensibility.
- Cross-platform behavior.

### Output

Indexing implementation plan.

### 4. Provider Runtime Integration

### Question

How should the first provider adapter integrate OMP while preserving provider independence?

### Options

- Thin OMP adapter.
- OMP-backed local service.
- Provider abstraction with mock adapter first.

### Evaluation Criteria

- Boundary cleanliness.
- Implementation speed.
- Testability.
- Future provider support.

### Output

Initial provider adapter plan.

### 5. Diff And Change Review Surface

### Question

What should power the MVP diff review experience?

### Options

- Existing diff viewer library.
- Custom lightweight diff rendering.
- Git-based raw diff display first.

### Evaluation Criteria

- Review quality.
- Implementation effort.
- Large diff handling.
- Accessibility.

### Output

Diff review implementation recommendation.

### 6. Job And Progress Event Model

### Question

How should long-running jobs report progress to the UI?

### Options

- In-memory event emitter.
- Local persisted event log.
- Stream-based job service.

### Evaluation Criteria

- Simplicity.
- Reliability.
- Replayability.
- UI responsiveness.

### Output

MVP job event model.
