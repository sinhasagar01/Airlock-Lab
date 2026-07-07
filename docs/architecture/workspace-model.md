# Workspace Model

## Purpose

This document defines the core domain model for the AI-native engineering workspace.

The workspace model describes the primary objects users interact with and the relationships between them. Future data, backend, frontend, and AI specs should refine these concepts into concrete schemas and APIs.

## Core Concept

A workspace is the durable container for engineering context.

It is not just a folder, project, or chat history. It is the structured memory of software work: repositories, documents, tasks, plans, agents, changes, validations, approvals, and decisions.

## Primary Domain Objects

### Workspace

#### Definition

A workspace is the top-level product container.

#### Responsibilities

- Owns user settings
- Registers repositories
- Stores project memory
- Tracks tasks and plans
- Tracks agent runs
- Tracks changes and validations
- Links documents, decisions, and artifacts
- Maintains activity history

#### Key Relationships

- Has many repositories
- Has many documents
- Has many tasks
- Has many agent runs
- Has many decisions
- Has many approvals

### Repository

#### Definition

A repository is a local source code project known to the workspace.

#### Responsibilities

- Stores path and metadata
- Exposes file and directory structure
- Provides Git context
- Provides code and docs context
- Supports indexing and analysis
- Anchors tasks, plans, changes, and validations

#### Key Relationships

- Belongs to a workspace
- Has many repository snapshots
- Has many indexed facts
- Has many tasks
- Has many changes
- Has many validation records

### Repository Snapshot

#### Definition

A repository snapshot captures observed repository state at a point in time.

#### Responsibilities

- Records branch or commit context where available
- Records scan time
- Records detected languages, frameworks, packages, scripts, docs, and tests
- Provides evidence for repository summaries

#### Key Relationships

- Belongs to a repository
- Produces repository facts
- Informs tasks, plans, and agent runs

### Repository Fact

#### Definition

A repository fact is an observed or inferred statement about the repository.

#### Types

- Observed fact
- Inferred fact
- User-confirmed fact
- Deprecated fact

#### Responsibilities

- Stores claim
- Stores evidence
- Stores confidence
- Stores source
- Distinguishes facts from inference

#### Key Relationships

- Belongs to a repository or snapshot
- Can be referenced by AI outputs
- Can be corrected by the user

### Document

#### Definition

A document is a durable knowledge artifact in the workspace or repository.

#### Examples

- Product doc
- Architecture doc
- Spec
- ADR
- RFC
- Playbook
- Prompt doc
- README

#### Responsibilities

- Stores or references content
- Provides source-of-truth context
- Links to tasks, decisions, plans, and changes
- Supports documentation graph relationships

#### Key Relationships

- Belongs to a workspace or repository
- Can link to many tasks
- Can link to many decisions
- Can link to many changes

### Task

#### Definition

A task is a structured unit of intended work.

#### Responsibilities

- Captures goal
- Captures user problem or motivation
- Captures scope
- Captures non-goals
- Captures acceptance criteria
- Captures open questions
- Tracks status
- Links to plans, runs, changes, docs, and decisions

#### Key Relationships

- Belongs to a workspace
- May target one or more repositories
- May have one or more plans
- May have one or more agent runs
- May have one or more changes
- May require approvals

### Plan

#### Definition

A plan is a proposed path for completing a task.

#### Responsibilities

- Defines approach
- Lists affected files or modules
- Records assumptions
- Records risks
- Records alternatives
- Defines validation strategy
- Requires approval before implementation when relevant

#### Key Relationships

- Belongs to a task
- References repository facts
- References documents
- Can create agent runs
- Can require approvals

### Agent

#### Definition

An agent is a defined AI role with responsibilities, capabilities, and constraints.

#### Responsibilities

- Declares role
- Declares allowed tools
- Declares expected inputs and outputs
- Declares permission requirements
- Produces structured work during agent runs

#### Key Relationships

- Can participate in many agent runs
- Uses provider abstraction
- Uses tool permissions
- Produces artifacts, plans, reviews, or changes

### Agent Run

#### Definition

An agent run is a bounded execution of an agent against a task, plan, repository, or document.

#### Responsibilities

- Records goal
- Records context provided
- Records tools used
- Records progress
- Records outputs
- Records files touched
- Records validation attempted
- Records interruption or approval events
- Records final summary

#### Key Relationships

- Belongs to a workspace
- May belong to a task
- May execute a plan
- May produce a change
- May produce documents or decisions
- Requires approvals for scoped actions

### Change

#### Definition

A change is a proposed or accepted modification to files, docs, settings, or external state.

#### Responsibilities

- Records changed files
- Records diff
- Records rationale
- Records risk
- Records authoring source
- Tracks review state
- Links validation
- Links task and plan

#### Key Relationships

- Belongs to a repository or workspace
- May be produced by an agent run
- May be accepted, revised, rejected, committed, or prepared for PR
- Has validation records
- May require approvals

### Validation Record

#### Definition

A validation record captures checks performed against a task, plan, agent run, or change.

#### Responsibilities

- Records command or checklist
- Records status
- Records output summary
- Records failures
- Records gaps
- Records timestamp
- Links to changed files or tasks when relevant

#### Key Relationships

- Belongs to a task, plan, run, or change
- Can inform approval
- Can be included in PR summaries

### Approval

#### Definition

An approval is an explicit human decision allowing a meaningful action.

#### Responsibilities

- Records action being approved
- Records preview shown to user
- Records actor
- Records timestamp
- Records scope
- Records conditions or limits

#### Key Relationships

- Can apply to plans
- Can apply to agent runs
- Can apply to tool use
- Can apply to changes
- Can apply to external side effects

### Decision

#### Definition

A decision is a durable record of product, architectural, workflow, or AI behavior choice.

#### Examples

- ADR
- RFC outcome
- Product scope decision
- Prompt strategy decision
- Provider strategy decision

#### Responsibilities

- Captures context
- Captures decision
- Captures alternatives
- Captures consequences
- Links to affected docs, tasks, and changes

#### Key Relationships

- Belongs to a workspace
- May be represented by a document
- Can link to tasks, plans, changes, and repository facts

### Artifact

#### Definition

An artifact is an output created or managed by the workspace.

#### Examples

- Repository summary
- Product brief
- Technical plan
- Agent output
- Review report
- Validation summary
- PR draft
- Documentation update

#### Responsibilities

- Stores output type
- Stores source
- Stores links to input context
- Can be promoted to a document when durable

#### Key Relationships

- Can be produced by users, agents, or workflows
- Can belong to tasks, plans, runs, changes, or documents

### Activity Event

#### Definition

An activity event records something meaningful that happened in the workspace.

#### Responsibilities

- Records event type
- Records actor
- Records timestamp
- Records target object
- Records summary
- Supports audit and history views

#### Key Relationships

- Belongs to a workspace
- References tasks, plans, runs, changes, validations, approvals, and decisions

## Object Lifecycle Examples

### Product Task Lifecycle

1. Draft
2. Scoped
3. Planned
4. Approved for implementation
5. In progress
6. In review
7. Accepted
8. Completed
9. Archived

### Plan Lifecycle

1. Draft
2. Needs clarification
3. Ready for approval
4. Approved
5. Superseded
6. Rejected

### Agent Run Lifecycle

1. Queued
2. Preparing context
3. Waiting for approval
4. Running
5. Paused
6. Needs user input
7. Completed
8. Failed
9. Cancelled

### Change Lifecycle

1. Proposed
2. Generated
3. Under review
4. Revision requested
5. Accepted
6. Rejected
7. Committed
8. Prepared for PR

### Validation Lifecycle

1. Planned
2. Running
3. Passed
4. Failed
5. Skipped
6. Inconclusive

## Modeling Principles

- Prefer durable structured objects over transient chat state.
- Preserve links between intent, plan, execution, validation, and decision.
- Treat approval as explicit data, not just a UI click.
- Treat validation as separate from implementation.
- Distinguish observed facts, AI inference, and user-confirmed knowledge.
- Make every meaningful agent run inspectable after the fact.
- Keep provider details out of core domain objects.

## MVP Model Scope

The MVP should implement or simulate the following objects:

- Workspace
- Repository
- Repository snapshot
- Repository fact
- Document
- Task
- Plan
- Agent run
- Change
- Validation record
- Approval
- Activity event

The MVP may defer full implementation of:

- Team members
- Organizations
- Cloud sync
- Advanced plugin objects
- Deployment records
- Incident records
- Observability signals
