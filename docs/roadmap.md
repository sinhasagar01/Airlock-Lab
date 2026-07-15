# Roadmap

Working backlog for AI Developer Workspace. This file is the single home for
work that is agreed but not yet scheduled, and for findings that are understood
but deliberately not being worked. A finding with no home is a finding that gets
lost.

Every entry has been verified against the code rather than carried over from the
review that produced it. Entries are reconciled as work lands.

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
  surfaces call it. Quarantine stopped rendering as a calm neutral pill.
- **#2 Purge covert fabrication.** Hydration wrote demo fixtures into
  `approval_requests` and `proposed_changes` on every launch with no user
  action, where nothing distinguished them from real records. Both writes are
  gone, untouched fixture rows are purged from existing databases, retained ones
  are marked "Demo record" where they are displayed, and Overview no longer
  ships a fake activity feed, a fake tier, or a fabricated index time. Overview
  and Changes now agree about the working tree.

- **#3 Fix `parse_porcelain_line` for quoted paths.** git quotes and C-escapes
  any path containing a space, a non-ASCII byte, a quote, or a backslash, and the
  parser took the quoted form literally. A patch for `My Notes.md` applied
  correctly and was then reported as an unaccountable write: the file on disk was
  right and the app quarantined it anyway. Three consumers were affected, not the
  one originally recorded here — post-apply verification produced the false
  quarantine, reconciliation's `target_changed` never matched (so a genuinely
  applied patch stuck at `needs_inspection`), and per-file diff loading returned
  `unavailable`, meaning Changes could not show a diff for such a path at all.
  Fixed by C-style unquoting with strict UTF-8 decoding. `core.quotepath=false`
  was verified **not** to be a fix: it stops the octal escaping and still quotes
  the space case. Renames were verified to parse correctly and were not a defect.
  Shipped with a raw status line count (see #12's F4, now landed) because
  rejecting a line is fail-open until dropped lines are visible, and with
  control-character rejection in `is_safe_relative_path`.

  Correction to this document's earlier framing: it said "a path that arrives
  quoted should never pass a safety check." **That is withdrawn.** A file may
  legitimately be named `say "hi".txt`, and at the check site an unparsed
  `"foo.txt"` and a file literally named `"foo.txt"` are the same string. The
  ambiguity is only resolvable at the parse boundary, which is where the fix now
  lives. Quotes are deliberately not rejected; control characters are.

## Next

### #4 Rollback v1

Pre-apply backups are persisted and complete, and nothing can restore them. A
backup nobody can restore is a receipt, not a safety net. Rollback is also the
natural exit from quarantine.

Highest-risk item in the product: it is a _second_ destructive operation, and
`docs/security/patch-application-safety.md` warns that automatic rollback can
overwrite concurrent user work.

**It sat behind #3 because it depended on it.** A restore must verify what it
restored, and it reads `git status` through the same parser. #3 has landed, so
this is unblocked.

**The design is settled and written down:**
[`docs/security/rollback-v1-design.md`](./security/rollback-v1-design.md). It is
an implementation brief carrying the reasoning, not only the conclusions --- the
reasoning is what stops a later reader from "simplifying" a decision that looks
arbitrary in the code. Notably it records why rollback's write ordering inverts
apply's, which reads as an inconsistency until you know why.

Remaining prerequisite: bound `git_output` (#4b).

### #4a Apply must not report success without persisting a baseline

Rollback's drift check compares the target against the post-apply fingerprint in
`post_apply_evidence_json`. That record is best-effort: the snapshot capture is
`.ok()` and the persisting `UPDATE` is fire-and-forget, so an artifact can be
`applied_verified` with no baseline and therefore be permanently
un-rollbackable.

Rollback v1 handles this by refusing, and by showing the ineligibility with its
reason before the user clicks. But "safe" currently depends on evidence apply
does not guarantee. Deliberately not fixed inside v1: it would change the apply
path while adding the first consumer that depends on it --- two risks at once, on
the highest-risk task.

### #4b Bound `git_output`

Only `run_fixed_git_apply_command` has a deadline. `git_output` and
`git_output_raw` spawn git with no timeout at all, so any status or diff read can
hang indefinitely. Rollback must read `git status` to verify what it restored,
which makes this a prerequisite rather than a nice-to-have.

### #5 `GitStatusSummary` needs an `unknown` state

`load_git_status_summary` defaults a failed `git status` to empty output, so an
unreadable index renders as a clean working tree. The apply gate no longer
trusts this path (the validation snapshot fails closed), and post-apply
verification fails closed, so this is display-only today. Reporting it honestly
needs an explicit `unknown` state on the contract in `packages/core`.

### #6 Repository switching

`activeRepository = repositories[0]` is hardcoded. Repositories can be added and
never switched to; the saved list is display-only. A broken promise in the UI
rather than a safety issue.

### #7 Frontend UI-truthfulness

- **Approval durability.** `updateApprovalStatus` writes UI state before
  persisting, with no `storageStatus` guard and no `try`/`catch` — the only
  mutation path lacking both. A rejected write leaves the UI claiming
  "approved". Fails closed at the native boundary (apply re-reads SQLite), so it
  misleads the user rather than endangering the repository.
- **Provider pill reports the wrong provider.** The Agent Run "Provider Context"
  pill renders the mock provider's `status` with a hard-coded success tone, even
  for an OpenAI run, while the prose directly beneath it correctly branches on
  `providerId`. An OpenAI run whose provider is unreachable still shows
  "connected".
- **Dead controls.** Two "Copy repository path" buttons and a "View all" button
  render with no handler. Settings draws a "Clear caches" action that cannot
  execute and a `RESET WORKSPACE` confirmation input whose button is
  permanently `disabled`, so `resetConfirmationText` is write-only state. Ship a
  control or do not draw it.
- ~~Quarantine renders as a calm neutral pill~~ — landed with #1.
- ~~Overview "✓ No" clean marker disagrees with Changes~~ — landed with #2.

## Design Changes

These are product and UX judgments from the review, not defects. Nothing here is
misbehaving; the argument is that the current shape communicates badly. They are
tasks, not bugs, and each needs a decision before implementation.

### #8 One apply entry point

`PatchArtifactDetail` — including the full readiness gates, typed confirmation,
and apply action — renders in both Agent Runs and Approval Review. Two entry
points double the surface on which "approval" and "apply" can blur together, and
approval is the decision the product is built around. The argument is that apply
belongs only behind Approval Review. Requires deciding what Agent Runs shows
instead.

### #9 Make post-apply verification loud

Exact-path post-apply verification is the product's entire value proposition and
it renders as a status pill. The argument is that the proof — "only the approved
path changed; nothing was staged or committed" — deserves to be the loudest
thing on the screen after an apply, not a badge.

### #10 Land in Changes after an apply

After a successful apply the user stays put. The argument is that they should
land in Changes, on real read-only Git state, with the verification result — the
product's honest surface — and that Changes should drop the full indexed-file
browser it also hosts, which is a second file explorer nobody asked for.

### #11 Rename and information architecture

"Changes" currently means three things (proposed change, patch artifact, Git
change). "Agent Runs" implies autonomy that does not exist — nothing runs; there
is one request and one response, no loop and no tools. Review should be the front
door. Validation and dry-run are two words for one idea and should collapse into
"Checks", with the eighteen readiness gates behind an advanced view rather than
presented as workflow steps.

The demo-workflow story gets rethought here, including whether the shipped demo
fixtures should exist at all. #2 deliberately scoped that out: a card labelled
"Demo workflow" and a row marked "Demo record" are not lying, so removing them is
a product-scope decision rather than a data-honesty fix.

Positioning belongs with this work. The product is currently described by what it
is weakest at — generating AI plans — rather than by the safety machinery that is
95% of the engineering and the only part competitors lack. Claims worth retiring:
"AI-native workspace", "AI-assisted implementation" (it reviews and applies one
file; it does not implement), and "Repository Intelligence" for what is a
file-tree summary with extension counts.

## Later

### #12 Native hardening

- ~~F4 — vacuous post-apply consistency check~~ — landed with #3.
  `changed_file_count` now comes from the raw status line count rather than
  `files.len()`, so a dropped status line produces a mismatch and quarantines
  instead of comparing the result to itself. It was pulled into #3 because
  rejecting an unrepresentable path is fail-open until dropped lines are visible.
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
- **Rollback TOCTOU window (stated, not closed).** Rollback's drift check reads
  and hashes the target, then writes. A concurrent editor can change the file in
  between: the repository-scoped app lock excludes our own processes, not the
  user's editor. v1 narrows the window by hashing immediately before the write
  and **detects** a concurrent edit afterwards, quarantining it — but does not
  **prevent** it, and the edit can still be lost. Same class as the fingerprint
  window below. Recorded as a known bound rather than an assumption.
- **Fingerprint TOCTOU and timestamp granularity.** `fingerprint_target_file`
  does `symlink_metadata` → `canonicalize` → read as three steps. A swap to a
  symlink mid-window is caught by the canonical-root check, and a swap to a
  different in-repo file is caught downstream by `create_apply_backup`'s hash
  re-check, so it is not known to be exploitable — but the window is real.
  Separately, `modified_at` uses whole seconds, so for fingerprints with no
  content hash (`too_large`, `binary`, `forbidden`, `unavailable`) equality
  reduces to size plus whole-second mtime, and a same-size edit inside one second
  compares equal. Not reachable for the apply target (backup requires a
  `captured` or `missing` fingerprint), but non-target `relevant_file_paths` gate
  staleness on this weaker evidence.

### #13 Split `App.tsx`

~4,000 lines, roughly 35 `useState` hooks, one component, six tabs inline.
Every confirmed frontend defect in the review lived here, and the Overview /
Changes disagreement fixed in #2 was a direct symptom: two surfaces derived the
same fact independently. The existing frontend suite is the safety net for the split.

**Reversal, recorded with its reasoning rather than only its conclusion.** This
item previously argued it should land _before_ #4: "rollback adds a second
destructive action to a component that cannot keep two tabs agreeing on clean."
**#2 falsified that premise.** The single source of truth already existed
(`effectiveChangedFileCount`, `isWorkingDirectoryClean`); Overview simply was not
referencing it, and now does. The tabs agree. Rollback's safety authority is
native, so a ~4,000-line frontend refactor does not reduce rollback's risk --- it
adds refactor risk ahead of the highest-risk native work.

The real cost of deferring is that rollback's UI state lands in `App.tsx` and the
eventual split grows. That is a cost, not a safety risk.

### #14 Dev loop: DMG bundling

`npm run build` mounts a DMG per run via Tauri's `bundle_dmg.sh` and leaks the
mount. Repeated verification accumulates volumes until bundling fails from
contention (observed: ten stale `dmg.*` volumes and one spurious build failure).
Either split bundling out of the default `build` or make it opt-in for release.

### #15 Prettier: decide, then act once

`npm run format:check` fails on `main` and did before this work — roughly ten
pre-existing files including generated Tauri schemas. A permanently-red check is
worse than no check. Either it joins the documented verification suite in
`README.md` and gets fixed in one pass, or it comes out of `package.json`. Not a
task until it is a decision.

### #16 Packaged QA and distribution

The packaged UI click-through remains pending and unclaimed; see
`docs/qa/evidence/mvp-demo-v1-disposable-apply-qa.md`, whose three evidence gaps
still stand. Signing and notarization are needed to distribute, not to validate.

## Known Data Hazards

Surfaced during investigation; recorded so they are not rediscovered.

- **Dangling `agent_run_id`.** Seeded approvals were persisted but seeded agent
  runs never were — `saveAgentRunRecord` is only called from `startAgentRun`. The
  UI guards this (`?? "No linked run"`) and #2 pinned that guard with a test.
  Demo fixtures keep their runs in memory, so the link resolves today; the hazard
  is that nothing enforces the reference.
- **Hardcoded home path.** `createMockRepositories` embeds a real absolute home
  directory as fixture data. Harmless locally, wrong to ship.
- **`ensureProposedPatchArtifacts` rebuilds artifacts from `files`.** Any stored
  artifact whose `filePath` is absent from `files` is silently dropped, and it
  runs over every saved change on hydrate. Not reachable today — every creation
  path enforces `artifact.filePath ∈ files` — but it is a latent way to lose an
  applied artifact's backup linkage. It is a hazard rather than a task because no
  code path can currently reach it; it becomes a task the moment anything edits
  `files` after artifacts exist.
- **Backups and attempts are retained forever.** Nothing prunes
  `patch_apply_backups`, `patch_apply_attempts`, or (once rollback lands)
  `patch_rollback_backups`. The only `DELETE` against a backup table today is in
  a test fixture. Every applied patch permanently stores up to 256 KiB of file
  content in `workspace.db`, and rollback doubles the rate by backing up the
  bytes it overwrites. Retention needs a policy — these are audit records, so
  "delete the old ones" is a decision about how long the audit trail lives, not
  just housekeeping.
- **No foreign keys.** `patch_apply_attempts` and `patch_apply_backups` store
  `proposed_change_id` as plain `TEXT`. Nothing at the schema level prevents
  orphaned audit rows.
- **Test coverage measures the wrong thing.** The suite was fully green while a
  critical structure-validation bypass and a broken modify path sat in the code:
  every apply test used a `create` patch, so the `modify` path had no end-to-end
  coverage at all. #3 is the same shape — a parser never exercised on real
  inputs. New safety claims should arrive with a failing test first.

## Won't Do

Recorded with reasons so they are not re-proposed.

- **Multi-artifact transactional apply.** Needs its own atomicity design and
  integration coverage. The single-artifact boundary is not production-ready yet;
  widening it first would multiply an unfinished guarantee.
- **Rename, binary, and delete patch support.** v1 deliberately applies one
  single-file UTF-8 text diff. Each additional operation is a distinct path
  policy and a distinct class of failure.
- **Streaming and provider tool use.** A provider that can invoke tools can
  invoke apply. The architecture's core claim is that the provider is the
  least-trusted component; tool use inverts that.
- **Team, cloud, accounts, and PR creation.** Out of scope for a local-first
  desktop product that has not finished proving its local guarantee.
- **Automatic rollback after an uncertain failure.** Explicitly rejected in
  `docs/security/patch-application-safety.md`: automatic recovery can overwrite
  concurrent user work and would introduce a second destructive operation with no
  human in the loop. #4 is user-initiated restore, not this.
- **Merging indexing into repository selection, and demoting Repository
  Intelligence.** Both were raised as workflow simplifications. They are
  reasonable but they are IA decisions; they belong to #11 rather than being done
  piecemeal.
