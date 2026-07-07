# Agent Spec

## Status

Draft MVP spec.

## Purpose

This spec defines MVP agent definitions, agent runs, lifecycle states, permissions, context use, tool use, outputs, and review behavior.

## References

- [Agent Runtime](../../docs/ai-system/agent-runtime.md)
- [Human Approval](../../docs/ai-system/human-approval.md)
- [Reasoning Transparency](../../docs/ai-system/reasoning-transparency.md)
- [Tool Permissions](../../agents/tools/tool-permissions.md)
- [Provider Interface](../../docs/provider-abstraction/provider-interface.md)

## MVP Goals

The MVP agent system must:

- Run bounded AI workflows from approved tasks or plans.
- Assemble context through the context protocol.
- Call AI providers through the provider API.
- Request approval before consequential actions.
- Track progress and outputs.
- Produce reviewable artifacts.

## Non-Goals

The MVP does not include:

- Autonomous background agents.
- Complex multi-agent swarms.
- Organization-level agent policy.
- Marketplace-distributed agents.
- Long-running production monitors.

## Agent Definition

### Required Fields

- `id`
- `name`
- `role`
- `description`
- `inputTypes`
- `outputTypes`
- `allowedTools`
- `requiredPermissions`
- `defaultRoutingIntent`
- `version`

### MVP Agent Types

- Planner agent
- Implementation agent
- Reviewer agent
- Documentation agent

## Agent Run

### Required Fields

- `id`
- `workspaceId`
- `repositoryId`
- `taskId`
- `planId`
- `agentId`
- `goal`
- `status`
- `contextPackageId`
- `permissions`
- `startedAt`
- `completedAt`
- `summary`

### Statuses

- `created`
- `preparing_context`
- `awaiting_approval`
- `running`
- `paused`
- `needs_user_input`
- `completed`
- `failed`
- `cancelled`

## Run Lifecycle Requirements

### Created

- Run is created from a task, plan, change, or review request.
- Run goal must be visible.
- Run must have a known agent definition.

### Preparing Context

- Context must be assembled through the context protocol.
- Context sources must be recorded.
- Sensitive context constraints must be respected.

### Awaiting Approval

- Runs that write files, run commands, modify Git state, or call external systems must request approval.
- Approval preview must show action, scope, risks, and next step.

### Running

- Provider calls must use the provider API.
- Tool calls must pass through the tool and permission layer.
- Progress events must be recorded.

### Paused

- Runs must pause for scope expansion, missing context, failed validation that changes the plan, or required approval.

### Completed

- Runs must produce structured output.
- If files changed, a change record must exist.
- Validation state must be recorded or explicitly marked not run.

### Failed Or Cancelled

- Failure reason must be recorded.
- Partial outputs and touched files must be visible.
- The user must understand whether any files changed.

## Permissions

Agent permissions must be scoped by:

- Run
- Tool
- Repository
- File path where practical
- Command where practical
- External integration
- Time or session

Agents must not bypass permissions through provider tool calls.

## Tool Use

Tool call records must include:

- Tool name
- Input summary
- Permission status
- Execution status
- Output summary
- Error if any
- Timestamp

Tool results should be structured where practical.

## Outputs

Agent outputs may include:

- Product brief
- Technical plan
- Proposed change
- Review report
- Validation summary
- Documentation update
- Decision draft
- Follow-up task

Outputs must link to the run and input context.

## Review Requirements

For implementation runs, the final review must show:

- Summary
- Files touched
- Rationale
- Risks
- Validation performed
- Validation gaps
- Approval history
- Accept, revise, or reject controls

## Acceptance Criteria

- A run can be created from an approved plan.
- A run records context sources.
- A run can request approval before file writes.
- A run can pause for missing approval or scope expansion.
- A run can complete with structured output.
- Tool use is recorded and permissioned.
- The user can inspect run history after completion.
