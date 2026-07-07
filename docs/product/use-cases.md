# Use Cases

## Purpose

This document defines the core jobs the product must support.

Use cases describe what users need to accomplish, why it matters, what the product should provide, and what success looks like. They are not implementation specs. Detailed behavior will be defined later in product, frontend, AI, and backend specifications.

## Use Case 1: Understand A Repository

### User Need

A user opens a repository and needs to understand what it is, how it is structured, how the major systems relate, and where work should begin.

### Product Role

The workspace should analyze the repository and present a clear model of:

- Project purpose
- Directory structure
- Major modules
- Frameworks and languages
- Entry points
- Dependency relationships
- Documentation coverage
- Testing setup
- Known risks or gaps
- Relevant decisions and specs

### AI Role

AI should summarize the repository with evidence. It should cite files, identify uncertainty, and recommend next reading paths or setup steps.

### Success Criteria

- The user can explain the repository faster than by manual exploration alone
- The summary is linked to real files and docs
- The system distinguishes known facts from inference
- The user can navigate from summary to source context

## Use Case 2: Define Product Work Before Implementation

### User Need

A user has a product idea or feature request and wants to turn it into clear scope before code is written.

### Product Role

The workspace should help create:

- Problem statement
- Target user
- Use cases
- User journey
- Functional requirements
- Non-goals
- Acceptance criteria
- Risks
- Open questions
- Related docs or decisions

### AI Role

AI should ask clarifying questions when needed, propose structure, identify missing assumptions, and help convert ambiguity into a spec-ready artifact.

### Success Criteria

- The user has a clear product artifact before implementation
- Scope is explicit
- Non-goals are recorded
- Future implementation work can reference the artifact

## Use Case 3: Plan A Technical Change

### User Need

A user knows what they want to change, but needs a safe technical plan before modifying files.

### Product Role

The workspace should produce a plan that includes:

- Goal
- Relevant files and modules
- Proposed approach
- Alternatives considered
- Risks
- Required validation
- Dependencies
- Estimated complexity
- Approval needs

### AI Role

AI should inspect the repository, reason from existing patterns, and propose a bounded plan. It should avoid pretending uncertainty does not exist.

### Success Criteria

- The user can approve, edit, or reject the plan
- The plan references actual repository context
- The plan is appropriately scoped
- Risk and validation are visible before edits begin

## Use Case 4: Execute A Bounded Code Change

### User Need

A user wants AI assistance implementing a clearly scoped change.

### Product Role

The workspace should coordinate implementation through an agent or workflow with:

- Clear task boundaries
- File access awareness
- Change previews
- Validation commands
- Progress state
- Final summary
- Reviewable diff

### AI Role

AI should modify only the necessary files, follow existing patterns, and explain what changed.

### Success Criteria

- The change matches the approved task
- The diff is easy to review
- Tests or validation are run when practical
- The user retains control over commit, PR, and deployment actions

## Use Case 5: Review AI-Generated Changes

### User Need

A user needs to inspect AI-generated work before accepting it.

### Product Role

The workspace should provide a review surface that shows:

- Summary of changes
- Files affected
- Rationale
- Risks
- Tests run
- Validation gaps
- Unresolved questions
- Diff navigation
- Approval or rejection actions

### AI Role

AI should assist review by identifying likely issues, missed requirements, inconsistent patterns, and missing tests.

### Success Criteria

- The user can quickly understand and audit the work
- Risk is visible
- Approval is explicit
- Rework can be requested with clear feedback

## Use Case 6: Generate A Pull Request

### User Need

A user wants to turn a validated change into a high-quality pull request.

### Product Role

The workspace should help prepare:

- PR title
- Summary
- Motivation
- Scope
- Screenshots or artifacts when relevant
- Testing notes
- Risk notes
- Linked docs, tasks, RFCs, or ADRs
- Reviewer guidance

### AI Role

AI should synthesize the change, its intent, and its validation into a review-ready narrative.

### Success Criteria

- The PR is easy for a reviewer to understand
- The PR does not overclaim validation
- Links to relevant project context are included
- The human explicitly approves creating or publishing the PR

## Use Case 7: Preserve Decisions

### User Need

A user makes a product or technical decision and wants future contributors to understand why.

### Product Role

The workspace should route decisions into the right artifact:

- ADR for architecture decisions
- RFC for substantial proposals or open debate
- Product doc for product intent
- Spec for expected behavior
- Playbook for repeatable workflow
- Prompt doc for AI behavior

### AI Role

AI should help draft the decision record, identify consequences, and link related docs.

### Success Criteria

- Decisions are easy to find later
- Context and tradeoffs are preserved
- The decision is linked to implementation or future work

## Use Case 8: Diagnose A Bug Or Regression

### User Need

A user observes a bug, failing test, build issue, or regression and needs to understand the likely cause.

### Product Role

The workspace should gather context from:

- Error output
- Test results
- Recent changes
- Relevant files
- Dependency relationships
- Related docs
- Prior incidents
- Runtime signals when available

### AI Role

AI should propose likely causes with evidence, uncertainty, and next diagnostic steps.

### Success Criteria

- The user gets a ranked diagnosis, not a vague guess
- Evidence is linked to files or signals
- The system recommends validation steps
- Any proposed fix remains reviewable

## Use Case 9: Maintain Documentation Alignment

### User Need

A user wants documentation to stay aligned with product and code changes.

### Product Role

The workspace should detect likely documentation impacts and suggest updates to:

- Product docs
- Architecture docs
- Specs
- ADRs
- RFCs
- Playbooks
- Prompts
- README files

### AI Role

AI should identify documentation that may need updates, draft changes, and explain why they are relevant.

### Success Criteria

- Documentation drift is reduced
- Suggested updates are scoped and reviewable
- Docs remain part of the development workflow

## Use Case 10: Coordinate Specialized Agents

### User Need

A user wants different AI agents to handle planning, architecture, implementation, review, documentation, and validation without losing oversight.

### Product Role

The workspace should support:

- Agent role definitions
- Task assignment
- Handoff protocols
- Permission boundaries
- Shared context
- Agent run history
- Human approval gates

### AI Role

Agents should perform specialized work and produce structured outputs that other agents and humans can inspect.

### Success Criteria

- Agents do useful bounded work
- Outputs are understandable
- Handoffs preserve context
- The user can interrupt, redirect, approve, or reject work

## Use Case Priority

Initial MVP priority:

1. Understand a repository
2. Define product work before implementation
3. Plan a technical change
4. Execute a bounded code change
5. Review AI-generated changes
6. Preserve decisions

Post-MVP priority:

1. Generate pull requests
2. Maintain documentation alignment
3. Diagnose bugs and regressions
4. Coordinate multiple specialized agents

Long-term Engineering OS priority:

1. Connect runtime signals
2. Detect regressions automatically
3. Diagnose production issues
4. Generate and validate fixes
5. Support governed deployment workflows
