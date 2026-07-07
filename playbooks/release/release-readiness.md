# Release Readiness Playbook

## Purpose

This playbook defines how to evaluate whether a change set is ready for release.

The early project may not have production releases yet, but the discipline should begin now.

## Release Inputs

Gather:

- Included tasks.
- Changed files.
- Accepted changes.
- Validation records.
- Known risks.
- Documentation updates.
- ADRs or RFCs affected.
- Open follow-up tasks.

## Readiness Checklist

### 1. Scope

Check:

- What is included?
- What is excluded?
- Are unrelated changes present?
- Are incomplete tasks included?

### 2. Validation

Check:

- Tests run.
- Typecheck run.
- Lint run.
- Build run.
- Manual checks.
- Validation gaps.

### 3. Risk

Check:

- High-risk changes.
- Permission or approval changes.
- Provider behavior changes.
- Persistence changes.
- Git or integration changes.
- User-facing workflow changes.

### 4. Documentation

Check:

- Product docs updated.
- Architecture docs updated.
- Specs updated.
- ADRs/RFCs updated.
- Playbooks updated.
- Prompt docs updated.

### 5. Rollback Or Recovery

Check:

- Can the change be reverted?
- Are migrations involved?
- Are external systems affected?
- Is there a known recovery path?

### 6. Approval

Check:

- Required approvals complete.
- Known risks accepted.
- Validation gaps acknowledged.
- Release decision recorded.

## MVP Release Readiness

For MVP documentation releases, readiness means:

- Docs are coherent.
- Links are valid where practical.
- Major decisions are recorded.
- Git state is clean.
- Changes are pushed.

For future software releases, readiness will include executable tests, builds, and deployment checks.

## Success Criteria

A release is ready when:

- Scope is known.
- Validation is sufficient or gaps are accepted.
- Risks are understood.
- Docs are aligned.
- Approval is explicit.
