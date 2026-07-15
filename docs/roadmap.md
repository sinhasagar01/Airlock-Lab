# Roadmap

Working backlog for Airlock. This file is the single home for
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

- **#4b Bound `git_output`.** Only `run_fixed_git_apply_command` had a deadline;
  `git_output` and `git_output_raw` spawned git with no timeout, so any status or
  diff read could hang indefinitely. Every git child process is now bounded.
  Landed ahead of #4, which must read `git status` to verify what it restored —
  an unbounded read is a liveness hole in a destructive path.

- **#4 Rollback v1.** Pre-apply backups were persisted and nothing could restore
  them — a backup nobody can restore is a receipt, not a safety net. A native
  command now restores one `applied_verified` artifact from its app-local
  pre-apply backup behind the typed phrase `ROLL BACK`, refusing on drift, a
  deleted or staged target, a moved HEAD or branch, a missing baseline, or a
  corrupt backup, and verifying what it restored. Never Git: no `reset`,
  `checkout`, `clean`, `add`, or `commit`. `rolling_back` is persisted before the
  write, seen by reconciliation, blocks the repository, and classifies
  unconditionally to `quarantine_required` with no probe.

  Three corrections to the design landed with it, recorded in
  [`docs/security/rollback-v1-design.md`](./security/rollback-v1-design.md) with
  their reasoning: post-restore verification compares **staged paths as a delta**
  rather than requiring `staged_count == 0` (the original rule falsely
  quarantined a correct rollback whenever the user had staged an unrelated file
  — a false account, the failure class #3 removed); the **proposal** moves to
  `rolled_back` too, since leaving it `applied` rendered a lie on the product's
  most honest surface; and the repository lock records **which** destructive
  operation held it.

  It also exposed an F7-shaped hole the design did not anticipate: the native
  apply guard enumerates blocked statuses rather than allow-listing eligible
  ones, so `rolled_back` **fell through every arm and re-applied successfully**.
  Proven by test, then fixed. The enumerate-don't-allow-list shape was
  subsequently inverted (see the allow-list entry below); the attempt-level
  gates that share it remain recorded under #12.

- **Apply artifact guard inverted to an allow-list.** The guard enumerated
  blocked statuses, making its default *apply*: a status no arm named reached
  the write. It fixed no reachable bug --- every current refusal was already an
  explicit arm --- but the default was the defect: `blocked` and
  `not_applicable`, declared and never written, applied successfully, and the
  shape had already produced two findings (`interrupted`/`needs_inspection`
  before #1; `rolled_back` during #4, which wrote a file). Eligible now:
  no `applyStatus`, and `apply_failed` (retry is re-gated in-request; pinned by
  test before the inversion). `ready_to_apply` is deliberately refused ---
  nothing writes it, and allow-listing an unreachable status by its name grants
  permission speculatively. The frontend readiness gate mirrors it from one
  list exported by `packages/ai`, kept in step by a test and a comment, stated
  plainly as not compile-enforceable.

- **Attempt-level gates inverted to allow-lists.** The unresolved-attempt gate
  and the reconciliation query had the artifact guard's shape one layer up, on
  `PatchApplyAttemptStatus`. Their failures were quieter than a wrong file: an
  unrecognised status silently stopped blocking the repository, and was never
  seen, classified, or resolved — "no exit and no door".

  **Two lists, because two questions.** The gate asks *is this resolved — need a
  human act?* (`applied`, `applied_verified`, `failed`, `rolled_back`,
  `inspected`); the query asks *does this carry a verdict — can reconciliation
  add anything?* (those five **plus** `interrupted`, `needs_inspection`,
  `quarantine_required`). Those three disagree deliberately: classified, but not
  resolved. One list cannot serve both, and assuming it could is where the bug
  would have been.

  Seeing an unknown status is only safe because the classifier now refuses to
  judge it. Its forward/reverse `git apply --check` probes are evidence about a
  patch; an operation it cannot name is not a patch. Demonstrated rather than
  argued: without the classifier's allow-list, an unnameable operation with
  complete apply evidence and a reverted tree is declared **`failed`** — a
  verdict that does not block — freeing the repository on a model that does not
  fit. It gets `needs_inspection` instead, which blocks, and `INSPECTED` clears.
  That door is what makes the gate's default safe to invert, which is why the
  two landed together.

  **`applied` is on the non-blocking list on a documentary argument that cannot
  be tested.** No current code writes it — production only ever `INSERT`s
  `pending` and `rolling_back`, and the classifier's verdict is `failed` |
  `applied_verified` | `quarantine_required` | `needs_inspection`. The evidence
  it was once real: `patch-application-safety.md` documents it as a
  reconciliation verdict ("durable state already says applied… Native repairs
  only persisted status"), `apply_attempt_message` still carries its arm, and
  the artifact guard blocks it as part of a legacy triple. **The limit: a legacy
  database cannot be constructed here to confirm such rows exist.** The call
  rests on that documentary evidence, not on proof. It is the conservative
  direction — blocking it would strand a legacy row behind a gate `acknowledge`
  does not accept, a state with no exit created by the fix meant to prevent
  those — and its replay is barred twice over by tests: the artifact guard
  (`already_applied`, no file written) and, with both bars forced down, the
  proposal's own state (`proposal_not_approved`).

  Contrast with `ready_to_apply`, refused during the artifact-guard inversion:
  that status was never written by *any* version, so allow-listing it would have
  granted permission on the strength of a name. The rule is "allow-list only
  what you can justify", not "refuse everything unreachable".

- **#4c Rollback misdiagnosed an oversized post-apply target.** Proven by the
  constructed test its entry demanded: an ordinary apply growing a 256,000-byte
  file to 268,800 bytes succeeded and verified, the baseline persisted a
  truthful `too_large` fingerprint with no hash, and rollback refused it as
  `baseline_unavailable` --- "no content hash was recorded" --- when nothing had
  failed and a record was kept. The frontend went further and said no record
  existed. Both now refuse for the true reason: the pre-rollback backup cannot
  store a file past the 256 KiB bound, which would be true with a perfect
  baseline. `MAX_FINGERPRINT_BYTES` untouched --- it feeds the apply gate.

- **#4a The rollback baseline is now a positive assertion.** Retitled from
  "apply must not report success without persisting a baseline", whose premise
  was falsified by probe: `git status` survives `index.lock` (exit 0, correct
  output), and both writes around the fire-and-forget UPDATE were checked and
  proven working microseconds on either side --- a capability gap, not a safety
  one. What actually shipped: apply writes `rollback_baseline_json`
  (`recorded` with hash/branch/HEAD, or `unavailable` with a reason) from
  ingredients that cannot involve a git subprocess; the finalize UPDATE is
  checked; rollback and the surfaces consult only the assertion; legacy rows
  are backfilled by copying --- never deriving --- recorded evidence, with
  anything unusable becoming an explicit `unavailable/not_recorded`.

  **Implementing it exposed a live hazard, proven end-to-end by test before the
  fix:** reconciliation can classify a crashed apply `applied_verified` with an
  evidence snapshot captured at reconciliation time; an edit made in the crash
  window (kept reverse-applicable by landing outside the patched region) was
  inside that hash, invisible to the drift check, and rollback restored
  pre-apply bytes over the user's edit and verified the destruction. Only an
  apply-time observation may say `recorded`: reconciliation now asserts
  `unavailable/reconciled_outcome`, with an interior fail-closed guard in
  `persist_reconciled_attempt` behind it. Rollback capability for reconciled
  outcomes is deliberately gone; it was never safe to have. Stated bound:
  legacy reconciled rows are indistinguishable from apply-finalized ones, so
  their backfilled baselines preserve exactly today's behaviour for exactly
  those rows.

- **#6 Repository switching.** `activeRepository = repositories[0]` was
  hardcoded: repositories could be added and only the first ever used, and the
  saved list was display-only.

  **The original framing said "a broken promise in the UI rather than a safety
  issue." That undersold it.** The app had never had to be honest about *which*
  repository a fact belonged to, because there was only ever one. Switching is
  what turns that into a lie, and the lie was not confined to the screen: the
  derived Git facts (branch, cleanliness, changed-file count) and the indexed
  file list are sent to the provider as context describing the active
  repository. A run created in the switch window shipped another repository's
  branch and **file paths** to OpenAI under this repository's id and name. Both
  proven by test before the fix; the second by a margin of fourteen files.

  Landed: the list is selectable and every repository-scoped surface follows the
  selection; derived Git facts fail closed on a repository-id mismatch — to
  `unknown`, or to the active repository's own saved record, never to the other
  repository's numbers; `activeIndexingJob = indexingJobs[0]` — **a second
  hardcoded index this entry never mentioned** — was scoped by id; every
  repository-scoped slot is cleared before the new repository's data arrives;
  switching is blocked while an apply or rollback is in flight, with the
  post-apply/post-rollback status writes additionally guarded by repository id.

  **Agent Runs and Approvals are now scoped too.** They rendered every
  repository's work in one list, and two sites printed one repository's name
  directly above another's branch. Each record resolves through its linked
  proposal (`proposal.runId` / `proposal.approvalRequestId` →
  `proposal.repositoryId`), because `AgentRun` and `ApprovalRequest` carry
  `repository` as a display *name*, not an id — the same link the apply
  readiness gate already compares, so the lists and the gate cannot disagree
  about what "this repository's work" means. **Three outcomes, not two:** the
  active repository's work; another saved repository's work, hidden; and records
  whose link does not resolve, which appear under an explicit "not linked to a
  saved repository" group rather than being dropped (see the Won't Do entry).
  Hiding one would be its own dishonesty, and this document already records that
  those links can dangle.

  **Correction to this entry's earlier claim about the demo records.** It said
  they carry `repositoryId: "repo-workspace"`, which "can never match a real
  `repo-${path}`, so they land in that group permanently". The first clause is
  true; **"permanently" is withdrawn.** `createMockRepositories()` returns
  exactly one repository whose id *is* `repo-workspace`, and it is the
  repository list's initial value — so the demo records resolve to it before
  hydration, permanently whenever storage fails (see the hazard below), and
  throughout the test suite, whose saved-repository fixture is also
  `repo-workspace`. Only once hydration installs a real `repo-${path}` do they
  land unlinked. Resolution is uniform and no record is special-cased by id:
  the fixture run genuinely belongs to the fixture repository, so resolving it
  there is accurate rather than a lie.

  That fixture collision is why the new tests use a real-shaped id. Against the
  default fixture a "demo records are unlinked" assertion is not merely vacuous,
  it is *wrong* — which is the fourth vacuous-fixture catch in this project and
  the first found before the test was written.

  **Verified on screen rather than argued**, which is what the earlier entry
  asked for: with a real-shaped repository saved, both demo runs and both demo
  approvals render inside the labelled group, the scoped lists read "No agent run
  belongs to this repository", and the detail Branch reads "Not linked to a saved
  repository" instead of the active repository's branch.

  **Two count figures, deliberately.** A count that labels a scoped list must
  count that list, so the Approvals hero, both list pills, and the sidebar badge
  count what is shown. Overview and Settings keep the workspace total and now say
  so ("across all repositories"). Leaving one unlabelled number contradicting
  another is the shape #2 fixed between Overview and Changes.

  A note the type system could not give: `activeAgentRun` is now genuinely
  nullable, and TypeScript could not see it. `visibleAgentRuns[0]` infers as
  `AgentRun` even on an empty list (`noUncheckedIndexedAccess` is off), and a
  `const` narrows to its *initializer's* type at every read, so a `| null`
  annotation was silently discarded and `strict` stayed green over a render that
  threw. `.at(0)` is what made the compiler produce the fourteen sites.

## Next

### #4d No gate enforces refreshed validation before retrying a failed apply

`docs/security/patch-application-safety.md` Decision #9 says "A failed attempt
requires refreshed validation before retry." **No gate enforces that.** An
artifact left at `apply_failed` is eligible for apply, its attempt row is
`failed` (absent from the unresolved-attempt gate), and its `validationStatus`
stays `dry_run_passed` because the failure path never clears it. After a rejected
`git apply` the working tree is unchanged, so the snapshot still matches and a
retry proceeds without the user revalidating.

This is defensible — the apply request re-runs structure validation, a fresh
`git apply --check`, and the full snapshot comparison in the same request, so a
retry is re-gated rather than replayed. The defect is that **the document and the
code disagree and neither is obviously wrong**. Either Decision #9 means the
in-request revalidation it already gets and should say so, or it means a fresh
user-initiated validation and a gate is missing. That is a policy decision, not a
bug fix.

Recorded rather than resolved during the guard inversion: tightening retry inside
a shape change would be a policy decision smuggled into a refactor.

### #5 `GitStatusSummary` needs an `unknown` state

`load_git_status_summary` defaults a failed `git status` to empty output, so an
unreadable index renders as a clean working tree. The apply gate no longer
trusts this path (the validation snapshot fails closed), and post-apply
verification fails closed, so this is display-only today. Reporting it honestly
needs an explicit `unknown` state on the contract in `packages/core`.

### #6a Persist the active repository selection

The selection is in-memory. A restart falls back to the first saved repository —
exactly the pre-#6 behaviour, so no regression and one click to re-select, but it
is a promise the UI half-makes.

Split out of #6 deliberately rather than bundled: persisting it needs a
key-value store this app does not have. Every storage module
(`repositoryStore`, `indexedFileStore`, `indexingJobStore`, …) is a
purpose-built table, so this is a new module plus a migration plus a test mock
plus its own tests. Bundling it into the switching commit would have meant
half-building two things, which is the failure mode; it does not block the
packaged QA that #6 exists to unblock.

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

**"Linked" now means two things on one screen, and they read as a
contradiction.** Observed after #6 scoped the lists: a demo run sits under the
heading **"Not linked to a saved repository"**, and its detail card says **"This
run is linked to persisted proposal `proposal-mvp-shell`, approval
`approval-provider-rfc`"**. Both statements are precise and both are true — the
run *is* linked to a proposal, and that proposal names a repository nothing has
saved — but "linked" is carrying two different objects a few inches apart, and
the reader has to hold both to see there is no conflict. Copy, not a defect:
nothing here is false, which is exactly why it belongs to #11 rather than to a
bug fix. It is also the first thing #6's grouping made visible, so it is evidence
for the broader point that this vocabulary is overloaded.

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
- **F6 — process-global apply mutex. Single-user unreachable; recorded with its
  gate rather than as a live hazard.** `PATCH_APPLY_LOCK` is process-global with
  `try_lock` in production, so applying to repository A while B is applying
  would return `apply_locked` with a message claiming a lock on "this
  repository". The `#[cfg(test)]` variant serializes instead of rejecting, so no
  test can observe it.

  **Repository switching does not make this reachable, and an earlier claim that
  it did is withdrawn.** A second apply is gated by `applyingPatchArtifactId`,
  which blocks regardless of which repository is active — so F6 was already
  single-user-unreachable before switching and remains so. #6's in-flight switch
  block is a second bar, not the first. The only single-user concurrent pair is
  apply + rollback together (the two UI guards do not check each other), and that
  hits the *process* lock, whose message says "in this app process" — accurate.
  F6's complaint is specifically the repository-worded message on the file lock,
  reachable only across processes, which is the case the OS advisory lock already
  handles correctly.
- **Rollback TOCTOU window (stated, not closed).** Rollback's drift check reads
  and hashes the target, then writes. A concurrent editor can change the file in
  between: the repository-scoped app lock excludes our own processes, not the
  user's editor. v1 narrows the window by hashing immediately before the write
  and **detects** a concurrent edit afterwards, quarantining it — but does not
  **prevent** it, and the edit can still be lost. Same class as the fingerprint
  window below. Recorded as a known bound rather than an assumption.
- **Short-SHA abbreviation scaling (stated, not closed).** Both the post-apply
  baseline and rollback's `head_changed` check read HEAD via
  `git rev-parse --short HEAD`, whose abbreviation length auto-scales with the
  repository's object count. A repository that gains many objects between an
  apply and a rollback can render a *longer* short SHA for the **same** commit,
  producing a spurious `head_changed` refusal. It fails closed — the refusal is
  wrong but harmless, and the alternative is not refusing — so it is out of
  rollback v1. Fixing it means storing the full OID in the snapshot, which
  changes the snapshot digest and therefore the apply path.
- ~~The unresolved-attempt gate and the reconciliation query enumerate, one
  layer up~~ — landed. Both inverted to allow-lists; see the Done entry.
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

### #17 `noUncheckedIndexedAccess` — every `array[0]` in this codebase lies

`strict` is on and it does not cover this. `array[0]` infers as `T`, never
`T | undefined`, so an empty-list read is invisible to the compiler. #6 hit the
consequence: `visibleAgentRuns[0]` on an empty list typed as `AgentRun`, and
because TypeScript narrows a `const` to its **initializer's** type at every read,
an explicit `: AgentRun | null` annotation was **silently discarded** — `strict`
stayed green over a render that dereferenced `undefined` and threw. Only
switching the initializer to `.at(0)`, which returns `T | undefined`, made the
compiler name the fourteen sites. The annotation looked like the fix and was
decorative; that is the part worth remembering.

**The systemic version:** every indexed read in the codebase carries the same
lie, and the two already found were both real bugs that shipped past a green
`strict` build — `repositories[0]` and `indexingJobs[0]`, the two hardcoded
indices #6 removed. Both were caught by reading the code, not by the compiler
that was supposedly checking it.

**Likely blast radius:** unknown until measured, but the shape is predictable —
`App.tsx` alone is ~4,000 lines with roughly 35 `useState` hooks over arrays, and
the `[0]` pattern is how this app has always picked a default. Expect most hits
to be genuinely safe (literal arrays, post-`length` checks) and the flag to
produce a long tail of noise around a few real findings. That ratio is the
argument for doing it deliberately rather than in passing.

**It is a compiler flag, not a refactor.** One line in `tsconfig.base.json`,
then however many sites it names. That is what makes it schedulable and what
makes it dangerous to enable casually: the flag is trivial, the fallout is not,
and a half-fixed codebase with the flag off again is worse than never starting.
It should land as its own task, with the count measured first, and it wants #13
(splitting `App.tsx`) decided first — doing both at once means a refactor and a
type-strictness sweep in the same diff.

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
- **A storage failure leaves the fabricated mock repository active,
  permanently.** Hydration's `catch` sets `storageStatus` to `unavailable` and
  never calls `setRepositories`, so `repositories` keeps its initial value —
  the `createMockRepositories()` fixture, with the hardcoded home path above —
  and the app presents it as a saved repository for the rest of the session.
  Every repository-scoped surface then resolves against a repository that does
  not exist. The demo records link to it *correctly* (its id is the
  `repo-workspace` they name), so they render as ordinary work on an ordinary
  repository, with a branch and an indexed-file count beside them.

  **This is #2's fabrication problem in a different shape.** #2 removed the
  writes that put fixtures into the same tables as real records where nothing
  distinguished them; this is a fixture presented *as* a record with nothing
  marking it — surfaced by #6, which made it visible by giving the fixture's id
  a job to do. Observed, not argued: in the browser preview both demo runs render
  in the main list under "AI-Developer-Workspace / main" with no group.

  Recorded rather than fixed, deliberately. The honest fallback is "no
  repository", but that is a decision about what the browser preview is *for* —
  it currently depends on this fixture to render anything at all — and the fix
  belongs with the `createMockRepositories` hardcoded home path, which rides
  with the rename. Scoping it into #6 would have been a product-scope decision
  smuggled into a display fix.
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

- **Filtering Agent Runs and Approvals by repository without a group for
  unresolvable records.** Plain filtering — dropping any record whose repository
  link does not resolve — was considered for #6 and rejected. Hiding a record is
  its own dishonesty, and this document already records that those links can
  dangle ("Dangling `agent_run_id`"), so plain filtering would silently
  disappear real approvals. The rejected alternative of *not* filtering at all
  was also considered and is worse: a list showing every repository's work under
  a repository selector is the aggregate lie, where each row can be individually
  accurate while the screen as a whole misleads. Filtering **with** an explicit
  "not linked to a saved repository" group is the shape that keeps both
  properties: nothing hidden, nothing mislabelled.

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
