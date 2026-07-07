# Navigation Components

## Purpose

This document defines navigation component expectations for the design system.

Navigation components should support fast expert movement through workspaces, repositories, tasks, plans, agent runs, changes, docs, and approvals.

## Component Types

### Primary Sidebar

The primary sidebar should provide access to top-level product areas.

Expected items:

- Home
- Repositories
- Tasks
- Agent Runs
- Changes
- Documents
- Decisions
- Settings

The sidebar should show current selection and support compact density.

### Repository Switcher

The repository switcher should show:

- Active repository
- Repository status
- Branch where available
- Quick switch action

It should make workspace context obvious.

### Local Navigation

Local navigation should appear within repository or object views.

Examples:

- Overview
- Files
- Git
- Docs
- Tasks
- Changes
- Validation

Local navigation should not compete with primary navigation.

### Breadcrumbs

Breadcrumbs should orient users within nested objects.

They should support:

- Object hierarchy
- Quick parent navigation
- Truncation for long paths
- Tooltips for full labels

### Tabs

Tabs should organize peer views within one object.

Examples:

- Summary
- Context
- Diff
- Validation
- Activity

Tabs should not be used for unrelated navigation.

### Status Navigation

Navigation should surface important status:

- Active agent run
- Pending approval
- Failed validation
- High-risk change

Status indicators should be concise and accessible.

## Interaction Requirements

Navigation components should support:

- Keyboard focus
- Visible active state
- Hover state
- Disabled state where needed
- Tooltip for truncated labels
- Screen reader labels
- Stable sizing

## MVP Scope

The MVP should include:

- Primary sidebar
- Repository switcher
- Local navigation
- Breadcrumbs
- Pending approval indicator
- Active workflow return link

The MVP can defer:

- Fully customizable navigation
- Drag-reorder navigation
- Team-specific nav sections
- Advanced graph navigation

## Success Criteria

Navigation components are successful when:

- Users know where they are
- Active work is easy to resume
- Repository context is never ambiguous
- Pending approvals are visible
- Navigation remains compact and calm
