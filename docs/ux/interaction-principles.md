# Interaction Principles

## Purpose

This document defines the interaction principles for the AI-native engineering workspace.

The product should feel like a serious daily tool for expert builders: fast, calm, inspectable, and beautifully controlled. AI should increase leverage without making the user feel displaced or unsure.

## 1. Human Authority Is Always Visible

The interface should make it clear that the human is directing the system.

Users should always be able to see:

- What workflow is active
- What AI is trying to do
- What actions are pending approval
- What has already happened
- What can be accepted, revised, cancelled, or rejected

The system should not create a sense of hidden automation.

## 2. Structure Beats Chat Drift

Conversation can be useful, but durable work should become structured artifacts.

The UI should guide users from conversation or intent into:

- Tasks
- Plans
- Agent runs
- Changes
- Reviews
- Validation records
- Decisions
- Documentation updates

The product should avoid trapping important context inside transient chat logs.

## 3. Make AI Work Inspectable

AI actions should have visible state.

Users should be able to inspect:

- Inputs
- Context sources
- Reasoning summary
- Assumptions
- Files touched
- Tools used
- Permissions granted
- Validation performed
- Risks and uncertainty

Inspectable work earns trust.

## 4. Approval Is A Workflow, Not A Popup

Approval should be embedded into the flow of work.

Approval surfaces should explain:

- What is being approved
- Why approval is needed
- What files or systems are affected
- Whether the action is reversible
- What risks exist
- What will happen next

Approval should feel precise, not bureaucratic.

## 5. Design For Expert Momentum

Expert users need speed and control.

The interface should support:

- Keyboard-first navigation
- Command palette workflows
- Fast switching between artifacts
- Dense but readable layouts
- Progressive disclosure
- Inline review
- Minimal repetitive confirmation

Power should not come at the cost of clarity.

## 6. Surface Risk Before Commitment

Risk should appear before the user commits to an action, not only after something goes wrong.

Risk surfaces should include:

- Scope risk
- Architecture risk
- Validation gaps
- Git risk
- Security or privacy risk
- External side effects

Risk should guide attention, not create noise.

## 7. Preserve Context As The User Works

Every meaningful workflow should leave a useful trail.

The product should preserve:

- User intent
- AI context
- Plan decisions
- Approval events
- Change summaries
- Validation outcomes
- Follow-up tasks

Users should feel that the workspace is accumulating understanding.

## 8. Keep The Interface Calm Under Complexity

The product will expose complex engineering state. The UI should reduce cognitive load through hierarchy and grouping.

Design should prioritize:

- Clear primary action
- Stable navigation
- Predictable panels
- Consistent status language
- Scannable summaries
- Explicit empty and error states

Calm does not mean sparse. It means controlled.

## 9. Never Overstate Certainty

The UI should distinguish:

- Observed fact
- AI inference
- User-confirmed knowledge
- Validation result
- Recommendation

Confidence, uncertainty, and validation gaps should be visible where decisions depend on them.

## 10. Make Reversal And Revision Natural

The user should be able to revise AI work without feeling like they are fighting the system.

Core actions:

- Pause
- Cancel
- Revise
- Narrow scope
- Reject output
- Accept output
- Ask for explanation
- Save as document
- Create follow-up task

The workspace should support iteration as the normal shape of work.

## MVP Interaction Bar

The MVP should support:

- Clear repository context
- Structured task and plan flows
- Visible agent run state
- Approval before consequential action
- Reviewable changes
- Validation status
- Context and risk summaries
- Keyboard-friendly navigation

## Success Criteria

The interaction model is successful when:

- Users feel in control of AI work
- Important state is visible without hunting
- Approval moments are understandable
- Review feels faster than manual inspection alone
- The product feels built for expert daily use
