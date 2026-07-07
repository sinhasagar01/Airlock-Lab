# UI Package

## Purpose

`packages/ui` owns reusable design-system primitives and generic interaction components.

It should provide high-quality building blocks for the app without owning product domain logic.

## Responsibilities

- Buttons
- Icon buttons
- Inputs
- Textareas
- Selects
- Tabs
- Dialogs
- Tooltips
- Sidebars
- Breadcrumbs
- Badges
- Tables
- Empty states
- Timeline primitives
- Status indicators
- Layout primitives

## Must Not Own

- Workspace domain logic
- Provider calls
- Agent runtime behavior
- Permission policy
- Repository indexing
- Persistence logic

## Design Requirements

- Keyboard accessible
- Visible focus states
- Stable sizing
- Clear loading, disabled, error, and active states
- No color-only status meaning
- Compact enough for dense engineering workflows

## MVP Exports

Expected exports:

- Navigation primitives
- Form primitives
- Dialog primitives
- Status components
- Timeline component
- Metadata display component
- Empty/error state components

## Acceptance Criteria

- Product pages can compose MVP views from UI primitives.
- UI primitives do not import product services.
- Components meet baseline accessibility expectations.
