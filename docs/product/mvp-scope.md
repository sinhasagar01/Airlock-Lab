# MVP Scope

## Purpose

This document defines the first meaningful product version.

The MVP should prove the core thesis:

> An AI-native engineering workspace can help an expert builder understand a repository, define work, plan changes, execute bounded AI assistance, and review results with human control.

The MVP should not attempt to become the full Engineering Operating System.

## MVP Audience

The MVP is for the AI-native senior builder.

The product should initially optimize for one expert user working locally with one or more repositories. Team collaboration, production observability, and broad integrations can come later.

## MVP Goals

The MVP should allow a user to:

- Open a local workspace
- Add or select a repository
- Understand the repository structure
- Create structured product work
- Generate a technical plan from product intent
- Run a bounded AI implementation workflow
- Review the resulting change
- See reasoning, confidence, risk, and validation status
- Preserve important context in project memory or docs
- Avoid coupling the product to a single AI provider

## MVP Non-Goals

The MVP should not include:

- Full IDE replacement
- Full Git client replacement
- Team collaboration
- Organization administration
- Production monitoring
- Deployment automation
- Automatic rollback
- Fully autonomous issue detection
- Fully autonomous code changes without approval
- Broad marketplace plugin system
- Complex multi-agent swarms
- Cloud-hosted team workspaces
- Mobile experience

These may become important later, but they are not required to validate the first product.

## Required MVP Capabilities

### 1. Workspace Shell

#### Description

The app needs a durable workspace shell that can hold repositories, docs, tasks, agent runs, and settings.

#### Requirements

- Create or open a local workspace
- Display primary navigation
- Show current repository context
- Provide global search or command access in basic form
- Display recent activity
- Persist local workspace state

#### Success Criteria

The user always understands where they are, what repository is active, and what workflow is in progress.

### 2. Local Repository Context

#### Description

The app needs to inspect a local repository and create a useful overview.

#### Requirements

- Select a local repository
- Scan directory structure
- Detect languages and frameworks where practical
- Identify package files and entry points
- Identify docs and tests
- Generate a repository summary
- Link claims to files
- Show uncertainty where inference is involved

#### Success Criteria

The user can understand the repository faster than by manual exploration alone.

### 3. Product Task Definition

#### Description

The app needs a structured way to define product work before implementation.

#### Requirements

- Create a product task
- Capture user problem, goal, and scope
- Draft requirements
- Draft non-goals
- Draft acceptance criteria
- Record open questions
- Link relevant docs or files

#### Success Criteria

The user can turn an idea into a clear work artifact before any code changes begin.

### 4. Technical Planning

#### Description

The app needs to generate a bounded technical plan from a product task and repository context.

#### Requirements

- Inspect relevant files and docs
- Propose affected areas
- Propose implementation approach
- Identify risks
- Recommend validation
- List assumptions
- Support user approval before implementation

#### Success Criteria

The user can review and approve a plan that is grounded in the actual repository.

### 5. AI Provider Abstraction

#### Description

The app must not hard-code product workflows to a single AI runtime.

#### Requirements

- Define an internal provider interface
- Implement an initial provider adapter
- Keep OMP behind an adapter boundary
- Represent model capabilities
- Handle provider errors clearly
- Preserve room for routing and fallback

#### Success Criteria

The product can begin with one runtime while keeping future provider changes feasible.

### 6. Bounded Agent Run

#### Description

The app needs a basic agent workflow for implementing approved changes.

#### Requirements

- Start from an approved task or plan
- Show agent goal and scope
- Show permissions
- Track files touched
- Surface progress
- Stop for approval if scope changes
- Produce final summary

#### Success Criteria

The user can supervise AI work as a bounded run, not as an opaque chat exchange.

### 7. Reviewable Changes

#### Description

The app needs to make AI-generated changes easy to inspect.

#### Requirements

- Show changed files
- Show diff
- Summarize what changed
- Explain why changes were made
- Show risks
- Show validation performed
- Show validation gaps
- Allow accept, revise, or reject

#### Success Criteria

The user can decide whether to keep the change with confidence.

### 8. Basic Validation

#### Description

The app needs to support validation as part of the workflow.

#### Requirements

- Recommend validation steps
- Run configured or user-approved validation commands where practical
- Capture command output
- Summarize pass or fail state
- Preserve validation gaps

#### Success Criteria

The user understands what was verified and what was not.

### 9. Project Memory Basics

#### Description

The app needs a simple way to preserve durable project context.

#### Requirements

- Save repository summaries
- Save product tasks
- Save technical plans
- Save agent run summaries
- Save decisions or notes
- Link artifacts together

#### Success Criteria

Work does not disappear into transient chat history.

### 10. Human Approval Gates

#### Description

The app needs explicit approval for meaningful actions.

#### Requirements

- Approval before implementation begins
- Approval before scope expansion
- Approval before destructive actions
- Approval before external side effects
- Clear preview of what is being approved

#### Success Criteria

The user never feels the system acted behind their back.

## MVP User Journey

The ideal MVP flow:

1. User opens the app.
2. User selects a local repository.
3. Workspace scans and summarizes the repository.
4. User creates a product task.
5. AI drafts requirements and acceptance criteria.
6. User approves task scope.
7. AI proposes a technical plan.
8. User approves implementation.
9. Agent runs with visible scope and progress.
10. Workspace presents changed files, diff, summary, risks, and validation.
11. User accepts, revises, or rejects the result.
12. Workspace saves the relevant context.

## MVP Quality Bar

The MVP should feel:

- Fast
- Calm
- Local-first
- Expert-oriented
- Reviewable
- Trustworthy
- Visually polished
- Documentation-driven

The MVP can be narrow, but it should not feel careless.

## Explicit Tradeoffs

### Depth Over Breadth

The MVP should deeply support one local expert workflow instead of shallowly supporting many integrations.

### Review Over Autonomy

The MVP should prioritize human review and approval over autonomous action.

### Structure Over Chat

The MVP should use structured tasks, plans, runs, and reviews instead of centering the experience on a generic chat box.

### Provider Boundary Over Provider Optimization

The MVP should first establish the abstraction boundary. Advanced routing and evaluation can follow.

## MVP Risks

### Risk: The Product Feels Like Documentation, Not Software

Mitigation: The MVP must include real repository understanding and agent-assisted change workflows, not only docs and planning.

### Risk: The Product Feels Like A Chat Wrapper

Mitigation: Core workflows must use structured artifacts and review surfaces.

### Risk: AI Output Is Hard To Trust

Mitigation: Require evidence links, diff review, risk summaries, validation status, and approval gates.

### Risk: Scope Expands Too Early

Mitigation: Keep integrations, team features, production observability, and deployment automation out of the first release.

### Risk: Provider Coupling Becomes Architectural Debt

Mitigation: Implement provider abstraction from the first build.

## MVP Exit Criteria

The MVP is successful when:

- An expert user can open a repository and quickly understand it
- The user can define product work in a structured way
- The user can generate and approve a technical plan
- The user can run a bounded AI implementation workflow
- The user can review changes before accepting them
- The app preserves useful project context
- The product does not depend directly on one AI provider interface
- The experience feels meaningfully better than manually juggling chat, editor, terminal, docs, and Git status

## What Comes Immediately After MVP

The next product layer should add:

- Pull request draft generation
- GitHub integration
- ADR and RFC creation flows
- Documentation impact detection
- AI review agent
- Stronger validation workflows
- Saved workflow templates
- Initial team permission model
