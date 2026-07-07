# Command Surfaces

## Purpose

This document defines command surfaces for the workspace.

Command surfaces let expert users move quickly, start workflows, inspect state, and perform actions without digging through navigation.

## Command Surface Types

### Command Palette

The command palette is the primary global command surface.

It should support:

- Search
- Navigation
- Object creation
- Workflow launch
- Settings access
- Approval access
- Recent items

### Inline Commands

Inline commands appear near the object being acted on.

Examples:

- Generate plan from task
- Approve plan
- Start agent run
- Request revision
- Run validation
- Save as decision

### Context Menus

Context menus should expose secondary actions on specific objects.

Examples:

- Copy link
- Open related docs
- Create follow-up task
- Mark as reviewed
- Archive

### Keyboard Shortcuts

Keyboard shortcuts should support frequent actions.

Initial shortcuts should focus on:

- Open command palette
- Global search
- Create task
- Go to repository
- Go to active run
- Open pending approvals
- Toggle side panel

## Command Design Principles

Commands should be:

- Verb-led
- Specific
- Permission-aware
- Searchable
- Reversible where practical
- Clear about side effects
- Linked to object context

Command names should avoid vague wording like "do it" or "run AI."

## Permission-Aware Commands

Commands with meaningful side effects should preview consequences.

Examples:

- Write files
- Run commands
- Modify Git state
- Publish pull request
- Call external integration
- Send sensitive context to provider

The command surface should not become a shortcut around approvals.

## AI Commands

AI commands should be scoped.

Good examples:

- Summarize repository
- Draft product task
- Generate technical plan
- Review current change
- Explain validation failure
- Suggest documentation updates

Poor examples:

- Make better
- Fix everything
- Auto-code project

The command should communicate intent and boundaries.

## Command Results

Command results should be routed into durable artifacts where relevant:

- Task
- Plan
- Agent run
- Change
- Validation record
- Document
- Decision

Commands should not produce important output that only exists in ephemeral UI.

## MVP Scope

The MVP should support:

- Command palette shell
- Object search
- Create task command
- Scan repository command
- Generate plan command
- Start agent run command
- View pending approvals command
- Run validation command

The MVP can defer:

- User-custom commands
- Plugin command contributions
- Complex shortcut editor
- Command macros

## Success Criteria

Command surfaces are successful when:

- Expert users can move quickly
- Actions remain safe and permissioned
- Commands produce structured artifacts
- AI commands are scoped and understandable
- The product feels powerful without becoming reckless
