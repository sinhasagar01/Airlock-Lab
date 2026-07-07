# Change Risk Analysis

## Purpose

This document defines how the workspace should evaluate the risk of proposed changes.

Risk analysis helps users decide what to inspect, validate, document, and approve.

## Core Principle

Risk analysis should be evidence-informed and humble.

The system should identify risk signals and explain uncertainty. It should not pretend to guarantee safety.

## Risk Categories

### Scope Risk

The change may exceed the approved task or plan.

Signals:

- Files outside expected areas changed
- New behavior introduced beyond requirements
- Multiple unrelated concerns changed
- Task and diff do not align

### Architecture Risk

The change may violate module boundaries or architectural decisions.

Signals:

- Cross-boundary imports
- Provider-specific logic outside adapter
- UI code owning domain behavior
- Persistence leaking into workflows
- Existing ADRs or architecture docs contradicted

### Code Correctness Risk

The change may be logically incorrect.

Signals:

- Complex conditional changes
- Error handling removed
- Edge cases not covered
- Type errors
- Test failures
- Unclear data flow

### Test Risk

The change may lack sufficient validation.

Signals:

- No relevant tests run
- Tests failed
- No tests cover changed behavior
- Validation command unknown
- Manual verification missing

### UX Risk

The change may degrade user experience.

Signals:

- UI workflow changed
- Approval state changed
- Error or empty state changed
- Accessibility concerns
- Layout or interaction risk

### Security And Privacy Risk

The change may expose sensitive data or weaken safeguards.

Signals:

- Secret handling changed
- Provider context behavior changed
- Permission boundaries changed
- External API behavior changed
- Destructive action path changed

### Git Risk

The change may interact badly with working tree state.

Signals:

- Pre-existing dirty files
- Unrelated files included
- Generated files mixed with source changes
- Conflict-prone changes
- Destructive Git action requested

## Risk Inputs

Risk analysis may use:

- Task scope
- Approved plan
- Changed files
- Diff
- Module boundaries
- Documentation graph
- ADRs
- Test results
- Typecheck results
- Git status
- Agent run history
- User feedback

## Risk Output

Risk output should include:

- Risk level
- Risk category
- Evidence
- Affected files or systems
- Reasoning summary
- Suggested validation
- Suggested review focus
- Open uncertainty

Risk should be visible before final approval.

## Risk Levels

Suggested levels:

- Low: localized, validated, aligned with plan
- Medium: moderate surface area, partial validation, some uncertainty
- High: broad or sensitive change, weak validation, architectural or safety impact
- Critical: destructive, security-sensitive, production-impacting, or unapproved scope

Risk level should be explainable and adjustable by user judgment.

## MVP Scope

The MVP should support:

- Changed file risk signals
- Scope alignment check
- Validation status risk
- Basic architecture boundary warnings
- Git dirty state warning
- AI-generated risk summary

The MVP can defer:

- Advanced static analysis
- Historical incident correlation
- Production signal risk
- Automated risk scoring from team data

## Success Criteria

Change risk analysis is successful when:

- Users know what to inspect first
- Approval prompts include meaningful risk
- Validation recommendations are tied to risk
- AI-generated changes are easier to trust or reject
- The system is clear about uncertainty
