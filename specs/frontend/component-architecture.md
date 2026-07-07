# Frontend Component Architecture

## Status

Draft implementation spec.

## Purpose

This spec defines the frontend component architecture for the MVP app shell and core product surfaces.

The frontend should render durable workspace objects, AI workflow state, approvals, validation, and review surfaces without owning domain logic or provider behavior.

## References

- [App Shell Spec](app-shell.md)
- [Interaction Principles](../../docs/ux/interaction-principles.md)
- [Navigation Components](../../design-system/components/navigation.md)
- [Module Boundaries](../../docs/architecture/module-boundaries.md)

## Component Principles

- Components render domain state; they do not invent domain state.
- Provider SDKs must never be imported by UI components.
- Permission and approval logic must come from application services.
- Review, validation, and risk states must be first-class UI concepts.
- Shared UI primitives belong in `packages/ui`.
- Product-specific composition belongs in the app layer.

## Component Layers

### App Composition

Owns route-level layout and page composition.

Examples:

- `AppShell`
- `WorkspaceHomePage`
- `RepositoryOverviewPage`
- `TaskDetailPage`
- `PlanDetailPage`
- `AgentRunDetailPage`
- `ChangeReviewPage`
- `DocumentsPage`
- `SettingsPage`

### Product Components

Owns reusable product-aware views.

Examples:

- `RepositorySummary`
- `TaskEditor`
- `PlanSummary`
- `AgentRunTimeline`
- `ApprovalPreview`
- `ChangeFileList`
- `ValidationSummary`
- `RiskSummary`
- `ContextSourceList`

### UI Primitives

Owns design-system primitives.

Examples:

- Button
- Icon button
- Input
- Textarea
- Select
- Tabs
- Dialog
- Tooltip
- Sidebar
- Breadcrumbs
- Badge
- Table
- Split pane
- Empty state

### Data Display Components

Owns structured display patterns.

Examples:

- Metadata list
- Status row
- Timeline
- Key-value panel
- Source citation list
- Diff wrapper
- Command output block

## Route Components

### Workspace Home

Must compose:

- Registered repository list
- Recent activity
- Open tasks
- Active runs
- Pending approvals
- Recent changes

### Repository Overview

Must compose:

- Repository identity header
- Scan status
- Stack summary
- Documentation summary
- Git summary
- Validation command candidates
- Repository facts preview

### Task Detail

Must compose:

- Task fields
- Scope editor
- Requirements and acceptance criteria
- Open questions
- Linked plans
- Generate plan action

### Plan Detail

Must compose:

- Approach
- Affected areas
- Assumptions
- Risks
- Validation plan
- Approval state
- Start agent run action

### Agent Run Detail

Must compose:

- Run status header
- Goal and agent role
- Context sources
- Tool timeline
- Pending approvals
- Output artifacts
- Files touched
- Final summary

### Change Review

Must compose:

- Changed file list
- Diff area
- Rationale
- Risk summary
- Validation summary
- Documentation impact
- Accept, revise, reject actions

## State Display Requirements

All major product surfaces must support:

- Loading
- Empty
- Error
- Stale
- Pending approval
- Running
- Paused
- Completed
- Failed

States should be explicit and accessible.

## Accessibility Requirements

- Interactive components must be keyboard reachable.
- Focus states must be visible.
- Status must not rely on color alone.
- Dialogs must trap focus correctly.
- Tooltips must not contain critical-only information.
- Truncated values must expose full value.

## Package Ownership

- `packages/ui` owns primitives and generic layout components.
- App layer owns route composition and product-specific pages.
- `packages/core` owns shared domain types used by components.
- UI components must call application hooks/services, not provider adapters.

## MVP Acceptance Criteria

- App shell can host all MVP route views.
- Shared primitives can support navigation, approvals, timelines, summaries, and forms.
- Product components display task, plan, run, change, validation, and approval state.
- UI has no direct dependency on provider SDKs.
- Pending approval and active run states are globally visible.
