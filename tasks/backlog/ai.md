# AI Backlog

## Purpose

This backlog tracks AI system, prompt, provider, agent, context, and evaluation work required for the MVP.

## MVP AI Epics

### 1. Provider Abstraction

### Tasks

- Implement provider request shape.
- Implement provider response shape.
- Implement capability metadata.
- Implement error normalization.
- Implement OMP adapter boundary.
- Implement model routing placeholder.

### Acceptance Criteria

- AI workflows do not call OMP directly.
- Provider failures are normalized.

### 2. Context Protocol

### Tasks

- Implement context package type.
- Implement context source classification.
- Implement repository fact inclusion.
- Implement task and plan inclusion.
- Implement documentation source inclusion.
- Implement source summary display.

### Acceptance Criteria

- Agent runs can record and display context sources.
- Facts and inference are separated.

### 3. Agent Definitions

### Tasks

- Define orchestrator.
- Define planner.
- Define executor.
- Define reviewer.
- Define specialist prompt usage.
- Define stop conditions.

### Acceptance Criteria

- Core agents have clear roles, inputs, outputs, and boundaries.

### 4. Planning Workflow

### Tasks

- Build task-to-plan prompt.
- Define output schema.
- Include affected areas, risks, assumptions, and validation.
- Add review and approval requirements.

### Acceptance Criteria

- Generated plan is reviewable and approval-ready.

### 5. Implementation Workflow

### Tasks

- Build approved-plan-to-run workflow.
- Define file write approval behavior.
- Define scope expansion pause.
- Define final summary format.
- Define changed file reporting.

### Acceptance Criteria

- Agent implementation is bounded and inspectable.

### 6. Review Workflow

### Tasks

- Build change review prompt.
- Include scope, architecture, safety, validation, and docs checks.
- Use quality and safety rubrics.

### Acceptance Criteria

- Reviewer output helps user accept, revise, or reject changes.

### 7. Evaluation

### Tasks

- Apply quality rubric to generated plans.
- Apply safety rubric to agent runs and prompts.
- Create initial regression examples.
- Record user corrections as improvement signals.

### Acceptance Criteria

- AI outputs can be reviewed against explicit quality and safety standards.
