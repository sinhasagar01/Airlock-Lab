# App Shell Spec

## Status

Draft MVP spec.

## Purpose

This spec defines the MVP frontend app shell for the AI-native engineering workspace.

The app shell provides navigation, workspace and repository context, command access, active workflow visibility, approval access, and the main layout for core product surfaces.

## References

- [Interaction Principles](../../docs/ux/interaction-principles.md)
- [Information Architecture](../../docs/ux/information-architecture.md)
- [Navigation](../../docs/ux/navigation.md)
- [Command Surfaces](../../docs/ux/command-surfaces.md)
- [Navigation Components](../../design-system/components/navigation.md)

## MVP Goals

The app shell must:

- Show active workspace and repository context.
- Provide primary navigation.
- Provide a command palette entry point.
- Surface active agent runs.
- Surface pending approvals.
- Host task, plan, agent run, change, repository, and document views.
- Keep expert workflows fast and inspectable.

## Layout Regions

### Primary Sidebar

### Requirements

- Shows top-level navigation.
- Shows current active item.
- Remains stable across main workflows.
- Supports compact density.

### MVP Items

- Home
- Repositories
- Tasks
- Agent Runs
- Changes
- Documents
- Settings

### Top Bar

### Requirements

- Shows active workspace.
- Shows active repository.
- Provides command palette trigger.
- Shows pending approvals indicator.
- Shows active run indicator when applicable.

### Main Content

### Requirements

- Hosts object detail views.
- Supports repository overview, task detail, plan detail, agent run detail, change review, and docs index.
- Maintains readable content width where appropriate.
- Supports dense operational layouts where needed.

### Secondary Panel

### Requirements

- Shows contextual metadata.
- May show context sources, linked artifacts, risks, validation, or activity.
- Can be collapsed.

## Primary Views

### Workspace Home

Must show:

- Registered repositories
- Recent activity
- Open tasks
- Active runs
- Pending approvals
- Recent changes

### Repository Overview

Must show:

- Repository identity
- Path
- Scan status
- Detected stack
- Documentation summary
- Git status
- Validation command candidates
- Rescan action

### Task Detail

Must show:

- Task fields
- Scope
- Non-goals
- Acceptance criteria
- Open questions
- Linked plans
- Generate plan action

### Plan Detail

Must show:

- Approach
- Affected areas
- Assumptions
- Risks
- Validation plan
- Approval state
- Start agent run action after approval

### Agent Run Detail

Must show:

- Run status
- Goal
- Agent role
- Context sources summary
- Tool timeline
- Approval requests
- Files touched
- Outputs
- Final summary

### Change Review

Must show:

- Changed files
- Diff area
- Rationale
- Risk summary
- Validation summary
- Documentation impact
- Accept, revise, reject actions

## Command Palette

MVP commands:

- Open repository
- Scan repository
- Create task
- Generate plan
- Start agent run
- View pending approvals
- View active run
- Run validation
- Open settings

Commands with side effects must route through approval behavior where required.

## State Requirements

The shell must visibly represent:

- Loading
- Empty
- Error
- Running
- Paused
- Awaiting approval
- Completed
- Failed

Important AI workflow states must not be hidden in secondary panels only.

## Accessibility Requirements

- Navigation must be keyboard accessible.
- Focus states must be visible.
- Command palette must support keyboard operation.
- Status indicators must not rely on color alone.
- Truncated labels must expose full value.

## MVP Non-Goals

- Full IDE editor.
- Multi-window support.
- Plugin-contributed UI.
- Team navigation.
- Advanced graph visualization.

## Acceptance Criteria

- User can navigate between Home, Repositories, Tasks, Agent Runs, Changes, Documents, and Settings.
- Active workspace and repository are visible.
- Pending approvals are globally reachable.
- Active agent run is globally reachable.
- Command palette can launch MVP workflows.
- Main product objects render in stable detail views.
- Shell remains usable without network access.
