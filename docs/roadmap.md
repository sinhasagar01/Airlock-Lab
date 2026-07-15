# Roadmap

Working backlog for AI Developer Workspace. This file is the single home for
work that is agreed but not yet scheduled. It is reconciled against the code as
items land rather than kept as an aspirational list.

Last reconciled: 2026-07-15.

## Product Boundary

The product is a change-control plane for AI-generated diffs: nothing reaches a
working tree unless a human approved it and the machine can prove exactly what
it did. Items are ordered by how much they protect or clarify that claim.

## Done

- **#1 Quarantine acknowledgement UI.** `quarantine_required`,
  `needs_inspection`, and `interrupted` blocked every future apply for a
  repository with no exit but hand-editing SQLite. A native command now records
  a human inspection behind the exact phrase `INSPECTED`, and the review
  surfaces call it. Quarantine also stopped rendering as a calm neutral pill.

## Next

### #2 Purge covert fabrication from trust surfaces

Fake activity, a fake tier, fake metrics, and seeds silently persisted into
SQLite where they become indistinguishable from real records. In progress.

The boundary is **covert** fabrication. A card labelled "Demo workflow" and a
row marked "Demo record" are not lying. Removing the demo workflow itself is a
product-scope decision and belongs with #8.

### #3 Rollback v1

Pre-apply backups are persisted and complete, and nothing can restore them. A
backup nobody can restore is a receipt, not a safety net. Rollback is also the
natural exit from quarantine.

Highest-risk item in the product: it is a *second* destructive operation, and
`docs/security/patch-application-safety.md` warns that automatic rollback can
overwrite concurrent user work. It should land after #2, not before — a restore
whose outcome the UI cannot describe honestly is worse than no restore.

### #4 `GitStatusSummary` needs an `unknown` state

`load_git_status_summary` defaults a failed `git status` to empty output, so an
unreadable index renders as a clean working tree. The apply gate no longer
trusts this path (the validation snapshot fails closed as of the F3 fix), and
post-apply verification fails closed, so this is display-only today. Reporting
it honestly needs an explicit `unknown` state on the contract in
`packages/core`.

### #5 Repository switching

`activeRepository = repositories[0]` is hardcoded (`App.tsx`). Repositories can
be added and never switched to; the saved list is display-only. A broken promise
in the UI rather than a safety issue.

### #6 Frontend UI-truthfulness

- **Approval durability.** `updateApprovalStatus` writes UI state before
  persisting, with no `storageStatus` guard and no `try`/`catch` — the only
  mutation path lacking both. A rejected write leaves the UI claiming
  "approved". Fails closed at the native boundary (apply re-reads SQLite), so it
  misleads the user rather than endangering the repository.
- ~~Quarantine renders as a calm neutral pill~~ — landed with #1.
- ~~Overview "✓ No" clean marker disagrees with Changes~~ — lands with #2 as a
  two-reference swap; `effectiveChangedFileCount` and `isWorkingDirectoryClean`
  already exist and Overview simply did not reference them.

Only approval durability remains.

## Later

### #7 Native hardening

- **F4 — vacuous post-apply consistency check.** `verify_post_apply_changed_paths`
  asserts `changed_file_count == files.len()`, but `changed_file_count` is
  *defined* as `files.len()`, so the check is always true. Its evident intent is
  to detect porcelain lines that `filter_map(parse_porcelain_line)` silently
  dropped. To be real it must compare against the raw status line count.
- **F5 — dead `stale_after`.** `APPLY_LOCK_STALE_AFTER_SECONDS` is computed and
  persisted but never read. `mark_abandoned_apply_locks_stale` marks every
  active row stale regardless of age. Safe today only because callers hold the
  OS file lock first, which is the real mutex — but a five-minute grace period
  that reads as an enforced control and is not one should either be enforced or
  removed.
- **F6 — process-global apply mutex.** `PATCH_APPLY_LOCK` is process-global with
  `try_lock` in production, so applying to repository A while B is applying
  returns `apply_locked` with a message claiming a lock on "this repository".
  The `#[cfg(test)]` variant serializes instead of rejecting, so no test can
  observe it.

### #8 Rename and information architecture

"Changes" currently means three things (proposed change, patch artifact, Git
change). "Agent Runs" implies autonomy that does not exist — nothing runs.
Review should be the front door. The demo-workflow story gets rethought here.

### #9 Dev loop: DMG bundling

`npm run build` mounts a DMG per run via Tauri's `bundle_dmg.sh` and leaks the
mount. Repeated verification accumulates volumes until bundling fails from
contention (observed: ten stale `dmg.*` volumes and one spurious build failure).
Either split bundling out of the default `build` or make it opt-in for release.

### #10 Prettier: decide, then act once

`npm run format:check` fails on `main` and did before this work — roughly ten
pre-existing files including generated Tauri schemas. A permanently-red check is
worse than no check. Either it joins the documented verification suite in
`README.md` and gets fixed in one pass, or it comes out of `package.json`. Not a
task until it is a decision.

## Known Data Hazards

Surfaced during investigation; recorded so they are not rediscovered.

- **Dangling `agent_run_id`.** Seeded approvals were persisted but seeded agent
  runs never were — `saveAgentRunRecord` is only called from `startAgentRun`. So
  persisted seeded approvals reference runs that exist only in memory. The UI
  guards this (`?? "Not linked"`), and #2 adds a test to keep it that way.
- **Hardcoded home path.** `createMockRepositories` embeds a real absolute home
  directory as fixture data. Harmless locally, wrong to ship.
- **`ensureProposedPatchArtifacts` rebuilds artifacts from `files`.** Any stored
  artifact whose `filePath` is absent from `files` is silently dropped. Not
  reachable today — every creation path enforces `artifact.filePath ∈ files` —
  but it is a latent way to lose an applied artifact's backup linkage.
- **No foreign keys.** `patch_apply_attempts` and `patch_apply_backups` store
  `proposed_change_id` as plain `TEXT`. Nothing at the schema level prevents
  orphaned audit rows.

## Not Planned

Multi-artifact transactional apply, rename/binary/delete patch support,
streaming, provider tool use, team or cloud features, and PR creation are out of
scope until the single-artifact boundary is production-ready.
