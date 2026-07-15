# Final Dashboard Design Implementation Spec

## Source of Truth

`final-dashboard.png` is the visual source of truth.

This design must be implemented across all six product tabs:

1. Overview
2. Repositories
3. Agent Runs
4. Approvals
5. Changes
6. Settings

Do not copy the old UI.
Do not make small visual tweaks.
Do not approximate the previous design.
This is a full dashboard design-system migration.

## Design Direction

The UI should feel like a premium AI-native desktop product:

- Apple-level polish
- Stripe-level spacing and hierarchy
- Linear-level information density
- Vercel-level calmness
- Raycast-level utility
- GitHub Desktop-level product clarity

## Visual System

The final design uses:

- fixed left sidebar
- white/warm off-white app shell
- large confident page heading
- clear eyebrow label
- soft card surfaces
- subtle borders
- soft shadows
- navy primary actions
- coral accent for approval/pending states
- green for ready/success states
- purple/blue for agent/context accents
- strong but controlled typography hierarchy
- reusable card system
- calm badges
- clean icon system
- right-side supporting panels where useful

## Core Layout

The app should have one shared shell:

- macOS-style window chrome if already present
- fixed sidebar
- main content area
- shared top header
- shared status pills
- shared choose repository button
- shared summary metric cards

Each tab changes only the main tab content below the shared header and metric cards.

## Sidebar

Sidebar must include:

- ADW logo
- product name
- nav items:
  - Overview
  - Repositories
  - Agent Runs
  - Approvals
  - Changes
  - Settings
- active state matching final design
- approvals count badge
- Pro Intelligence card
- user footer

Sidebar must be fixed and full height.

## Header

Header must include:

- eyebrow label: WORKSPACE OVERVIEW or relevant tab label
- title: Airlock (the reference PNG beside this spec predates the rename and
  still shows "AI Developer Workspace"; the name is the only difference, and the
  spec is authoritative for it)
- subtitle
- provider status pill
- pending approvals pill
- choose repository button

## Summary Cards

All tabs should keep consistent summary cards:

- Repositories
- Agent runs
- Context mode

They should use the same visual system as final design.

## Six Tab Content Requirements

### Overview

Use the final design:

- Active Work card
- Recent Activity card
- Quick Start card
- Repository/path/branch/open changes details
- timeline-style activity feed
- strong CTA/action structure

### Repositories

Should show:

- active repository card
- repository path
- branch
- open changes
- indexed status
- connect another local repository card
- choose repository CTA

Use same card style as Overview.

### Agent Runs

Should show:

- active run card
- recent run card
- run status badges
- repository/branch/path details
- elapsed/progress information where available

Do not use generic empty cards.

### Approvals

Should show:

- Human approval queue
- pending approval plan card
- included changes summary
- provider reasoning summary
- View plan details
- Review changes CTA
- empty queue state below

### Changes

Should show:

- polished empty state if no changes
- illustration-style panel or structured card
- repository status
- generated diffs
- release readiness
- Start an agent run CTA

### Settings

Should show:

- Workspace Settings card
- Provider adapters row
- Local storage row
- Indexing policy row
- Approval defaults row
- Workspace maintenance card
- Reindex repositories
- Clear caches
- Reset workspace

## Must Preserve Existing Functionality

Do not break:

- safe Tauri file preview command
- file size limits
- binary file state
- too-large state
- loading state
- error state
- selected file metadata
- repository indexing
- provider abstraction
- approvals flow
- existing routes
- existing app state
- existing tests

## Design Tokens

Create or update semantic tokens for:

- app background
- sidebar background
- card background
- muted surface
- primary text
- secondary text
- subtle text
- border
- shadow
- navy action
- coral accent
- green success
- purple agent
- blue context
- radius scale
- spacing scale
- typography scale

Avoid hardcoded scattered styles.

## Component System

Create or refactor reusable components:

- AppShell
- Sidebar
- SidebarNavItem
- AppHeader
- StatusPill
- SummaryCard
- DashboardCard
- ActionCard
- DetailRow
- ActivityTimeline
- QuickStartCard
- ApprovalCard
- EmptyState
- SettingsRow
- UpgradeCard
- PrimaryButton
- SecondaryButton
- IconBadge

## Quality Bar

The result should not look like a plain Tailwind/admin template.

It must look like the attached final design.

Completion requires:

- strong visual hierarchy
- correct sidebar layout
- consistent card system
- consistent badges
- consistent typography
- consistent spacing
- all six tabs redesigned
- docs updated
- functionality preserved
- checks passing
