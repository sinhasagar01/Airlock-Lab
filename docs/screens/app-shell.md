# App Shell Screen

## Current Screen Direction

The app shell now follows a warm premium SaaS dashboard direction.

## Layout

- Fixed 260px desktop sidebar with product mark, primary navigation, approval count, and upgrade card.
- Main content scrolls independently from the sidebar.
- Workspace content begins 50px from the main column edge at the 1512px design frame.
- Hero header with workspace overview copy, provider and pending-approval pills, and choose-repository CTA.
- Three dashboard metric cards.
- Overview content grid for active repository, recent activity, indexing status, and indexed files.

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

## Required States

- Empty repository selection.
- Storage unavailable warning.
- Indexing idle, running, completed, and failed.
- Approval pending, approved, and rejected.
- File preview loading, ready, binary, too-large, outside-repository, and unavailable.
