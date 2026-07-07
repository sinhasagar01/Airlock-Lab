# Approval Flows

## Purpose

This document defines design patterns for human approval flows.

Approval is central to product trust. Approval UI must make consequential AI, tool, Git, and external actions understandable before the user allows them.

## Approval Principles

- Explain the requested action.
- Show why approval is needed.
- Show scope and affected systems.
- Show risk and reversibility.
- Keep the user in control.
- Record the decision.

## Approval Pattern Types

### Inline Approval

Used when approval is part of the current workflow.

Examples:

- Approve technical plan
- Accept generated change
- Run validation command

Inline approvals should appear near the relevant artifact.

### Modal Approval

Used when the action is consequential and needs focused attention.

Examples:

- Write files
- Modify Git state
- Publish PR
- Run risky command

Modals should be specific and avoid generic warnings.

### Approval Queue

Used when multiple pending approvals exist.

The queue should show:

- Requested action
- Requesting workflow
- Risk level
- Repository
- Age
- Primary next step

## Approval Preview

Approval previews should include:

- Action
- Scope
- Affected files or systems
- Reason
- Risks
- Validation state
- Reversibility
- Next step

## Approval Actions

Core actions:

- Approve
- Deny
- Revise
- Narrow scope
- Ask for explanation
- Cancel workflow

Destructive actions may require stronger confirmation.

## Copy Guidelines

Approval copy should be:

- Specific
- Plain
- Brief
- Action-oriented
- Honest about risk

Avoid:

- "Are you sure?"
- "AI wants to continue"
- "Proceed?"

Prefer:

- "Approve writing changes to 3 files"
- "Allow validation command for this run"
- "Publish this pull request draft"

## MVP Scope

The MVP should support:

- Plan approval
- Agent run approval
- File write approval
- Validation command approval
- Change acceptance
- Pending approval indicator

The MVP can defer:

- Multi-person approvals
- Organization policy UI
- Approval delegation
- Complex audit dashboard

## Success Criteria

Approval flows are successful when:

- Users understand what will happen
- Risk is visible before approval
- Denial and revision are natural
- Approvals are recorded
- The product feels controlled, not cautious to the point of friction
