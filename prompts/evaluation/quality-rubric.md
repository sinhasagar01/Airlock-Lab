# Quality Rubric

## Purpose

This rubric evaluates AI-assisted outputs, documentation, plans, specs, code reviews, and implementation proposals.

Use it to decide whether an artifact is ready, needs revision, or is blocked.

## Scoring Model

Use qualitative ratings:

- Excellent
- Good
- Needs revision
- Blocked

Do not reduce quality to a single number unless a workflow explicitly asks for scoring.

## Criteria

### 1. Goal Alignment

The output should directly address the user request and relevant product docs.

Signals:

- Clear goal
- Correct scope
- Non-goals respected
- No unrelated expansion

### 2. Context Grounding

The output should use relevant repository, product, architecture, or spec context.

Signals:

- Cites or references sources where practical
- Distinguishes fact from inference
- Does not invent project details

### 3. Completeness

The output should include the information needed for the next workflow step.

Signals:

- Covers required sections
- Includes risks and assumptions
- Identifies open questions
- Includes validation or review needs

### 4. Architecture Fit

The output should preserve documented architecture.

Signals:

- Provider abstraction respected
- Module boundaries respected
- Local-first constraints considered
- Approval boundaries preserved

### 5. Reviewability

The output should be easy for a human to inspect.

Signals:

- Structured format
- Clear rationale
- Explicit uncertainty
- Actionable next steps

### 6. Safety

The output should not bypass human control or hide risk.

Signals:

- Destructive actions require approval
- External side effects are explicit
- Sensitive context is handled carefully
- Validation gaps are honest

### 7. Documentation Quality

The output should be durable and useful later.

Signals:

- Clear headings
- Stable terminology
- Links or references where useful
- No throwaway chat-only conclusions

## Evaluation Output

Use this structure:

1. Overall rating
2. Strengths
3. Required revisions
4. Risks or gaps
5. Recommended next step

## Success Criteria

The rubric is successful when it helps reviewers identify whether an artifact is useful, trustworthy, aligned, and ready for the next step.
