# Navigation

## Purpose

This document defines navigation behavior for the workspace.

Navigation should help expert users move quickly between repositories, tasks, plans, agent runs, changes, docs, and approvals without losing context.

## Navigation Principles

- Keep workspace and repository context visible.
- Make active workflow state easy to find.
- Provide fast keyboard access.
- Support both object navigation and command navigation.
- Avoid burying approvals or risk states.
- Preserve user orientation during AI workflows.

## Primary Navigation

Primary navigation should include:

- Home
- Repositories
- Tasks
- Agent Runs
- Changes
- Documents
- Decisions
- Search
- Settings

The MVP may reduce this list if needed, but the conceptual areas should remain clear.

## Repository Navigation

Within a repository, users should be able to navigate:

- Overview
- Files
- Repository facts
- Documentation
- Git
- Tasks
- Changes
- Validation

Repository navigation should make the selected repository obvious.

## Workflow Navigation

Active workflows should expose their state and next action.

Examples:

- Draft task
- Plan awaiting approval
- Agent run in progress
- Run paused for approval
- Change under review
- Validation failed

Users should be able to return to active work from anywhere.

## Breadcrumbs

Breadcrumbs should show object hierarchy when useful.

Examples:

- Workspace / Repository / Task / Plan
- Workspace / Repository / Change / Validation
- Workspace / Documents / ADR

Breadcrumbs should not become overly long. Deep context can be shown in metadata panels.

## Command Palette

The command palette should act as a high-speed navigation and action layer.

It should support:

- Opening objects
- Running workflows
- Searching files and docs
- Creating tasks
- Starting scans
- Viewing approvals
- Opening settings

Commands should be permission-aware.

## Pending Approval Access

Pending approvals should be globally visible.

Users should not have to remember which agent run requested approval.

Approval access may appear in:

- Global status area
- Activity timeline
- Command palette
- Agent run view
- Change review view

## Activity Navigation

Activity should help users return to recent work.

Activity items may include:

- Repository scanned
- Task created
- Plan drafted
- Approval requested
- Agent run completed
- Change generated
- Validation failed
- Decision recorded

Activity should link to the relevant object.

## MVP Scope

The MVP should provide:

- Primary navigation
- Repository context switcher
- Object detail navigation
- Command palette foundation
- Active workflow return path
- Pending approval access

The MVP can defer:

- Customizable navigation
- Multi-window navigation
- Advanced graph navigation
- Team activity feeds

## Success Criteria

Navigation is successful when:

- Users can move quickly without losing context
- Active AI work is easy to find
- Pending approvals are visible
- Object relationships are navigable
- The product feels fast in daily use
