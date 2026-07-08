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

## Implemented Type Tokens

The desktop app defines reusable typography tokens in `apps/desktop/src/styles.css`.

- `--font-size-display`: workspace and screen-level hero titles.
- `--font-size-title`: future page and object titles.
- `--font-size-heading`: panel and section headings.
- `--font-size-subheading`: card titles and activity row titles.
- `--font-size-body`: default product body copy.
- `--font-size-lead`: hero supporting copy only.
- `--font-size-meta`: metadata, labels, supporting details.
- `--font-size-caption`: compact captions and dense status contexts.
- `--font-family-sans`: primary product text stack, led by Inter when
  available and falling back to Apple/SF, Segoe UI, Roboto, and polished sans
  system fonts.
- `--font-family-display`: page-title display stack, aligned to the same
  dashboard-friendly Inter/system stack.
- `--line-height-tight`: display headings.
- `--line-height-heading`: titles and headings.
- `--line-height-body`: paragraphs and explanations.
- `--line-height-meta`: labels and metadata.
- `--text-page-title-weight`: confident screen titles without making every heading heavy.
- `--text-page-subtitle-weight`: calm hero support copy.
- `--text-card-title-weight`: reusable panel, card, and activity-title weight.
- `--text-metric-weight`: dashboard metric numerals.
- `--text-label-weight`: uppercase labels and compact metadata.
- `--text-body-weight`: default body copy.
- `--text-caption-weight`: dense supporting text.
- `--text-badge-weight`: status pill text.

Reusable classes exist for future screens:

- `.type-display`
- `.type-title`
- `.type-heading`
- `.type-body`
- `.type-meta`

The default `p` style is intentionally body-sized. Screens should opt into `.hero-copy` or type role classes when text needs more prominence.

Do not solve hierarchy by making every element bolder. The dashboard frame uses display scale for the page title, medium-bold support copy, controlled card titles, and quieter body/caption text.

The app avoids decorative brand-first fonts for operational UI. Inter plus
native dashboard fonts keeps repository paths, status labels, and dense
activity text easier to scan while matching the friendly SaaS tone of the final
dashboard reference.

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

The current MVP values are implemented in CSS and should be treated as the source of truth until a package-level token export is introduced.

## Success Criteria

Typography is successful when:

- Dense UI remains readable
- Docs are comfortable to read
- Code-adjacent information is clearly distinguished
- Status and metadata scan quickly
- Text does not break layouts
