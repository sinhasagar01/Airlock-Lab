# Reasoning Transparency

## Purpose

This document defines what the product should explain about AI-assisted work.

Reasoning transparency does not require exposing private model internals or long chain-of-thought transcripts. It requires useful, reviewable explanations that help humans understand goals, evidence, assumptions, uncertainty, risks, and validation.

## Transparency Goals

The user should be able to answer:

- What is the AI trying to do?
- What context did it use?
- What did it change or recommend?
- Why is that reasonable?
- What assumptions did it make?
- How confident is it?
- What could go wrong?
- What was validated?
- What remains unverified?
- What requires human approval?

## Explanation Types

### Goal Explanation

Every significant AI workflow should state its goal.

Example:

- Generate a technical plan for the approved product task.
- Implement the approved plan within the listed file scope.
- Review the generated change for risks and missing validation.

### Context Explanation

The system should summarize important context used.

Context explanation may include:

- Files
- Docs
- Tasks
- Plans
- Decisions
- Repository facts
- Validation records

The system should avoid pretending it used context it did not inspect.

### Assumption Explanation

Assumptions should be explicit.

Examples:

- This module appears to own repository indexing.
- This command likely runs tests based on package scripts.
- The task scope excludes GitHub integration.

Assumptions should be correctable by the user.

### Confidence Explanation

Confidence should communicate practical trust level.

Confidence should be based on:

- Evidence quality
- Context completeness
- Pattern consistency
- Test or validation results
- Scope complexity
- Known uncertainty

Confidence should not be decorative. If the system cannot assess confidence meaningfully, it should say so.

### Risk Explanation

Risks should be visible before approval and during review.

Risk categories:

- Code correctness
- Architecture fit
- Scope expansion
- Missing tests
- Data loss
- Security
- Privacy
- Provider limitations
- External side effects
- User experience regressions

### Validation Explanation

The system should clearly separate:

- Validation performed
- Validation passed
- Validation failed
- Validation skipped
- Validation recommended but not run

It should not imply confidence from tests that were not executed.

### Output Explanation

AI-generated outputs should include a concise rationale.

For code changes:

- What files changed
- Why they changed
- How the change maps to the plan
- What risks remain
- What validation was run

For plans:

- Why the approach fits existing architecture
- What alternatives exist
- What should be checked before implementation

For reviews:

- What issue was found
- Why it matters
- Where it appears
- How severe it is

## What Not To Expose

The product should not require:

- Raw hidden model chain-of-thought
- Verbose reasoning transcripts
- Provider-specific internal traces
- Unstructured logs presented as explanation

Useful transparency is structured, concise, and tied to user decisions.

## UI Requirements

Reasoning transparency should appear in:

- Plan view
- Agent run view
- Approval prompts
- Diff review
- Validation summary
- PR draft preparation
- Decision capture

The UI should make explanations easy to scan and inspect deeper when needed.

## MVP Scope

The MVP should support:

- Goal summaries
- Context source summaries
- Assumptions
- Confidence notes
- Risk notes
- Validation status
- Changed file rationale
- Approval previews

The MVP can defer:

- Advanced confidence scoring
- Full provenance graph UI
- Cross-run explanation comparison
- Organization-level audit reporting

## Success Criteria

Reasoning transparency is successful when:

- Users can review AI work without guessing what happened
- Risks and uncertainty are visible
- Validation is not overstated
- Explanations are linked to artifacts where practical
- The product feels trustworthy without becoming noisy
