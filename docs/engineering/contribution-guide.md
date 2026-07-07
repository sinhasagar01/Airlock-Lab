# Contribution Guide

## Purpose

This guide defines how contributors should work in this repository.

The repository is documentation-first. Product, architecture, AI behavior, UX, prompts, playbooks, and specs should guide implementation.

## Contribution Principles

- Read relevant docs before changing files.
- Keep changes scoped.
- Preserve module boundaries.
- Update documentation when behavior changes.
- Record durable decisions in ADRs or RFCs.
- Treat prompts as product behavior.
- Keep human approval and provider independence intact.

## Before Starting Work

1. Identify the task or create one.
2. Read the relevant product docs.
3. Read the relevant architecture docs.
4. Check existing specs.
5. Check ADRs and RFCs.
6. Identify validation requirements.

## Types Of Contributions

### Documentation

Documentation changes should be clear, linked, and consistent with existing terminology.

Use templates when creating:

- Product docs
- Architecture docs
- Specs
- ADRs
- RFCs
- Prompts
- Tasks

### Specs

Specs should define buildable behavior.

Include:

- Goals
- Non-goals
- Requirements
- States
- Acceptance criteria
- Validation plan

### Code

Code changes should follow the documented architecture.

Before implementation, confirm:

- Product intent is clear.
- Technical plan exists for non-trivial work.
- Module ownership is clear.
- Tests or validation are known.

### Prompts

Prompt changes must be reviewed for:

- Scope
- Context use
- Output structure
- Safety
- Provider independence
- Evaluation criteria

### ADRs And RFCs

Use ADRs for durable architecture decisions.

Use RFCs for proposals, tradeoffs, and open decision spaces.

## Review Requirements

Every meaningful contribution should be reviewed for:

- Scope alignment
- Architecture fit
- Safety and permissions
- Provider independence
- Testing and validation
- Documentation impact

## Git Expectations

- Keep commits focused.
- Use clear commit messages.
- Do not mix unrelated changes.
- Do not overwrite unrelated user work.
- Push only after verifying the intended branch and remote.

## Definition Of Done

A contribution is done when:

- The requested change is complete.
- Relevant docs are updated.
- Validation is run or gaps are documented.
- Risks are understood.
- The work is committed when appropriate.
