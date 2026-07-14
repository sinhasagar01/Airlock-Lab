# App Shell Screen

## Current Screen Direction

The app shell now follows a warm premium SaaS dashboard direction.

## Layout

- Fixed 304px desktop sidebar with product mark, primary navigation, approval
  count, Pro Intelligence card, and user footer.
- Main content scrolls independently from the sidebar.
- Short desktop windows use height-aware sidebar spacing that keeps the Pro
  Intelligence card and user footer visible.
- Workspace content begins 50px from the main column edge at the 1512px design frame.
- Overview keeps the large workspace hero. The other five tabs use compact,
  page-specific headers with the same provider, pending-approval, and
  choose-repository actions.
- Overview keeps the full dashboard metric cards; feature tabs use a compact
  context-metric variant so primary workflows begin in the first viewport.
- Tab content below the shared metrics uses the final dashboard card system for
  Overview, Repositories, Agent Runs, Approvals, Changes, and Settings.
- Repositories now presents Repository Intelligence: repository overview, Git
  state, index summary, important folders, key files, package/framework hints,
  saved repositories, and entry points into file browsing, reindexing, agent
  runs, and changes.
- Repositories also exposes a `Demo workflow` card that continues the seeded
  MVP review path into the connected agent run and approval request.
- Agent Runs now uses a master/detail workflow with a task composer backed by
  the mock provider, selectable durable runs, provider and model metadata,
  repository context, a structured proposed plan surface, persisted proposal
  status, expected affected files, patch artifact state, risk summary,
  validation strategy, generated patch artifact placeholders, and approval
  handoff.
- Approvals now uses a master/detail review workflow with selectable approval
  requests, linked agent run metadata, proposed plan review, affected files,
  persisted proposal status, risk and validation sections, repository context,
  generated patch artifact placeholders, matching local Git diff review, patch
  artifact state, and decision controls.
- Changes includes read-only Git status, clean/dirty state,
  staged/unstaged/untracked counts, selectable changed-file rows, local Git diff
  preview, manual refresh, approval-match indicators for exact proposed-file
  path matches, and indexed-file browsing/file preview access.
- Settings includes workspace settings rows and confirmation-gated maintenance
  actions. Reindexing the selected repository is available through the existing
  safe indexing boundary; cache clearing and reset remain disabled until scoped
  app-local delete boundaries exist.

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
- Settings maintenance rows use explicit action states, disabled unavailable
  controls, and a typed reset-confirmation field so destructive future actions
  are designed as guarded flows from the beginning.
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
  persisted proposed-change state, approval handoff, and disabled diff action
  until generated diffs exist.
- Mock agent task empty, running, persisted-success, session-only fallback, and
  failure states.
- Generated patch artifact placeholder states separate from local Git diff
  states.
- Approval queue selected state, approval detail, proposed plan review, matching
  local-diff availability, selected approval diff, missing local diff, and
  approve/reject decision states that update the linked proposed-change status.
- Git status loading, clean, changed, not-a-Git-repository, and unavailable
  states.
- Local diff loading, text diff, untracked, binary, too-large, unavailable, and
  no-diff-content states.
- Approval pending, approved, and rejected.
- File preview loading, ready, binary, too-large, outside-repository, and unavailable.
- Demo workflow available, connected-agent-run selected, connected approval
  selected, matching local diff available, and no matching local diff yet.
- Settings maintenance reindex idle, running, success, and error states.
- Cache clearing unavailable state with explanation.
- Reset workspace guarded-but-unavailable state with `RESET WORKSPACE`
  confirmation copy and disabled execution.
