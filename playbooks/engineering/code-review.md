# Code Review Playbook

## Purpose

This playbook defines how code changes should be reviewed in the project.

AI-generated code must meet the same quality bar as human-generated code. Review should focus on correctness, architecture, safety, UX, tests, documentation, and scope alignment.

## Review Inputs

Before reviewing, gather:

- Task or product intent.
- Approved plan.
- Changed files.
- Diff.
- Risk summary.
- Validation records.
- Related docs, specs, ADRs, or RFCs.
- Agent run summary if AI generated the change.

## Review Checklist

### 1. Scope Alignment

Check:

- Does the change match the task?
- Did it exceed approved scope?
- Are unrelated files included?
- Are non-goals respected?

### 2. Architecture

Check:

- Are module boundaries preserved?
- Is provider-specific logic isolated?
- Are UI, domain, persistence, tools, and providers separated correctly?
- Does the change follow documented architecture?

### 3. Correctness

Check:

- Does the code do what the task requires?
- Are edge cases handled?
- Are errors handled clearly?
- Are state transitions valid?

### 4. Safety And Permissions

Check:

- Are destructive actions gated?
- Are tool calls permissioned?
- Are Git or external actions explicit?
- Are sensitive files or secrets protected?

### 5. Tests And Validation

Check:

- Were relevant tests run?
- Were typecheck, lint, or build checks run where applicable?
- Are validation gaps documented?
- Are new tests needed?

### 6. UX

Check:

- Are loading, empty, error, pending, running, paused, and failed states handled?
- Is the UI accessible?
- Is status visible without relying on color alone?
- Does the workflow preserve user control?

### 7. Documentation

Check:

- Do product docs need updates?
- Do architecture docs need updates?
- Do specs need updates?
- Is an ADR or RFC needed?
- Do prompt or agent docs need updates?

## AI-Specific Review

For AI-generated changes, also check:

- What context was used?
- What assumptions were made?
- Did the agent modify only expected files?
- Did it explain risk and validation gaps?
- Did it preserve user changes?
- Did it overstate confidence?

## Review Output

Review feedback should include:

- Blocking issues.
- Non-blocking issues.
- Questions.
- Required validation.
- Documentation follow-up.
- Approval or requested revision.

## Success Criteria

A review is complete when:

- Scope is verified.
- Risks are understood.
- Validation is checked.
- Documentation impact is considered.
- The reviewer can approve, reject, or request revision with confidence.
