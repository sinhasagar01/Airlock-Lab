# Documentation Graph

## Purpose

This document defines how documentation should be connected across the workspace.

The documentation graph links product intent, architecture, specs, ADRs, RFCs, prompts, playbooks, tasks, plans, changes, and validation records.

## Core Principle

Documentation should not be a pile of Markdown files.

It should be a navigable source-of-truth graph that helps humans and AI understand why the system exists, how it is designed, what decisions were made, and how work should happen.

## Graph Nodes

Documentation graph nodes may include:

- Vision documents
- Product documents
- Architecture documents
- Specs
- ADRs
- RFCs
- Playbooks
- Prompt documents
- Agent definitions
- Tasks
- Plans
- Changes
- Validation records
- Repository summaries

## Graph Edges

Relationships may include:

- Defines
- Refines
- Supersedes
- Depends on
- Implements
- References
- Decides
- Validates
- Impacts
- Conflicts with
- Updates
- Generated from

Edges should be explicit where possible and inferred carefully where useful.

## Document Authority

Not all documents have equal authority.

Suggested authority order:

1. Current accepted ADRs
2. Current accepted RFCs
3. Current specs
4. Architecture docs
5. Product docs
6. Playbooks
7. Prompt docs
8. Generated summaries
9. Draft docs

When documents conflict, the workspace should surface the conflict instead of silently choosing one.

## Documentation Impact

When work changes the product, architecture, provider behavior, agent behavior, validation, or user workflows, the workspace should suggest documentation updates.

Impact candidates:

- Product docs
- Architecture docs
- Specs
- ADRs
- RFCs
- Playbooks
- Prompts
- README files

Suggested updates should be reviewable diffs, not automatic silent edits.

## AI Context Use

The context engine should use the documentation graph to select authoritative context.

Examples:

- Product planning should reference personas, use cases, and MVP scope.
- Architecture planning should reference system overview, module boundaries, and ADRs.
- Provider work should reference provider abstraction docs.
- Agent work should reference agent runtime and approval docs.

AI outputs should cite relevant documents when they shape decisions.

## Staleness And Supersession

The graph should track:

- Draft status
- Accepted status
- Rejected status
- Superseded status
- Last updated time
- Links to replacing docs

Stale docs should not silently guide important work.

## MVP Scope

The MVP should support:

- Markdown document discovery
- Basic document type classification
- Links between tasks, plans, and docs
- Manual links
- Generated documentation impact suggestions
- Recognition of ADR and RFC status directories

The MVP can defer:

- Full graph database
- Automatic conflict detection
- Advanced semantic link inference
- Team documentation ownership

## Success Criteria

The documentation graph is successful when:

- Users can navigate from intent to implementation context
- AI workflows use authoritative docs
- Decisions are easier to find
- Documentation impact is visible during changes
- Docs remain part of the engineering workflow
