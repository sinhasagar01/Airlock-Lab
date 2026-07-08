# Changelog

## Unreleased

- Completed the 10-task design migration loop for Overview, Repositories, Agent
  Runs, and Approvals with visual verifier passes against the final dashboard
  reference.
- Tuned Overview spacing, typography, sidebar polish, summary cards, Active
  Work, Recent Activity, and Quick Start to better match
  `references/final-dashboard-design/final-dashboard-design.png`.
- Migrated the Repositories tab to final-dashboard cards while preserving the
  repository picker, saved repositories, Git metadata, and indexing actions.
- Migrated the Agent Runs tab to final-dashboard cards with active run, provider
  context, recent runs, repository metadata, and approval-aware status.
- Migrated the Approvals tab to final-dashboard cards with queue summary,
  provider reasoning, risk/status pills, file summaries, and persisted
  approve/reject actions.
- Migrated the Changes tab to a final-dashboard review surface with a polished
  no-local-changes state, repository status facts, change-readiness feature
  blocks, agent-run CTA, and preserved indexed-file browsing/file previews.
- Migrated the Settings tab to final-dashboard workspace settings and
  maintenance cards with icon rows, status values, enabled reindex/review
  actions, and disabled unavailable/destructive maintenance controls.
- Completed a cross-tab visual consistency QA pass across Overview,
  Repositories, Agent Runs, Approvals, Changes, and Settings for shared header,
  summary cards, card spacing, badges, icons, CTAs, and overflow behavior.
- Began Phase 1 of the final dashboard design migration using
  `references/final-dashboard-design/final-dashboard-design.png` as the visual
  source of truth.
- Added shared UI primitives for `StatusPill`, `SummaryCard`, `DashboardCard`,
  `IconBadge`, `PrimaryButton`, and `SecondaryButton` while preserving
  compatibility wrappers for existing tab code.
- Refactored the desktop shell around `AppShell`, `Sidebar`,
  `SidebarNavItem`, `AppHeader`, and `UpgradeCard` without changing the
  six-tab state model or Tauri storage/indexing flows.
- Expanded semantic CSS tokens for app/sidebar backgrounds, navy primary
  actions, subtle text, agent/context accents, layout width, badge sizing, and
  icon-badge sizing.
- Updated the desktop UI to a warm premium SaaS dashboard direction.
- Added semantic CSS tokens for color, spacing, radius, shadows, typography, buttons, cards, badges, navigation, and preview states.
- Refactored shared status badges to use reusable classes instead of inline colors.
- Added generalized typography tokens/classes and improved visual hierarchy across the dashboard.
- Added a shared icon primitive and replaced route-local dashboard/nav glyphs.
- Tuned the desktop shell toward the provided PNG proportions, including a 1512x832 default window, narrower sidebar, tighter metric cards, and muted active-repository header band.
- Reworked the desktop shell so the sidebar is fixed and the main dashboard content scrolls independently.
- Tightened repository and activity panels to preserve the first-viewport dashboard composition with real repository data.
- Preserved safe file preview behavior while improving selected-file detail and preview state styling.
- Documented frontend styling, file preview, repository indexing, and app shell screen behavior.
