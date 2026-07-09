# Agent Runtime

## Purpose

This document defines the conceptual runtime for AI agents in the workspace.

An agent is not a free-floating chatbot persona. It is a bounded operational role with inputs, permissions, tools, outputs, lifecycle state, and review requirements.

## Agent Definition

An agent definition should describe:

- Name
- Role
- Responsibilities
- Inputs
- Outputs
- Allowed tools
- Required permissions
- Required context
- Stop conditions
- Handoff behavior
- Evaluation criteria

Agent definitions should be versioned because prompts, tools, and expectations will evolve.

## Core Agent Types

The product may eventually support many agents, but the MVP should begin with a small set:

- Planner agent
- Implementation agent
- Reviewer agent
- Documentation agent

Future agents may include:

- Product agent
- Architecture agent
- AI systems agent
- Test agent
- Release agent
- Incident diagnosis agent

## Agent Run

An agent run is one bounded execution of an agent.

Every run should record:

- Goal
- Triggering user or workflow
- Task or plan being executed
- Provider and model used
- Repository context
- Documents used
- Tools available
- Tools used
- Permissions granted
- Outputs produced
- Proposed plan
- Files touched
- Files expected to be touched
- Approval requirement
- Validation attempted
- Warnings
- Final status

The run should remain inspectable after completion.

## Proposed Change Plan

The MVP models a proposed change plan before it models real file edits or Git
diffs. This creates a safe bridge between repository intelligence, agent runs,
approval review, and future diff review.

A proposed change plan should include:

- Summary
- Ordered implementation steps
- Expected affected files
- Risk summary
- Validation/check strategy
- Whether human approval is required

The plan is not a diff. It must not claim that changes have been generated until
the Git diff and proposed patch model exist.

Approval review should consume the same proposed change plan rather than
duplicating separate plan text. This keeps agent-run inspection and human
approval review aligned while diff attachment is still pending.

## Run Lifecycle

### 1. Created

The user or workflow creates a run from a task, plan, review request, or diagnosis request.

### 2. Preparing Context

The runtime gathers relevant context from repositories, docs, tasks, plans, decisions, and previous runs.

### 3. Awaiting Approval

If the run may write files, run commands, or call external systems, the system requests approval with a clear preview.

### 4. Running

The agent performs bounded work using provider calls and approved tools.

### 5. Paused

The run pauses when it needs clarification, hits a permission boundary, encounters unexpected risk, or exceeds scope.

### 6. Completed

The run produces structured output, summaries, changes, or recommendations.

### 7. Failed Or Cancelled

The run records failure reason, partial outputs, and any changes made or avoided.

## Tool Use

Agents should not call tools directly as uncontrolled functions.

Tool use should pass through:

1. Tool registry
2. Permission policy
3. Action preview where needed
4. Execution boundary
5. Structured result capture
6. Audit event recording

Tools should declare whether they read data, write files, execute commands, modify Git state, or affect external systems.

## Context Assembly

The runtime should assemble context intentionally.

Context should be:

- Relevant to the task
- Cited when used for major claims
- Limited enough to avoid noise
- Classified by source
- Separated into facts, docs, user intent, and generated memory

Agents should not receive unlimited repository context by default.

## Permissions

Permissions should be attached to runs and tool calls.

Permission examples:

- Read repository files
- Write repository files
- Run local commands
- Read Git state
- Modify Git state
- Send selected context to provider
- Call external integration
- Create remote artifact

Permission grants should have scope and duration.

## Stop Conditions

Agents should stop or pause when:

- Required context is missing
- The task is ambiguous
- The proposed change expands beyond approved scope
- A file outside expected boundaries must be modified
- A destructive command is requested
- External side effects are required
- Validation fails in a way that changes the plan
- Confidence is too low for safe continuation

## Outputs

Agent outputs should be structured.

Possible outputs:

- Product brief
- Technical plan
- Repository summary
- Code change
- Diff summary
- Review report
- Validation summary
- Documentation update
- Decision draft
- Follow-up task

Outputs should link back to inputs and context.

## Handoffs

Agent handoffs should preserve context explicitly.

A handoff should include:

- Source agent
- Target agent
- Reason for handoff
- Current state
- Completed work
- Remaining work
- Relevant artifacts
- Open questions

Handoffs should not rely on hidden conversation state.

## MVP Runtime

The MVP runtime should support:

- Creating a run from an approved plan
- Assembling repository and task context
- Calling an AI provider through the provider abstraction
- Mediating basic tool use
- Recording progress
- Producing structured output
- Recording changed files
- Pausing for approval or clarification
- Completing with a reviewable summary

The MVP can defer:

- Complex concurrent multi-agent orchestration
- Long-running background agents
- Organization policy enforcement
- Full plugin-based agent distribution

## Success Criteria

The agent runtime is successful when:

- Agent work is bounded and inspectable
- Tool use is permissioned
- Runs preserve useful history
- Humans can pause, revise, or reject work
- Outputs become durable workspace artifacts
- Provider details remain hidden behind the provider abstraction
