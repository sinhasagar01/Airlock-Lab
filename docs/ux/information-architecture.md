# Information Architecture

## Purpose

This document defines the information architecture for the AI-native engineering workspace.

Information architecture determines how users understand the product’s objects, navigation, hierarchy, and relationships.

## Primary Objects

The workspace should organize around durable engineering objects:

- Workspace
- Repository
- Document
- Task
- Plan
- Agent run
- Change
- Validation record
- Approval
- Decision
- Integration
- Setting

These objects should appear consistently across navigation, search, command surfaces, and detail views.

## Top-Level Areas

### Workspace

The workspace home should summarize:

- Active repositories
- Recent activity
- Open tasks
- Active agent runs
- Pending approvals
- Recent changes
- Validation issues
- Important docs

### Repositories

Repository views should expose:

- Overview
- File map
- Repository facts
- Documentation graph
- Git state
- Validation commands
- Related tasks and changes

### Tasks

Task views should expose:

- Problem or goal
- Scope
- Requirements
- Non-goals
- Acceptance criteria
- Open questions
- Plans
- Agent runs
- Changes
- Decisions

### Plans

Plan views should expose:

- Proposed approach
- Affected areas
- Assumptions
- Risks
- Alternatives
- Validation strategy
- Approval state

### Agent Runs

Agent run views should expose:

- Goal
- Agent role
- Current status
- Context sources
- Tools used
- Progress
- Outputs
- Files touched
- Approvals
- Final summary

### Changes

Change views should expose:

- Changed files
- Diff
- Rationale
- Risk summary
- Validation status
- Documentation impact
- Accept, revise, or reject controls

### Documents

Document views should expose:

- Content
- Type
- Status
- Linked tasks
- Linked decisions
- Linked changes
- Related docs
- Staleness or supersession

### Decisions

Decision views should expose:

- Context
- Decision
- Alternatives
- Consequences
- Status
- Linked implementation work

## Cross-Object Relationships

The UI should make relationships visible:

- Task creates plan
- Plan starts agent run
- Agent run produces change
- Change has validation
- Change may require documentation update
- Decision explains architecture or product direction
- Document provides context for plan or review

Users should be able to move from any artifact to the artifacts that explain it.

## Global Navigation Model

The product should support:

- Persistent primary navigation
- Repository-aware local navigation
- Object detail views
- Command palette
- Global search
- Activity timeline
- Pending approval access

The current workspace and repository context should always be clear.

## Search Model

Search should eventually cover:

- Files
- Docs
- Tasks
- Plans
- Agent runs
- Changes
- Decisions
- Commands
- Settings

Search results should show object type, source, and relevance.

## MVP IA Scope

The MVP should include:

- Workspace home
- Repository overview
- Task detail
- Plan detail
- Agent run detail
- Change review
- Document index
- Command palette
- Approval queue or pending approval surface

The MVP can defer:

- Organization hierarchy
- Team spaces
- Advanced graph visualization
- Production operations views
- Marketplace browsing

## Success Criteria

The information architecture is successful when:

- Users understand where work lives
- AI outputs become navigable artifacts
- Context is not trapped in one-off conversations
- Relationships between intent, plan, execution, and review are visible
- The product can grow without navigation collapse
