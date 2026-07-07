# Color

## Purpose

This document defines the color foundation for the design system.

Color should support clarity, hierarchy, state, and trust. It should not create a one-note brand wash or decorative noise.

## Color Principles

- Use color to communicate state and priority.
- Keep dense engineering interfaces calm and readable.
- Avoid over-reliance on a single hue family.
- Do not use color as the only indicator of meaning.
- Preserve strong contrast in all interactive states.
- Keep AI, risk, approval, validation, and Git states visually distinct.

## Product Tone

The product should feel:

- Calm
- Precise
- Technical
- Premium
- Focused
- Trustworthy

The palette should avoid feeling like a generic SaaS gradient, a dark-blue dashboard clone, or a playful consumer app.

## Functional Color Roles

The system should define roles for:

- Background
- Surface
- Elevated surface
- Border
- Separator
- Primary text
- Secondary text
- Muted text
- Accent
- Focus ring
- Selection
- Hover
- Active
- Success
- Warning
- Danger
- Info
- AI state
- Approval state
- Validation state
- Git state

## State Color Requirements

### Approval

Approval states should feel deliberate and attention-worthy without being alarming by default.

States:

- Pending approval
- Approved
- Denied
- Needs revision

### Risk

Risk colors should distinguish severity.

States:

- Low
- Medium
- High
- Critical

Critical risk should be visually strong and reserved for truly consequential states.

### Validation

Validation colors should distinguish:

- Passed
- Failed
- Not run
- Skipped
- Inconclusive

"Not run" should not look successful.

### AI

AI state should have a recognizable visual treatment, but it should not dominate the UI.

AI colors should support:

- Agent running
- Agent paused
- AI-generated artifact
- AI suggestion
- AI uncertainty

## Accessibility

Color must meet accessibility requirements.

Guidelines:

- Do not rely on color alone.
- Pair color with text, icon, or shape.
- Maintain sufficient contrast for text and controls.
- Test both light and dark themes if both are supported.
- Ensure focus states are highly visible.

## MVP Scope

The MVP should define semantic color roles before hard-coding visual values.

Required:

- Core surface roles
- Text roles
- Border roles
- Focus role
- Success, warning, danger, info
- AI, approval, validation, and risk roles

Exact token values should be finalized during UI implementation and visual QA.

## Success Criteria

The color system is successful when:

- Status is easy to scan
- Risk and validation are not confused
- AI state is recognizable but not loud
- The interface feels calm under dense information
- Accessibility is preserved
