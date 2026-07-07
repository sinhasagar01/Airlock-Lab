# Explainability UX

## Purpose

This document defines how AI reasoning, confidence, context, risk, and validation should appear in the user experience.

Explainability UX should make AI work reviewable without overwhelming the user.

## Core Principle

Explainability should support decisions.

The UI should expose the right explanation at the moment the user needs to approve, review, revise, or trust an AI-assisted action.

## Explanation Layers

### Summary Layer

The summary layer answers:

- What happened?
- What changed?
- What is recommended?
- What needs attention?

This should be concise and visible by default.

### Evidence Layer

The evidence layer answers:

- What files were used?
- What docs were referenced?
- What commands ran?
- What validation passed or failed?

This should be inspectable from summaries.

### Detail Layer

The detail layer answers:

- What assumptions were made?
- What alternatives were considered?
- What risks remain?
- What uncertainty exists?

This should be available without crowding the main workflow.

## Explanation Components

The design system should support:

- Context source list
- Assumption list
- Risk summary
- Confidence indicator
- Validation summary
- Approval preview
- Tool-use timeline
- Changed-files summary
- Documentation-impact summary

## Confidence UX

Confidence should be qualitative and evidence-linked.

Suggested levels:

- High
- Medium
- Low
- Unknown

Confidence should explain why it has that level. It should not be used as decorative scoring.

## Risk UX

Risk should be categorized and actionable.

Risk indicators should show:

- Category
- Severity
- Evidence
- Suggested review focus
- Suggested validation

Risk should not be hidden behind generic warnings.

## Validation UX

Validation UX should distinguish:

- Passed
- Failed
- Not run
- Skipped
- Inconclusive

The UI should avoid implying safety when validation is missing.

## Approval UX

Approval prompts should include:

- Action
- Reason
- Scope
- Affected files or systems
- Risks
- Reversibility
- Next step

Approval should feel like a decision checkpoint, not an interruption.

## MVP Scope

The MVP should include:

- AI action summaries
- Context source lists
- Assumption notes
- Risk summaries
- Validation summaries
- Approval previews
- Changed-file rationale

The MVP can defer:

- Complex provenance graph
- Quantitative confidence model
- Organization audit dashboard
- Advanced explanation comparison across runs

## Success Criteria

Explainability UX is successful when:

- Users understand AI work before accepting it
- Confidence and uncertainty are visible
- Validation gaps are honest
- Risk guides review attention
- Explanation supports speed instead of creating noise
