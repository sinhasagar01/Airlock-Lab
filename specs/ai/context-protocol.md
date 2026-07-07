# Context Protocol

## Status

Draft MVP spec.

## Purpose

This spec defines how context is assembled, classified, cited, and passed to AI workflows.

The context protocol ensures that AI outputs are grounded in relevant workspace knowledge without sending uncontrolled or unnecessary repository data.

## References

- [Context Engine](../../docs/ai-system/context-engine.md)
- [Repository Indexing](../../docs/repositories/repository-indexing.md)
- [Documentation Graph](../../docs/repositories/documentation-graph.md)
- [Reasoning Transparency](../../docs/ai-system/reasoning-transparency.md)

## Context Package

### Required Fields

- `id`
- `workspaceId`
- `repositoryId`
- `workflowType`
- `goal`
- `userRequest`
- `sources`
- `constraints`
- `createdAt`
- `freshness`

### Requirements

- Every provider request from an agent run must reference a context package.
- Context packages must be provider-independent.
- Context packages must record source metadata.
- Context packages must distinguish observed facts, inferred facts, user-confirmed knowledge, and generated artifacts.

## Context Source

### Required Fields

- `id`
- `type`
- `title`
- `uri`
- `excerpt`
- `classification`
- `authority`
- `freshness`
- `reasonIncluded`

### Source Types

- `file`
- `repository_fact`
- `document`
- `task`
- `plan`
- `agent_run`
- `change`
- `validation`
- `decision`
- `user_note`

### Classifications

- `observed`
- `inferred`
- `user_confirmed`
- `ai_generated`
- `stale`

## Context Assembly Flow

1. Identify workflow type and goal.
2. Resolve target workspace and repository.
3. Include direct user references.
4. Retrieve relevant task or plan.
5. Retrieve repository facts and files.
6. Retrieve authoritative docs and decisions.
7. Retrieve relevant validation records and prior runs.
8. Rank sources.
9. Exclude sensitive or irrelevant context.
10. Build provider-ready context package.
11. Record package for later inspection.

## Ranking Inputs

Ranking should consider:

- Direct user reference
- Task relevance
- File proximity
- Documentation authority
- Recentness
- User confirmation
- Validation evidence
- Prior run relevance
- Risk relevance

## Citation Requirements

AI outputs should be able to cite:

- File path
- Document path
- Task ID
- Plan ID
- Validation record ID
- Decision ID
- Repository fact ID

MVP citations may be coarse, but source links must be preserved.

## Privacy Requirements

The context protocol must support:

- Excluding ignored files.
- Excluding likely secrets.
- Avoiding broad repository sends without reason.
- Recording when context is sent to external providers.
- Applying provider policy restrictions.

## Freshness

Context freshness must include:

- Repository scan timestamp.
- Current branch where available.
- Working tree status where available.
- Document updated timestamp where available.
- Staleness warnings when context may be outdated.

## Workflow Types

MVP workflow types:

- `repository_summary`
- `task_drafting`
- `technical_planning`
- `agent_implementation`
- `change_review`
- `validation_explanation`
- `documentation_update`

## MVP Requirements

- Build context packages for planning and agent runs.
- Record context sources.
- Show context source summary in UI.
- Preserve classification of facts versus inference.
- Exclude obvious sensitive paths and ignored directories.
- Support user-added context.

## Acceptance Criteria

- A technical planning request includes task, repository, and documentation context.
- An agent run records the context package it used.
- A user can inspect context sources at summary level.
- AI outputs can reference source paths or artifacts.
- Sensitive or ignored context is not included by default.
