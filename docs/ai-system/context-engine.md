# Context Engine

## Purpose

This document defines how the workspace selects, ranks, prepares, and explains context for AI workflows.

The context engine is critical because AI quality depends less on raw access to everything and more on precise access to the right information.

## Core Responsibility

The context engine answers:

- What does the system know?
- Where did that knowledge come from?
- What context is relevant to this task?
- What context should be sent to an AI provider?
- What should be cited in the output?
- What remains uncertain?

## Context Sources

The context engine may use:

- Repository files
- Repository facts
- File tree metadata
- Language and framework metadata
- Package and script metadata
- Git metadata
- Documentation
- Product tasks
- Technical plans
- ADRs
- RFCs
- Prompts
- Playbooks
- Agent run history
- Validation records
- User corrections
- Project memory

## Context Types

### Observed Facts

Facts derived directly from files, commands, Git state, or integration data.

Examples:

- A file exists
- A package script exists
- A dependency is declared
- A test command failed

### Inferred Facts

Conclusions generated from analysis or AI reasoning.

Examples:

- This directory appears to be the app shell
- This module likely owns repository scanning
- This test failure may relate to a recent change

### User-Confirmed Knowledge

Knowledge explicitly confirmed or corrected by the user.

Examples:

- This is the intended architecture
- This provider is preferred for planning
- This workflow is out of scope for MVP

### Generated Artifacts

AI-created or workflow-created artifacts that may be useful context but should not be treated as observed facts.

Examples:

- Repository summaries
- Plans
- Review reports
- Agent run summaries

## Ranking Principles

Context should be ranked by:

- Task relevance
- Source reliability
- Recency
- User confirmation
- File proximity
- Dependency relationship
- Documentation authority
- Prior decision relevance
- Validation evidence

The system should avoid overloading providers with low-signal context.

## Context Selection Flow

1. Identify the workflow goal.
2. Identify the target repository or artifact.
3. Gather direct references from the user request.
4. Retrieve related repository facts.
5. Retrieve relevant docs and decisions.
6. Retrieve related tasks, plans, and previous runs.
7. Rank candidate context.
8. Build a provider-ready context package.
9. Record what context was used.
10. Expose context sources in the output where relevant.

## Context Packages

A context package should include:

- Goal
- User request
- Relevant task or plan
- Selected files or excerpts
- Repository facts
- Relevant docs
- Relevant decisions
- Constraints
- Known risks
- Required output format

Context packages should be structured and provider-independent.

## Citations And Evidence

Important claims should cite evidence.

Evidence may include:

- File path
- Line range where available
- Command output record
- Document link
- Task link
- Decision link
- Validation record

The system should distinguish between citation-backed claims and AI inference.

## Privacy And Scope

The context engine should respect user and workspace boundaries.

It should avoid sending:

- Secrets
- Credentials
- Large unrelated file sets
- Ignored files unless explicitly needed
- Sensitive local configuration
- Broad repository context without clear purpose

Future specs should define secret detection and redaction behavior.

## Context Freshness

The system should track whether context may be stale.

Freshness signals:

- Last repository scan time
- Current Git branch
- Current commit or working tree state
- File modification time
- Index version
- Validation timestamp
- Decision status

If context may be stale, the system should say so.

## User Control

The user should be able to:

- Inspect major context sources
- Add context
- Remove context
- Correct inferred knowledge
- Mark a doc as authoritative
- Request a narrower or broader context set

Expert users need control over what the AI sees.

## MVP Scope

The MVP context engine should support:

- Repository file discovery
- Documentation discovery
- Basic repository facts
- Task and plan context
- Context package assembly
- Source recording
- Basic citation links
- User correction notes

The MVP can defer:

- Advanced semantic indexing
- Cross-repository graph reasoning
- Production signal context
- Team-wide memory
- Automated secret redaction beyond conservative exclusions

## Success Criteria

The context engine is successful when:

- AI outputs are grounded in relevant workspace context
- Users can see what context mattered
- Facts and inference are separated
- Context does not leak provider-specific assumptions
- The workspace improves as users correct or confirm knowledge
