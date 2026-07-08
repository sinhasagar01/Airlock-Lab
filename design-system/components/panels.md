# Panels And Cards

## Purpose

Panels hold dashboard summaries, repository state, activity, approval requests, file browsing, and preview content.

## Implemented Style

- White surface with soft neutral border.
- Extra-large radius for dashboard cards.
- Large soft shadow for elevation.
- Generous padding on overview panels.
- Pale blue-gray nested surfaces for metadata and file detail facts.
- Dark navy code preview surface for readable text content.

## Patterns

- Use `DashboardCard` / `.dashboard-card` for new final-dashboard surfaces.
- Use `.panel` for existing major screen sections while tabs migrate.
- Use `SummaryCard` / `.summary-card` for dashboard metrics.
- Use `.metadata-list` for repository and file facts.
- Use `.preview-state` for loading, binary, too-large, outside-repository, and unavailable preview states.
- Use `.activity-list`, `.activity-item`, `.activity-title-row`, and `.micro-badge` for the compact recent-activity timeline.

## Dashboard Migration

The desktop app now has shared primitives for `StatusPill`, `SummaryCard`,
`DashboardCard`, `IconBadge`, `PrimaryButton`, and `SecondaryButton`.
Overview, Repositories, Agent Runs, and Approvals use the final dashboard card
system. Changes and Settings can migrate onto the same primitives in later
phases without changing storage, indexing, approval, or file-preview behavior.

## Recent Activity Timeline

The overview `Workspace Pulse` card follows the design frame:

- Title text uses `Workspace Pulse` title case with the `View History` text action aligned to the heading block.
- Small status markers, not oversized radio controls.
- A subtle warm vertical rail between timeline items.
- Inline micro-badges for ready, pending, and completed states.
- First marker is active green; pending and completed markers are intentionally quieter.
- Medium activity titles with quieter detail copy.
- Controlled row spacing so the card reads as a journey rather than a generic list.

## Constraints

- Do not weaken file preview safety states for visual polish.
- Avoid nesting decorative cards inside decorative cards.
- Keep dense indexed-file rows compact and stable.
