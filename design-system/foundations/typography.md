# Typography

## Purpose

This document defines typography principles for the design system.

Typography must support dense engineering workflows, long-form documentation, code-adjacent content, review surfaces, and fast scanning.

## Typography Principles

- Prioritize readability over personality.
- Use hierarchy to support scanning.
- Keep interface text compact but legible.
- Avoid oversized type inside operational surfaces.
- Use monospace text for paths, commands, code, tokens, and IDs.
- Do not rely on negative letter spacing.
- Ensure text fits across responsive layouts.

## Type Roles

The system should define roles for:

- Page title
- Section heading
- Panel heading
- Card title
- Body text
- Secondary text
- Metadata text
- Label text
- Button text
- Code text
- Command text
- Status text
- Empty-state text
- Error text

## Interface Typography

Operational UI should use restrained type scale.

Dense areas include:

- Sidebars
- Toolbars
- Diff reviews
- Agent timelines
- Validation summaries
- Tables
- Metadata panels
- Approval previews

These surfaces should favor clarity and alignment over expressive display type.

## Documentation Typography

Documentation views should support longer reading.

Requirements:

- Comfortable line length
- Clear heading hierarchy
- Strong code block readability
- Distinct inline code
- Scannable lists
- Useful metadata treatment

Docs should feel integrated into the product, not like a separate blog renderer.

## Code And Path Typography

Use monospace for:

- File paths
- Commands
- Code
- Package names
- Environment variables
- IDs
- Provider names where technical
- Model IDs

Monospace should be legible at small sizes.

## Status Typography

Status labels should be concise.

Examples:

- Pending
- Approved
- Failed
- Not run
- Paused
- Needs review
- High risk

Avoid verbose labels inside compact controls.

## Responsive Behavior

Text should not overflow controls.

Guidelines:

- Allow wrapping where appropriate.
- Truncate only when full value is accessible.
- Avoid viewport-based font scaling.
- Preserve readable minimum sizes.
- Keep button labels concise.

## MVP Scope

The MVP should define:

- Core type roles
- Monospace usage
- Heading hierarchy
- Metadata style
- Status label style
- Documentation reading style

Exact font family and token values can be finalized during visual design implementation.

## Success Criteria

Typography is successful when:

- Dense UI remains readable
- Docs are comfortable to read
- Code-adjacent information is clearly distinguished
- Status and metadata scan quickly
- Text does not break layouts
