# App Shell Screen

## Current Screen Direction

The app shell now follows a warm premium SaaS dashboard direction.

## Layout

- Fixed 304px desktop sidebar with product mark, primary navigation, approval
  count, Pro Intelligence card, and user footer.
- Main content scrolls independently from the sidebar.
- Workspace content begins 50px from the main column edge at the 1512px design frame.
- Hero header with workspace overview copy, provider and pending-approval pills, and choose-repository CTA.
- Three dashboard metric cards.
- Tab content below the shared metrics uses the final dashboard card system for
  Overview, Repositories, Agent Runs, Approvals, Changes, and Settings.
- Repositories now presents Repository Intelligence: repository overview, Git
  state, index summary, important folders, key files, package/framework hints,
  saved repositories, and entry points into file browsing, reindexing, agent
  runs, and changes.
- Agent Runs now uses a master/detail workflow with selectable runs, provider
  and model metadata, repository context, a structured proposed plan surface,
  expected affected files, risk summary, validation strategy, and approval
  handoff.
- Changes includes a no-local-changes review state, change-readiness feature
  blocks, repository status facts, and indexed-file browsing/file preview access.
- Settings includes workspace settings rows and workspace maintenance actions.

## Visual System

- Warm off-white background.
- White elevated cards with soft shadows.
- Deep navy typography and primary actions.
- Coral accent for active navigation, secondary actions, progress, and emphasis.
- Pill badges for status and counts.
- Reusable icon primitive for sidebar navigation, dashboard metrics, and sidebar actions.
- Clear typography hierarchy: display title, hero lead, panel headings, compact metadata, and dense file rows.
- Repository summary uses a muted header band, one boxed local-path field, and unboxed branch/open-change metadata so real paths do not break the first-viewport composition.
- Recent activity uses a compact timeline with a text action in the card header.
- Changes and Settings reuse the same card padding, icon badges, status pills,
  and button treatments as the migrated Overview surfaces.
- Repository Intelligence uses fact grids, calm chips, key-file rows, folder
  rows, and disabled/unavailable states when data cannot be safely derived yet.

## Required States

- Empty repository selection.
- Storage unavailable warning.
- Indexing idle, running, completed, and failed.
- Repository Intelligence empty state when no repository is selected.
- Repository Intelligence unavailable states for package metadata that has not
  been read through a safe bounded path.
- Agent run detail selected state, structured proposed plan state, linked
  approval handoff, and disabled diff action until generated diffs exist.
- Approval pending, approved, and rejected.
- File preview loading, ready, binary, too-large, outside-repository, and unavailable.
