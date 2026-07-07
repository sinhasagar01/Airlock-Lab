# Code Quality

## Purpose

This document defines the code quality bar for the project.

The product is intended to become a long-lived AI-native engineering platform. Code quality must support maintainability, velocity, provider independence, safety, and exceptional user experience.

## Core Principles

- Preserve clear module boundaries.
- Keep product logic provider-independent.
- Make domain state explicit.
- Prefer structured data over ad hoc strings.
- Keep AI behavior inspectable.
- Treat permissions as core logic.
- Keep UI polished and accessible.
- Avoid premature abstraction, but do not allow architectural drift.

## Architectural Quality

Code should preserve the boundaries defined in the architecture docs.

Quality signals:

- UI does not call provider SDKs directly
- Provider adapters do not own product workflows
- Tools cannot bypass permission policy
- Repository facts are separated from AI inference
- Validation is modeled separately from implementation
- External integrations sit behind adapters

## Domain Quality

Domain code should make lifecycle states explicit.

Important objects:

- Workspace
- Repository
- Task
- Plan
- Agent run
- Change
- Validation record
- Approval
- Decision

Domain transitions should be understandable and testable.

## AI Quality

AI-related code should:

- Use provider abstractions
- Use structured prompts and outputs where practical
- Record context sources
- Normalize provider errors
- Preserve run history
- Surface uncertainty
- Avoid hidden side effects

Prompts and agent definitions should be versioned and reviewed like product assets.

## UI Quality

The UI should be:

- Fast
- Accessible
- Clear under complex state
- Dense but readable
- Keyboard-friendly
- Consistent with the design system
- Honest about loading, errors, risk, and validation gaps

The product should not hide critical state behind decorative UI.

## Error Handling

Errors should be:

- Typed or classified where practical
- Actionable
- User-understandable
- Preserved in activity or run history when important
- Distinguishable from validation failures
- Distinguishable from provider failures

The system should not collapse all failures into generic AI failure messages.

## Documentation Quality

Code changes should update relevant docs when they alter:

- Product behavior
- Architecture
- Provider behavior
- Agent behavior
- Permissions
- Validation
- User workflows
- Public interfaces

Documentation drift should be treated as quality debt.

## Review Quality

Code review should check:

- Scope alignment
- Architecture boundaries
- Permission behavior
- Provider independence
- Test coverage
- Error states
- UX states
- Documentation impact
- Risk and validation honesty

AI-generated code should receive the same review bar as human code.

## MVP Quality Bar

The MVP may be narrow, but it should not be sloppy.

Required:

- Clear module ownership
- Provider abstraction from day one
- Basic tests for critical domain behavior
- Approval gates for meaningful actions
- Reviewable agent outputs
- Honest validation records
- Polished core workflow UI

Deferrable:

- Full plugin architecture
- Advanced performance tuning
- Full observability stack
- Complex team administration

## Success Criteria

Code quality is successful when:

- The product remains easy to extend
- Provider changes do not cause rewrites
- Safety-critical behavior is testable
- AI workflows are inspectable
- UI states remain clear
- Documentation and implementation stay aligned
