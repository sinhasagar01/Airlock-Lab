# AI Explanation Patterns

## Purpose

This document defines reusable design patterns for AI explanations.

AI explanations should help users review, trust, revise, or reject AI-assisted work.

## Explanation Pattern Principles

- Explain for a decision, not for spectacle.
- Keep summaries short and inspectable.
- Link claims to sources where practical.
- Distinguish facts, inference, and recommendations.
- Show uncertainty and validation gaps.
- Avoid exposing raw hidden model reasoning.

## Pattern Types

### AI Summary

Used to summarize AI output.

Should include:

- Goal
- Result
- Important changes
- Next action

### Context Sources

Used to show what the AI used.

Should include:

- Files
- Docs
- Tasks
- Plans
- Decisions
- Validation records

Sources should be clickable where possible.

### Assumptions

Used to show inferred context.

Assumptions should be:

- Explicit
- Correctable
- Linked to evidence where possible

### Confidence

Used to communicate trust level.

Preferred values:

- High
- Medium
- Low
- Unknown

Confidence should include a reason.

### Risk Summary

Used to focus review.

Should include:

- Category
- Severity
- Evidence
- Suggested review area
- Suggested validation

### Validation Summary

Used to show verification state.

Should distinguish:

- Passed
- Failed
- Not run
- Skipped
- Inconclusive

### Tool Timeline

Used to show agent activity.

Events may include:

- Context gathered
- Provider called
- Tool requested
- Approval requested
- File changed
- Validation run
- Run completed

### Documentation Impact

Used to show docs likely affected by a change.

Should include:

- Document
- Reason
- Suggested update
- Review action

## MVP Scope

The MVP should include:

- AI summary
- Context source list
- Assumptions
- Risk summary
- Validation summary
- Tool timeline
- Changed-file rationale

The MVP can defer:

- Rich provenance graph
- Cross-run comparison
- Advanced confidence calibration
- Organization-level explanation audit

## Success Criteria

AI explanation patterns are successful when:

- Users can quickly understand AI work
- Explanations guide review
- Source context is inspectable
- Uncertainty is visible
- The UI remains calm and scannable
