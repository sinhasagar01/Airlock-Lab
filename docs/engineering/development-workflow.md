# Development Workflow

## Purpose

This document defines the expected development workflow for the AI-native engineering workspace.

The workflow is designed to preserve product clarity, architecture quality, human control, and documentation alignment.

## Standard Workflow

### 1. Define Intent

Start with a task, product doc, issue, or explicit user request.

Clarify:

- Goal
- User value
- Scope
- Non-goals
- Acceptance criteria

### 2. Gather Context

Read relevant:

- Product docs
- Architecture docs
- Specs
- ADRs
- RFCs
- Playbooks
- Existing code

### 3. Plan

For non-trivial work, create or update a technical plan.

The plan should include:

- Affected areas
- Approach
- Risks
- Validation
- Documentation impact

### 4. Implement

Keep implementation scoped.

Preserve:

- Module boundaries
- Provider abstraction
- Permission boundaries
- Local-first assumptions
- UX state requirements

### 5. Validate

Run relevant checks.

Examples:

- Typecheck
- Lint
- Unit tests
- Integration tests
- Build
- Manual review
- Documentation link checks where practical

If validation cannot run, document the gap.

### 6. Review

Review against:

- Task scope
- Approved plan
- Architecture boundaries
- Safety
- UX states
- Tests
- Documentation impact

### 7. Document

Update docs when work changes:

- Product behavior
- Architecture
- Specs
- Prompts
- Agent behavior
- Playbooks
- Public workflows

### 8. Commit And Push

Commit focused changes with a clear message.

Push after confirming:

- Branch is correct.
- Worktree contains intended changes.
- No unrelated user work is included.

## AI-Assisted Workflow Rules

When AI helps:

- Keep work bounded.
- Record assumptions.
- Review generated changes.
- Validate before accepting.
- Do not allow destructive actions without approval.
- Do not treat AI output as automatically correct.

## Documentation-First Rule

If a change affects durable product or architecture behavior, update documentation before or alongside implementation.

## Success Criteria

The workflow is successful when:

- Contributors know what to build and why.
- Changes stay scoped.
- Quality is validated.
- Documentation remains aligned.
- Git history remains understandable.
