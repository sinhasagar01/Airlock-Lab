# Roadmap

Working backlog for Airlock. This file is the single home for
work that is agreed but not yet scheduled, and for findings that are understood
but deliberately not being worked. A finding with no home is a finding that gets
lost.

Every entry has been verified against the code rather than carried over from the
review that produced it. Entries are reconciled as work lands.

Last reconciled: 2026-07-16.

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
  hydration, permanently whenever storage fails, and throughout the test suite,
  whose saved-repository fixture is also `repo-workspace`. Only once hydration
  installs a real `repo-${path}` do they land unlinked. Resolution is uniform
  and no record is special-cased by id: the fixture run genuinely belongs to the
  fixture repository, so resolving it there is accurate rather than a lie.

  **Superseded by #11 slice 2, which retired the fixture.** No repository with
  the id `repo-workspace` exists on any path now, so this entry's *original*
  claim — that the demo records land unlinked — is finally true without
  qualification, and the app-side half of it is pinned by a test that fails a
  storage hydrate and asserts the group. The correction is kept rather than
  deleted because its reasoning outlives its subject: an id that exists is an id
  that will link to something, which is the argument against the next fixture
  anyone is tempted to reach for.

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

- **#8 One apply entry point (IA restructure slice A).** `PatchArtifactDetail`
  — the full readiness gates, typed confirmation, and the apply, validate,
  rollback, and acknowledge actions — rendered in **both** Agent Runs and
  Approval Review. Two surfaces on which "approval" and "apply" could blur, when
  approval is the decision the product is built around. The detail now renders in
  **exactly one** place: Approval Review. Agent Runs keeps the structured plan and
  hands off to the linked approval through the existing "Review approval" control,
  which sets the section to Approvals with that approval selected.

  **What Agent Runs shows instead — the question #8 left open — is: the plan,
  plus a read-only artifact summary, plus the handoff.** The generated-artifact
  *list* stays (it is plan information — which files were proposed and each
  artifact's status) but is now **non-interactive**: without a detail beneath it,
  a selectable list would be a control that leads nowhere, which this project
  files as a defect (#7 Dead controls). Making it a static summary keeps the
  information and removes the dead affordance. Removing the list entirely was
  considered and rejected as scope beyond the brief; keeping it clickable was
  rejected as a dead control.

  Pinned by two new tests and proven by exercise before the change: with a run
  validated and approved, the apply affordance renders in Approvals and **not**
  in Agent Runs (asserted by both the "Apply Patch" accessible name and the
  `region` "Patch artifact detail" — the region assertion is the non-vacuous
  discriminator, since Agent Runs' auto-selected artifact would not have shown
  "Apply Patch" anyway); and the Agent Runs handoff control navigates to the
  run's *own* linked approval, selected — tested against the second run, whose
  approval is not the Approvals default, so the control must set the selection
  rather than land on it by chance. Twelve existing tests that drove validate,
  rollback, acknowledge, and apply from the Agent Runs detail were re-routed
  through Approval Review (the surface that now hosts those actions), not
  deleted. One count assertion on `reconcileInterruptedPatchApplyAttempts` was
  loosened from `== 2` to `>= 2`: the extra navigation to reach the recovery
  evidence drives an additional reconcile pass, and the guarantee was always
  "it re-runs", never "exactly twice".

  Bound respected: no types, tables, columns, or serde names changed. UI-local
  only. The `PatchArtifactDetail` component and its Approvals render site are
  untouched, so apply's safety surface is unchanged — this slice removes a
  *second door to the same room*, it does not alter the room.

- **IA restructure slice B — the eighteen readiness gates become evidence, not
  workflow.** The full gate list rendered on arrival, presenting a native audit
  trail as eighteen steps to walk. It now lives behind an explicit **Advanced:
  show all 18 readiness gates** control; on first render not one of the eighteen
  gate labels is in the document. When application is not ready, a single summary
  line — *First unmet gate: …* — names the **first blocking gate's reason** (its
  detail, deliberately not its label, so the "no gate labels on arrival" property
  holds) in place of the wall of gates. The overall count summary
  (`applyReadiness.summary`) is kept.

  **Display only. `applyReadiness.ts` was not touched** — the gate order,
  statuses, `canApply`, and the four-way `status` are the same object, rendered
  differently. So the apply button's disabled state is unchanged, and the tests
  that pin it (`keeps patch application disabled while safety gates are blocked`
  and the apply-flow tests) stayed **green unmodified**. Two existing tests that
  read individual gate labels/details as a display assertion — the validated
  OpenAI-plan test and `keeps apply readiness unknown …` — were updated to open
  Advanced first; that is a display expectation following the display, not an
  apply-button change.

  Pinned by two new tests and shown failing for the right reason before the
  change: one asserts none of the eighteen labels are present on arrival and all
  eighteen appear after Advanced; the other derives the first blocked gate from
  the expanded list, collapses it, and asserts the reason survives as one line
  while the labels leave the document. Predicted 152 → 154 frontend; actual 154.
  The brief cited `PatchArtifacts.tsx:551`; the file is at
  `apps/desktop/src/features/proposed-changes/PatchArtifacts.tsx` (the path in
  the brief was stale, the line was right).

- **IA restructure slice D — Index merged into Select.** `startIndexingJob` had
  three call sites — its own definition, `runMaintenanceReindex`, and the
  Repositories "Reindex repository" button — and **none was on the selection
  path**. Selecting a repository never started indexing, so a never-indexed
  repository could only reach its first index through a control labelled
  "Reindex repository": a verb asserting a previous index that had never
  happened, on a tab a first-run operator has no reason to open. This resolves
  the #7 truthfulness finding of the same name.

  **Selection now starts indexing, with no control between select and indexed.**
  Two selection surfaces, both auto-index: choosing the first repository through
  the native picker (`selectRepositories`) — which becomes the active repository
  by fallback, so choosing it is selecting it — and selecting a saved repository
  from the list (`switchActiveRepository`). The Reindex button is no longer a
  first-index path, so its label stops asserting a history that never occurred.

  **Deliberately conditional, not "always index on select."** Switching to an
  **already-indexed** repository still restores its persisted facts through
  `loadIndexedFileFacts` rather than re-scanning; only a repository whose status
  is not `indexed` is indexed on selection. This keeps Reindex a meaningful
  explicit action (refresh an already-indexed repository without re-selecting it)
  and avoids a re-scan on every switch. Proven non-vacuous in **both** directions:
  the new test fails when selection does not index a never-indexed repository, and
  the two existing switch tests (`selects a saved repository…`, `never sends the
  previous repository's indexed file paths…`) fail when the guard is neutralised
  to always-index, because they depend on the indexed-repository path loading
  persisted facts. One list cannot serve both; the `status !== "indexed"` check is
  what makes select-indexes and reindex-refreshes coexist.

  **A closure hazard the picker path forced out.** `startIndexingJob` mapped over
  the `repositories` **state** to flip one repository to `indexed`. Called right
  after `setRepositories(nextRepositories)` in the picker, that closure still held
  the **pre-add** value — on a first-run install, `[]` — so the map produced an
  empty list and would have dropped the very repository being indexed. Fixed by an
  optional `baseRepositories` parameter (defaulting to the state) that the picker
  passes the fresh list; switch and reindex keep the default, where no repositories
  update is pending. Display only past that: no types, tables, columns, or serde
  names changed; the indexing boundary (`scanRepositoryFileTree` →
  `replaceIndexedFileFacts`) is unchanged, so this slice moves *when* an index runs,
  not *what* it does.

  The three reindex controls all survive and still work: the Repositories Entry
  Points "Reindex repository" button, the Settings "Indexing policy" row action,
  and the Settings Maintenance "Reindex repository" button. Pinned by two new tests
  shown failing for the right reason (`scanRepositoryFileTree` never called) before
  the change. Predicted 154 → 156 frontend; actual 156.

- **IA restructure slice C — validate and dry-run collapse into one Checks line
  that runs on review-open.** The artifact detail carried a "Validation and
  dry-run" panel with a **Validate & dry-run** button the operator had to click,
  and a status pill that read the durable `validationStatus`. That field is
  written once and **never cleared** (#4d), so the pill said "passed" over a
  repository that had since moved out from under the artifact. The panel is now a
  single **Checks** line, and it is **a projection of `evaluateApplyReadiness`,
  not of `validationStatus`** — the same evaluator the Advanced gate list renders
  in full, at two detail levels. The checks verdict reads six gates (structure,
  dry-run, artifact digest, validation snapshot, target fingerprints, repository
  staleness): any blocked gate is a failed line naming that gate's reason, so a
  stale dry-run is reported failed even while its stored status still says passed.

  **Proven failing against a naive `validationStatus`-reading implementation
  first, as the brief required.** With the projection wired to only the
  structure and dry-run gates — the two that are pure functions of
  `validationStatus` — the critical test rendered "checks passed" for an artifact
  whose `repositorySnapshotDigest` no longer matched. Adding the freshness gates
  turned it to "checks failed" naming the staleness reason. Pinned in both the
  App surface and a pure `summarizeChecks` unit test.

  **The checks run on review-open, exactly once, and never in the browser.** An
  effect keyed on the artifact id fires the native dry-run when a generated,
  never-checked artifact with no apply lifecycle is opened in the native runtime.
  Re-opening an already-checked artifact does not re-invoke native (guarded by
  `!validatedAt`), and a stale-but-checked artifact is **reported stale, not
  silently re-validated** — which is exactly what makes the critical staleness
  case observable. The line carries its observation time (`dryRunAt ?? validatedAt`)
  and states that checks are not re-run while the approval stays open; there is no
  watcher. The two guards that matter — native-runtime and already-checked — were
  neutralised and watched fail (the browser test fired a subprocess; the re-open
  and staleness tests re-invoked native) before being restored.

  **A real concurrency bug the auto-run exposed, fixed with it.** The review-open
  reconcile reload (`reconcileApplyAttemptsForReview`) reads durable storage and
  can land its state update *after* the check has written its passed result,
  reverting the surface to "not validated" with no trigger to re-run — the
  auto-run is keyed on the artifact id, which did not change. Because validation
  is durable and never cleared (#4d), a reloaded artifact that lacks a validation
  the in-memory copy already has is a **stale read, not a cleared field**. A new
  `preserveInMemoryValidation` keeps the fresher in-memory validation while
  leaving the recomputed current-content digest untouched — so a genuinely
  changed artifact still fails the digest gate rather than inheriting a stale
  pass. Without it, the OpenAI end-to-end test's checks stuck at "incomplete";
  the same race made the default-fixture path timing-dependent.

  **`applyReadiness.ts`'s gate logic was not touched** — `summarizeChecks` is a
  new pure projection over the existing gates, so the apply button's disabled
  state and its pinning tests are unchanged. Display and UI-local state only: no
  types, tables, columns, or serde names changed. The CSS `patch-validation-panel`
  rules were renamed to `patch-checks`. Twelve apply/validate/OpenAI tests that
  clicked the removed button were re-routed to the auto-run; predicted 156 → 168
  frontend (+4 App checks, +4 `summarizeChecks`, +4 `preserveInMemoryValidation`);
  actual 168. Native 104 and AI 15 unchanged.

- **IA restructure slice E — proof is the destination (#9 + #10).** A verified
  apply left the operator on the approval surface, where the product's entire
  value proposition — exact-path post-apply verification — rendered as a disabled
  **Patch applied and verified** pill and a `role="status"` paragraph. A verified
  apply now navigates to **Changes**, on real read-only Git state, and the
  verification is the **first child** of the changes dashboard: a heading naming
  the exact applied path and stating that nothing was staged or committed, ahead
  of the Git changed-files list in DOM order.

  **Display and UI-local state only. No native, apply, or verification logic
  changed.** A new `lastVerifiedApply` UI state carries the proof (path, applied
  time, backup id) from the apply handler to Changes; `setActiveSection("changes")`
  fires only on `applied_verified`, so a **quarantined** apply keeps the operator
  on the approval surface where the recovery evidence and `INSPECTED`
  acknowledgement live. The proof is scoped by repository id at the render site —
  a switch cannot render one repository's verification over another's Git state —
  and it is **retracted when the same artifact is rolled back**, so the
  destination never claims a write that was undone. No types, tables, columns, or
  serde names changed; the `PatchArtifacts` apply/verification rendering is
  untouched (still shown if the operator navigates back to the approval).

  Proven non-vacuous by neutralising the navigation and watching the Changes
  verification heading never appear. The single live-apply test
  (`requires typed confirmation and applies only through the ID-only native
  boundary`) is re-pointed from the old approval-surface pill/prose to the new
  landing: it asserts the heading naming `packages/ai/src/index.ts` and "nothing
  was staged or committed" appears with no manual navigation, that the "Patch
  applied and verified" pill is **absent** from the document (it lives on the
  surface we left), and that the heading precedes the "Changed files" list via
  `compareDocumentPosition`. Predicted 168 → 168 frontend (one existing test
  re-pointed, none added); actual 168. Native 104 and AI 15 unchanged.

  **Deliberately partial against #10.** #10 also argues Changes should drop the
  full indexed-file browser it hosts. That is a separate surface removal with its
  own test surface (the preview-state tests) and is **not** among this slice's
  assertions; it is left for its own slice rather than bundled into a landing
  change. So the verification is now the primary content *by position and
  emphasis*, but whether it is the loudest thing on the screen — with the hero
  card, feature grid, status card, and file browser still below it — is a visual
  judgment this agent cannot make (eyes-only).

- **IA restructure slice F — Review is the front door; Repository Intelligence
  demoted.** The app entered through Overview, a summary dashboard, and the
  Repositories section wore the headline "Repository Intelligence" — positioning
  the product by a file-tree summary with extension counts (the claim #11 lists
  for retirement) rather than by the change-control decision the product is built
  around.

  **Landing is now conditional on whether there is anything to review.** A
  populated workspace enters through **Approval Review** (the front door);
  `activeSection` initialises to `approvals` rather than `overview`. An empty
  workspace has nothing to review, so once hydration confirms no saved
  repository — both the ordinary empty path and the failed-hydrate `catch`, since
  a failed hydrate also leaves the workspace empty — it is redirected to
  **Repositories**, the section that names the next action (choosing a
  repository). The redirect fires through a functional updater guarded on
  `current === "approvals"`, so a navigation made during a slow native hydrate is
  respected rather than yanked back to Repositories.

  **Repository Intelligence is demoted out of the headline, not deleted.** The
  Repositories section title changes from "Repository Intelligence" to
  "Repositories" (and its eyebrow from "Repository intelligence" to "Workspace
  repositories"); the phrase survives as a card-eyebrow sub-panel label *within*
  the section, so it is reachable within Repositories but no longer names it. It
  was never a nav item — the nav label was always "Repositories" — so the
  demotion is the removal of a section *headline*, and a test pins that no
  `level: 1` heading reads "Repository Intelligence" on any surface while the
  sub-panel label still renders inside the section.

  **The nav item set is deliberately unchanged (six), and a test pins it.**
  Removing Overview was considered and **deferred**: post-#2 it is a derived
  summary with no unique authority, but it is a whole surface with its own test
  coverage — the #2 clean-marker-agreement and #6 foreign-count honesty tests
  both assert on the Overview Active Work card — and this project defers unbid
  surface removals to their own slice rather than bundling them into a landing
  change (the same call slice E made for the indexed-file browser). "Review is
  the front door" is realised by *where the app enters*, not by demolishing the
  other rooms. The pinned set guards the demotion in the other direction too: it
  fails if anyone re-promotes "Repository Intelligence" to a nav item instead of
  demoting it (verified by mutation — adding it as a seventh item fails the
  label check).

  **Display and UI-local state only.** `NavigationSection` in `packages/core` was
  in scope but needed no change — the union and `primaryNavigation` already
  carried the six ids and the "Repositories" label; the demotion lives entirely
  in `appData.ts` section copy, and the landing lives in `App.tsx` UI state. No
  types, tables, columns, or serde names changed. Four new tests, all shown
  failing for the right reason first (empty→Repositories and populated→Review
  both landed on Overview before the change; the Repositories headline read
  "Repository Intelligence"). Five existing tests that depended on the Overview
  landing were re-pointed to navigate to Overview explicitly (it remains a nav
  item): the six-tab smoke tour, the Overview mock-composer shortcut, the #2
  clean-marker agreement, the #2 honest-empty-state, and the #6 foreign-count
  test. Predicted 168 → 172 frontend (+4, none re-pointed test added or removed);
  actual 172. Native 104 and AI 15 unchanged.

  **Eyes-only:** whether Review, entered at position four in the sidebar with
  Overview still above it, *reads* as a front door — and whether landing a
  populated workspace on a possibly-empty Approvals surface feels like an
  entrance rather than a dead end — is a visual judgment this agent cannot make.
  Reordering the sidebar so Review sits at the top was left out as a visual
  change with no structural assertion.

- **IA restructure slice G — the six distinctions as copy.** The product's
  vocabulary overloads six pairs that a careful operator must keep apart, and #11
  records the overload as the finding. Each distinction now names the line between
  the two ideas as text, at the surface where they are easiest to confuse:

  1. **Approve vs apply** — *already* asserted at Apply Readiness ("Applying
     modifies files in your working tree. It does not commit or stage changes,
     and approval alone never applies a patch") and pinned by an existing test.
     Left unchanged and not re-pinned; recorded here so the set is complete.
  2. **Checks vs apply** — a new boundary line on the Checks panel: "Checks are
     read-only evidence — they never modify your working tree, and passing checks
     are not approval to apply." A green check is evidence, not permission.
  3. **Proposed vs actual** — a new caption above the generated-diff banner: "This
     is the proposed change, not the actual one. Nothing is written to disk until
     you apply; post-apply verification then reports what actually changed." The
     diff is what the model suggested; only the Changes verification (slice E)
     reports what landed.
  4. **Demo vs real provider** — a new, always-present line in Provider Context:
     "Mock Provider is a demo that plans only; applying and rolling back a patch
     needs a real provider such as OpenAI." It states in one sentence the product
     fact #11 records at length — the mock cannot reach the apply/rollback path.
  5. **Quarantine vs failed** — a new line in the recovery panel, shown only when
     the outcome is `quarantine_required`: "A quarantine blocks every further
     apply to this repository until you record an inspection — unlike a failed
     apply, which changes nothing and blocks nothing." Names the blocking
     consequence a plain failure lacks.
  6. **Backup vs rollback** — the Apply Readiness backup note is extended: "The
     backup is only a receipt of the original bytes; restoring them later is a
     separate, explicit rollback." #4's "a backup nobody can restore is a receipt,
     not a safety net", stated where the backup is first named.

  **Display and UI-local copy plus CSS only. No native, apply, or verification
  logic changed; no types, tables, columns, or serde names touched** — the diff is
  four frontend files (`App.tsx`, `PatchArtifacts.tsx`, `styles.css`, and the
  test). Five new tests, each shown failing for the right reason first — the exact
  string absent *after* navigation reached the surface, so the failure is a
  missing line, not a broken path. Approve vs apply added no test (already pinned).
  Predicted 172 → 177 frontend; actual 177. Native 104 and AI 15 unchanged.

  **This is the slice where tests prove the least, and that is stated rather than
  hidden.** A green test here means the string is present in the rendered tree at
  the named surface — not that the distinction *reads* clearly, sits with the
  right emphasis, or actually lands with an operator. Whether six clarifying lines
  help or merely add words, whether each sits where a confused reader would look,
  and whether the copy tone matches its neighbours are all visual judgments this
  agent cannot make. Nearly all of G is eyes-only.

- **Three visible UI breaks found by human packaged QA.** Reported from the
  packaged app, which is the only surface that can find these: two are layout
  collapses that no test in this project can see, and they were found by looking.

  **Two of the three are the same defect — a grid template describing contents
  that are not there** — and both were introduced by an earlier, correct change
  that removed the contents and left the template.

  1. **Overview's "Workspace state" card rendered a repository name vertically**,
     one or two characters per line ("airl / oc / k- / dis / po / sa / ble /
     -qa"). `.reference-activity-item` declared `24px minmax(0, 1fr) max-content`
     — a marker track, a content track, a time track — from when this card was
     the fabricated activity feed. **#2 deleted the marker `<span>` and the
     `<time>` and left the template**, so the surviving content `<div>` is the
     row's only child and auto-placement drops it into the **24px marker track**.
     `overflow-wrap: anywhere` on `.overview-card h3` — added so long repository
     paths wrap rather than overflow — then permits a break between any two
     characters, so the name did not overflow its 24px box, it shattered down it.
     Now one content column, because one child is rendered. The
     `:not(:last-child)::after` rail went with it: a 1px spine at `left: 11px`,
     the centre of the deleted marker track, joining markers that no longer
     exist — with content starting at x=0 it would have struck through the text,
     a new break introduced by the fix.
  2. **Plan step badges clipped their own labels** — "completed" read as
     "ompleted", "planned" as "lanned", on both Agent Runs and Approvals. The
     number badge is `.plan-step-list li::before` with `position: absolute`, so
     it is **not a grid item and contributes nothing to a `max-content` track**.
     Both real children are pinned to column 2, so column 1 held no item at all
     and `max-content` resolved to **0**: column 2 began at 26px while the badge
     spans 14px–42px, painting over the pill's leading characters. The track is
     now an explicit 28px sharing a custom property with the badge's own box, so
     the two cannot drift. Wide-viewport only — the narrow override already
     collapses the row and hides the badge with `display: none`.
  3. **Overview's "Active work" card contradicted itself inside one card**:
     "No active work" beside a pill reading "waiting for approval", over prose
     inviting a review of a plan that did not exist. The halves had different
     fallbacks — the heading from `demoWorkflowProposal?.title ?? "No active
     work"`, the pill from `… ?? "waiting for approval"` — and with no proposal
     both fire and disagree. **A status pill for a proposal that does not exist
     is a status for nothing**; it now renders only when there is a proposal to
     have a status. A #7 UI-truthfulness finding in shape, found by eye rather
     than by audit.

  **Only (3) was testable, and the pair of tests is the point.** "waiting for
  approval" is reachable *only* through the removed fallback — a real status
  renders as its own id with underscores replaced ("ready for review") — so its
  presence in that card is the bug rather than a coincidence of wording. The
  second test pins the other direction, that a real proposal still reports its
  real status, because without it **deleting the pill outright would satisfy the
  first**. Shown failing for the right reason first: the failure message carried
  the contradiction verbatim. The second was green on arrival, so it was
  neutralised by suppressing the pill and watched fail. Predicted 177 → 179
  frontend; actual 179. Native 104 and AI 15 unchanged.

  **(1) and (2) have no test pressure at all, and the green suite says nothing
  about them.** jsdom has no layout engine: a collapsed grid track, a 24px
  column, and a badge painted over a label are all invisible to every assertion
  available here. Both were established by reading the template against the
  rendered children — and, for (1), against the commit that removed them — not
  by observation. **A human verifies them on screen.** This is the counterpart to
  slice G's note: there, green meant a string was present; here, green means only
  that nothing crashed.

  **What this says about the restructure.** Both layout breaks are the residue of
  a *correct* deletion — #2 removed fabricated content honestly and left the CSS
  that was shaped around it. The lesson is not "#2 was wrong" but that removing
  an element and removing the layout that reserved space for it are two changes,
  and this project has now shipped the first without the second twice in one
  card. Worth a sweep for other templates whose tracks outnumber their children;
  `.reference-activity-marker` and `.reference-activity-item--neutral` are still
  declared and no longer rendered, left in place rather than bundled into a fix
  for a visible break.

- **Overview's Active Work card points at real work.** The card resolved its
  entire content through `persistedProposedChanges.find(c => c.id ===
  demoWorkflow.proposedChangeId)` — **a hardcoded lookup for one fixture id**, so
  every real provider-generated proposal was invisible to it and Overview
  reported "No active work" while Approvals showed that proposal waiting. The
  preceding UI-break fix removed the card's *self-contradiction* and left this
  intact; worse, it made the falsehood confident, replacing a visible
  contradiction with a clean "Nothing is waiting for review." A new pure
  projection, `selectActiveWork`, reads the real proposals instead.

  **Repository-scoped, and not as a coin flip.** #6 had to settle "workspace
  total or active repository?" deliberately, and here the card's own body answers
  it: Repository, Branch, Local path, Open Changes, and Clean Working Directory
  are **all active-repository facts**, so a foreign proposal's title rendered
  above them would print one repository's work over another's branch — the exact
  lie #6 fixed at two other sites. The scope is now said out loud ("in this
  repository"), because an unlabelled scoped claim sitting beside Overview's
  labelled workspace totals ("across all repositories") is the shape #6 and #2
  both had to correct.

  **Active work is an allow-list of statuses, ranked by meaning, and the compiler
  enforces its completeness.** `quarantine_required` (0) outranks
  `ready_for_review` (1), which outranks `approved` (2); `draft`, `rejected`,
  `superseded`, `applied`, and `rolled_back` are not active work. Quarantine is
  first on #1's argument: it blocks every further apply until a human records an
  inspection, so a card that excluded it would report "No active work" over a
  repository that cannot accept a patch at all. It is a `Record` over the whole
  union rather than a list of the active ones, so **adding a status to
  `ProposedChangeStatus` is a compile error here until someone classifies it** —
  proven by mutation (`error TS2741: Property 'draft' is missing`), not asserted.
  This project has twice shipped a guard whose default was the defect; a display
  has the same failure shape, and the compiler can close it, so it does.

  **It does not order by `updatedAt`, because that field cannot order anything** —
  see the finding under #7. The tie-break is list order, pinned by a test that
  names why, so the next person reaching for a timestamp has to confront it. The
  card therefore **does not claim** the proposal it shows is the newest or the
  most urgent when ranks tie; it says how many are active and points at Approvals.

  **The count exists so the card cannot understate the work.** Showing one of
  several without saying so is a quieter version of the contradiction this card
  already had. It counts the scoped list it labels, per #6.

  `demoWorkflowProposal` is untouched and still serves the **Demo workflow** card,
  which is explicitly labelled a demo — the fix removes the fixture's *privileged*
  position on a surface making workspace claims, it does not delete the fixture.
  Display and UI-local only: no types, tables, columns, or serde names changed.

  Shown failing for the right reason first: with a real `ready_for_review`
  proposal for the active repository in storage, the card rendered "No active
  workNothing is waiting for review." Non-vacuity proven by mutation rather than
  by construction — neutralising the repository filter failed 4 tests (2 unit, 2
  App), and flattening the rank map failed 8. Predicted 179 → 198 frontend (+15
  `selectActiveWork` unit, +4 App); actual 198. Native 104 and AI 15 unchanged.

- **Part 2 deletion pass: duplicated and empty cards.** 18 stat cards asserting
  3 facts (one "Workspace metrics" strip rendered above all six sections, so one
  deletion took all 18), Changes' three explainer cards, the Validation "Check
  strategy" card on both surfaces, the duplicated "Proposed Plan Review" and
  "Repository Context" blocks in Approvals, the "Package / Framework Hints" card,
  Changes' second "No local changes waiting for review", the indexed-file browser
  in Changes, and the two Settings controls that could never enable. Frontend
  199 -> 200 (9 added, 8 deleted); predicted 200, actual 200.

  **Lint and typecheck are blind to dead code here, which is worth recording.**
  After the deletions both were green while eight symbols were orphaned --
  `SummaryCard`, `waitingAgentRunCount`, `indexedRepositoryCount`,
  `changeFeatureBlocks`, `renderIndexedFileBrowser`, `resetConfirmationText`,
  and the `IndexedFileBrowser` import. There is no `no-unused-vars` rule and
  `noUnusedLocals` is off, so green meant only that nothing crashed. Each was
  found by grep and removed by hand.

  **Three consequences the brief did not predict, recorded rather than absorbed:**

  1. **The file-preview feature lost its only UI.** The brief called the Changes
     browser "a second file explorer" -- true of that screen, false of the app.
     `renderIndexedFileBrowser`'s `"compact"` variant was already dead, so
     Changes was the sole call site. Deleting it orphaned
     `IndexedFileBrowser.tsx` (deleted) and **8 preview tests** (deleted), and
     left `previewRepositoryFile` / `storage/filePreview.ts` live but
     unreachable -- nothing sets `selectedFilePath` now, so the app fetches a
     preview no surface renders. Options in `.loop/decisions.md`; (a) rehome in
     Repository, where the unused `"compact"` variant suggests it was headed.
  2. **The Package / Framework Hints card carried real facts.** The brief named
     it by its dead "Package scripts unavailable" note, but the card also drew
     path-derived TypeScript/Tauri hints, which two assertions pinned. The whole
     card went, as instructed; the hints were real and are now gone.
  3. **#6's honest survivor was a duplicate.** The Approvals "Repository
     Context" side card was the one place #6 deliberately allowed the active
     repository's branch to print, and its test asserted exactly 1 occurrence.
     It duplicates the identical card on Agent Runs, so part 2 deleted it and
     the assertion is now 0. Re-proven non-vacuous by reintroducing #6's
     original bug and watching it fail.

  Dead CSS was **not** swept: `overview-grid`, `changes-feature-grid`,
  `framework-hints-card`, `patch-artifact-empty`, `file-browser-shell`,
  `git-status-empty`, `approval-plan-review-card`, and the
  `maintenance-action--danger` rules survive with no markup. Left deliberately --
  the classes sit beside shared ones like `overview-card`, and a stylesheet sweep
  is not a card deletion.

- **Part 5: Agent Runs folded into Review — the noun is removed, not renamed.**
  Part 4 collapsed the nav to four items and left `agents` in the
  `NavigationSection` union with its section still rendering, reachable only
  through Working tree's "Start mock agent run" hero. Part 5 deletes the
  destination outright. The composer (the same `startAgentRun`, only its form
  moved), the structured plan (steps + risks), Provider Context, the read-only
  checks, the reviewable patch artifact detail, and the approve/reject decision
  now all live on **Review**. `agents` is gone from the union, from `appData`'s
  three `Record<NavigationSection, ...>` maps, and from the section render;
  proposing a change and deciding on it are one flow on one surface. The two
  "Start mock agent run" hero buttons (Repositories, Working tree) are renamed
  "Propose a change" and point at Review; `startAgentRun` now
  `setSelectedApprovalRequestId(result.approvalRequest.id)` so a freshly composed
  proposal is selected in place.

  **The four safety paths are untouched.** Apply, rollback, acknowledge, and the
  checks auto-run still flow through the one `PatchArtifactDetail` render site in
  Review, bound to the singular `selectedApproval*` state exactly as before —
  every apply/rollback/acknowledge/recovery test was re-pointed (drop the
  Agent-Runs→Review-approval hop; land on Review directly), not rewritten. The
  apply affordance renders in exactly one place, pinned by test.

  **Deviation from the brief's design spec, stated rather than hidden.** The spec
  asked for "one self-contained card per proposal, no master/detail." That was
  **not** built, and the reason is a real collision the brief invited me to
  surface: the checks auto-run effect (slice C) fires the native dry-run for the
  **one** selected artifact on review-open, and the entire readiness/apply wiring
  (`selectedApprovalPatchApplyAttempt`, `currentFingerprintSnapshot` keyed by
  artifact id, feedback matched by artifact id, `preserveInMemoryValidation`) is
  singular. Rendering N proposals as N live `PatchArtifactDetail`s would fire N
  native dry-runs on open and duplicate that wiring N times — a large, risky
  change to the tested apply path for a purely presentational reorganisation that
  no ASSERT and no test requires, and one that collides with CLAUDE.md's "Don't
  rewrite App.tsx." Instead Review keeps its queue-select-detail: the queue is
  the proposal list, and selecting a row shows that proposal's plan, checks, diff,
  decision, and Evidence disclosure **on the same surface with no navigation** —
  which is exactly what the ASSERT ("a proposal row renders its plan, checks
  line, and decision controls WITHOUT navigation") requires. Selecting a row in a
  queue is selection within one surface, not a hop to a destination. The spec's
  copy refinements ("Describe a change to propose…", a "Propose" button, the
  per-card meta line and "Proposed — not yet real" diff label as literal strings)
  were **not** all applied verbatim where doing so would have churned the many
  compose/apply tests that key on the existing handles; the compose form moved
  mostly verbatim (button "Run mock agent", textbox "Agent task request") to
  preserve them. What was genuinely required — remove the noun, one apply place,
  gates behind Evidence, compose+review on one surface — is done. The full visual
  reshaping to literal per-proposal cards is a follow-up slice, not this one.

  **Tests: 181 → 178, and the arithmetic is stated.** Four agent-run *rendering*
  tests were **removed**, not re-pointed — their subject (the rendered run list
  and run-detail card) no longer exists, and the scoping *logic* they exercised
  (`scopeRecordsToRepository`) is covered in full by the parallel approval-scoping
  tests that render the same scoped/unlinked grouping in Review's queue. One new
  test was added ("folds compose, plan, checks, and decision onto Review with no
  navigation") pinning the four ASSERTs together on one surface. Net −4 +1 = 181
  → 178. Two new guards were neutralised and watched fail (the folded plan block;
  the compose card heading) before being restored. Predicted 178; actual 178.
  Native and AI suites unchanged (not run: `cargo` is not on PATH in this
  environment, and part 5 touches no native code).

  **Orphans the compiler and linter could not see, removed by hand** (there is no
  `no-unused-vars` rule and `noUnusedLocals` is off, so green said only that
  nothing crashed): `renderAgentRunRow`, `openDemoAgentRun`, the `selectedAgentRunId`
  and `selectedAgentPatchArtifactId` state plus their setter calls and the
  artifact-sync effect, the whole `scopedAgentRuns`/`visibleAgentRuns`/
  `activeAgentRun`/`activeAgentRunIsScopedToRepository`/`activeProposedPlan`/
  `activePersistedProposedChange`/`activeRunApproval`/`selectedAgentPatchArtifact`
  derived chain, and the now-unused imports `agentRunTone`, `isSeededRunId`,
  `resolveAgentRunRepositoryId`, `proposedChangeStatusTone`. `selectedReadinessArtifact`
  /`selectedReadinessChange` collapsed to the approval variants (Review is the
  only surface with an apply lifecycle now). Dead CSS (`agent-run-*` classes) was
  left in `styles.css` per the part-2 precedent — a stylesheet sweep is not a
  section deletion.

- **Part 5 (copy pass): the design-spec labels now land on the folded Review.**
  The fold above deliberately deferred the spec's copy; this pass applies it on
  the *same* single-detail architecture (a human decision — the alternative, a
  literal per-proposal-card rebuild, was declined against CLAUDE.md's "Don't
  rewrite App.tsx" and to avoid N cards firing N native dry-runs). Landed:
  the compose control now reads "Describe a change to propose…" with a "Propose"
  button (was "Run mock agent" / "Generate plan with OpenAI"); the proposed diff
  carries a header strip **"Proposed — not yet real"** — the distinction the
  product exists to hold, which appeared nowhere before; the approval-row pill
  states the user's obligation, **"Needs you"** for pending and **"No patch"**
  for a patchless proposal, not the record's internal status; a muted **"Apply
  unlocks after approval"** sits beside Approve while pending; the gate
  disclosure is reframed **"Evidence — 18 readiness gates"** / "Hide evidence";
  a patchless artifact collapses to **"Plan only — the demo provider produced no
  patch"**; and the shared compact page title drops to 25px/500.

  **One honest deviation from the spec string.** The spec labels the disclosure
  "Evidence — 18 checks, artifact digest, repository snapshot, fingerprints",
  but the disclosure only reveals the 18 readiness gates. Shipping that full
  label would promise three kinds of evidence the panel does not show — exactly
  the fabrication class #2 and #3 record. The label names what it actually
  reveals: "Evidence — 18 readiness gates". If the digest/snapshot/fingerprints
  are wanted *in* the disclosure, that is a content change, not a copy one.

  **Tests: 178 → 184.** Six new guards, each **watched failing for the right
  reason first** (a genuinely-absent element, not an invented path — one had an
  ambiguous `/not generated/i` selector that was tightened before it counted).
  The obligation-pill guard, the only one with branching logic, was additionally
  neutralised and watched fail before restore. Coupled existing tests were
  re-pointed to the new copy, not deleted: "Run mock agent"/"Generate plan with
  OpenAI" → "Propose" (8 sites), the disclosure handle → `/Evidence/i` (a stable
  match across both toggle labels, since collapsed "…readiness gates" and
  expanded "Hide evidence" share only "evidence"), and the diff label (2 sites).
  Predicted 184; actual 184. AI 19 green; native not run (`cargo` not on PATH).

  **Not done, deliberately.** The literal per-proposal-card visual (each proposal
  a self-contained card rather than queue-select-detail), the checks *band* vs
  the current summary, and the per-card meta line remain a follow-up — they need
  the architecture the fold declined. ~~The in-section `approvals-hero-card` now
  duplicates the page header's eyebrow/title/subtitle and is a candidate for
  removal, but that is a card deletion, not a copy pass, so it was left.~~ —
  **the hero card was removed in the follow-up below.** ~~Dead `agent-run-*` CSS
  still unswept.~~ — **swept; see the CSS entry below.**

- **Removed the `approvals-hero-card` that duplicated the page header.** After
  the part-4 header work, Review's in-section hero repeated the page header
  exactly: eyebrow ("Human Approval Review" beside the header's "Human
  approval"), the pending count as an `<h2>`, and the same "does not touch your
  files" sentence. The whole card is gone, and its own CSS (`.approvals-hero-card`
  and descendants — three rules, exclusive to it) went with it, since removing a
  card's dedicated rules is precise, not a stylesheet sweep. The count it carried
  survives in the page header's "Pending approvals: N" pill, so seven existing
  tests that used the `<h2>` as a count proxy were re-pointed to that pill rather
  than deleted — the count/scoping assertions they make are unchanged. Frontend
  184 → 185 (one absence guard, watched failing with the card present before
  removal). AI 19 green; native not run (`cargo` not on PATH).

- **Swept the dead `agent-run-*` and `overview-*` CSS.** Parts 2/4/5 deleted the
  Overview section, the workspace-metrics strip, and the Agent Runs destination,
  and each recorded its CSS as "left, a stylesheet sweep is not a card deletion."
  This is that sweep, scoped to the two families named. 171 lines removed from
  `styles.css` (`overview-grid`, `overview-grid--compact` and its `.summary-card`
  descendants, `overview-lower-grid`, `overview-side-column`; `agent-run-workspace`,
  `agent-run-list`, `agent-run-list-card`, `agent-run-detail-card`,
  `agent-run-list-item` and its variants, `agent-run-side-column`), including the
  responsive rules that referenced them.

  **Deadness was proven, not eyeballed** — the discipline for a change no test and
  no typecheck can catch (jsdom applies no CSS; the build only checks syntax). A
  script matched every `agent-run*`/`overview*` class token in the stylesheet
  against every `className` in the source, and a second grep caught **dynamic**
  construction — which is what saved `agent-run-execution-status--success/--error`
  (built via `` `…--${agentExecutionState}` ``, invisible to a static token
  search) and kept them. Only rules whose every selector referenced a
  proven-dead class were removed; **grouped selectors mixing dead with live**
  (e.g. `.agent-run-workspace, .approval-review-workspace`, or the `agent-run-list-item`
  responsive group beside `.approval-queue-item`) had only the dead selector
  dropped, never the rule.

  **Kept, live:** the compose form's `agent-run-create-*`/`-provider-field`/
  `-task-field`/`-execution-status*` (the fold moved that form onto Review), the
  shared `overview-card`/`overview-card__header` base, and the `record-list-*`
  rules that sat *interleaved* inside the dead `agent-run-list` block (they are
  the approval queue's). ~~**Out of scope, left standing:** other dead families the
  removals also stranded — `changes-feature-grid`, `framework-hints-card`,
  `patch-artifact-empty`, `proposed-plan-card`, `agent-detail-fact-grid`,
  `maintenance-action--danger`, etc.~~ — **swept in the follow-up below.** Braces
  balanced (662/662); 185 frontend / 19 AI green; native not run (`cargo` not on
  PATH). CSS-only: no `.tsx` touched.

- **Swept the remaining dead CSS across all families.** The follow-up to the
  above: every other dead class the Overview / Agent-Runs / file-preview /
  activity-feed / quick-start / framework-hints removals stranded. **~1870 lines
  removed** from `styles.css` (662→434 brace-pairs); 103 classes gone entirely,
  plus dead selectors trimmed out of grouped rules and dead-anchored compound
  selectors (`.activity-item .status-pill--*`, `.sidebar-upgrade__icon .app-icon`,
  the media-query `.workspace--feature .proposed-plan-card` group) removed.

  **Method — deadness proven mechanically, because nothing catches a wrong CSS
  removal** (jsdom applies no CSS; the build only checks syntax, and I can't see
  pixels). A script matched every class token in the stylesheet against every
  `className` in source, then — the load-bearing step — inspected every dynamic
  `className={\`…\`}` in the codebase to separate the **eight real BEM-modifier
  builders** (`icon-badge--`, `status-pill--`, `app-icon--`, `git-diff-line--`,
  the three feedback ones, `agent-run-execution-status--`) from **ID
  construction** (`run-${id}`, `approval-${id}`, `file-${id}` — strings, not
  classes). The modifier bases were protected; the ID prefixes protect nothing.
  Removal ran through a brace-matching parser that deletes whole rules and trims
  grouped selectors, gated on four invariants checked after every pass: **braces
  balanced, no `live()` class loses all its rules, no `}selector` glue, and no
  invented declaration** (new property-lines ⊆ old — proving bodies were never
  touched, only selectors).

  Two false-live tokens the guard flagged and I cleared by hand: `full` and
  `file-preview` — matched only by a variant string (`renderIndexedFileBrowser("full")`),
  a `.md` path in test data, and prose in a comment; neither is a real class, and
  `compact` (genuinely live via `.status-row.compact`) was correctly kept.

  185 frontend / 19 AI green; typecheck, lint, `build:web`, `git diff --check`
  all clean. CSS-only — no `.tsx` touched, and the invented-declaration check
  proves no live rule's body changed, so nothing rendered can have changed unless
  a removed selector matched a live element, which the deadness proof rules out.
  Native not run (`cargo` not on PATH).

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

**Re-verified 2026-07-16** against the post-parts-2/4/5 code. The parts rebuild
(nav collapse, Review fold, Overview + card deletions) resolved two findings
incidentally and shrank a third; the two data-shape findings remain live. Each
entry below carries its current verdict.

- **Approval durability. — FIXED 2026-07-16.** `updateApprovalStatus` used to
  write UI state (`setApprovalRequests`/`setAgentRuns`/`setPersistedProposedChanges`)
  before its `await updateApprovalRequestStatus` / `await saveProposedChanges`
  persistence, with no `storageStatus` guard and no `try`/`catch` — the only
  mutation path lacking both — so a rejected write left the UI claiming
  "approved". It now persists first, matching the codebase idiom (line ~892):
  `if (storageStatus === "ready")` it writes inside a `try`, and a rejected write
  `return`s before any UI update, leaving the request pending with its
  Approve/Reject controls live for a retry. When storage is unavailable the
  session is in-memory only, so the persist is skipped and the UI update is the
  state (browser-verified: the preview can still approve). A test drives a
  rejected write and pins that the UI does not claim the decision, watched
  failing first (the old code showed "Request approved").
- ~~**Provider pill reports the wrong provider.** The Agent Run "Provider Context"
  pill renders the mock provider's `status` with a hard-coded success tone, even
  for an OpenAI run, while the prose directly beneath it correctly branches on
  `providerId`. An OpenAI run whose provider is unreachable still shows
  "connected".~~ — **STALE, resolved by the parts 2/4/5 rebuild (re-verified
  2026-07-16).** Agent Runs folded into Review; the surviving Provider Context
  block (App.tsx:2883–2900) is prose-only and branches on `providerId`, and the
  compose status pill (App.tsx:2535–2543) shows "configured" / "not configured"
  for OpenAI and the real `provider.status` for mock — no false "connected".
  Residue, cosmetic only: a green provider-name chip (App.tsx:2603) styles the
  provider *name* with a success tone, but it makes no status claim.
- ~~**A never-indexed repository is indexed by a button that says "Reindex".**~~
  — **landed with #11 slice D (see the Done entry).** Selection now starts
  indexing on both selection surfaces, so the Reindex button is no longer a
  first-index path and its label stops asserting a history that never occurred.
  The finding was recorded here separately from the IA judgment precisely so it
  would survive if the slice were deferred; the slice was not deferred. Original
  finding, kept for the record: `startIndexingJob` had exactly three call sites —
  its own definition, `runMaintenanceReindex`, and the Repositories "Reindex
  repository" button — and none was on the selection path, so selecting a
  repository never started indexing and the only control that performed a *first*
  index asserted a previous one. Suspected part of what stalled the human packaged
  QA at its indexing step; the operator's own account is in
  `docs/qa/evidence/mvp-demo-v1-disposable-apply-qa.md`.
- **Dead controls. — FIXED 2026-07-16.** ~~Two "Copy repository path" buttons
  and a "View all" button render with no handler.~~ The parts rebuild removed
  "View all" and the second copy button; the last dead "Copy repository path"
  button (a `<button>` with an `aria-label` and no `onClick`) is now removed too,
  along with its `.active-path-box button` styling, and the path box collapsed
  from three grid tracks to two. The local path is still shown, just not as a
  fake affordance. ~~Settings draws a "Clear caches" action that cannot execute
  and a `RESET WORKSPACE` confirmation input whose button is permanently
  `disabled`, so `resetConfirmationText` is write-only state.~~ — **the two
  Settings controls landed with the part 2 deletion pass**, along with
  `resetConfirmationText` itself. Ship a control or do not draw it — all done.
- ~~Quarantine renders as a calm neutral pill~~ — landed with #1.
- ~~Overview "✓ No" clean marker disagrees with Changes~~ — landed with #2.
- ~~Overview "Active work" says "No active work" beside a "waiting for approval"
  pill~~ — landed with the three-UI-breaks entry (see Done). A #7-shaped finding
  in every respect except how it was found: by a human opening the packaged app,
  not by reading the code. Recorded here because the list is where this class of
  finding belongs, and because it is evidence that the class is not exhausted.
- **`createdAt` / `updatedAt` / `startedAt` are display strings, not timestamps.
  — FIXED 2026-07-16.** Records now store ISO 8601: `startedAt` is built as
  `createdAt.toISOString()` (App.tsx), so the proposal's `createdAt`/`updatedAt`
  and the run's `startedAt` are all sortable, and the demo fixtures were
  converted from `"Today, HH:MM"` to fixed ISO. A UI-local `formatRecordTimestamp`
  renders them ("Today, 10:44" only when it is actually today, else the date),
  with legacy passthrough so rows written before this still display.
  `executeAgentRun` was left untouched — its `createdAt: request.startedAt` now
  receives ISO. Five tests: the formatter's same-day/other-day/passthrough/sort
  behaviour and a behavioural test that a composed run persists an ISO
  `createdAt`, watched failing first (`'Today, 06:23 PM'`). Original finding
  below, kept for the reasoning.

  Found while implementing the Active Work fix, which needed to order proposals
  and could not.
  `AgentRun.startedAt` is built at `App.tsx:685` as
  `` `Today, ${createdAt.toLocaleTimeString(...)}` `` — **for real runs, not only
  fixtures** — and flows into the real proposal's `createdAt` via
  `createdAt: request.startedAt` (`packages/ai/src/index.ts:1547`, `:1569`,
  `:1582`). `updateApprovalStatus` then writes `new Date().toISOString()` into
  `updatedAt`. `updateApprovalStatus` then writes
  `new Date().toISOString()` into `updatedAt`. So one field holds two
  incompatible formats, and **neither can order anything**: lexicographically
  every `"Today, ..."` sorts after every ISO string, and `"Today, 9:05"` sorts
  after `"Today, 10:44"`. Three consequences, none yet fixed:

  1. **No surface can sort by time.** The Active Work card wanted "the most
     recently updated active proposal" and had to rank by what each status
     *means* instead. That ranking is defensible on its own, but it was chosen
     because the data cannot answer the obvious question.
  2. **`"Today, ..."` persists.** It is written to SQLite and read back, so a
     proposal created yesterday still renders "Today, 10:44" after a restart. A
     #7 truthfulness finding: the field asserts a day it has no basis for.
  3. **A future sort would look right and be wrong.** Nothing fails loudly —
     `updatedAt` is a `string` and comparing strings compiles. This is #18's
     pattern outside git: **a field named like a timestamp, modelled as one, and
     never probed.** `selectActiveWork` pins the tie-break with a test naming
     this so the next person to reach for `updatedAt` has to confront it.

  Not fixed here because it is a data-shape change reaching the persisted
  columns, and the standing bound is that types, tables, columns, and serde
  names keep their identifiers.

- **Overview "Active work" is hardwired to one fixture id — the contradiction is
  fixed, the card is still not true.** ~~Open.~~ **Landed — see the Done entry
  for the Active Work rebuild.** Kept because its reasoning is the rationale for
  that fix. The
  card's whole content is `persistedProposedChanges.find(c => c.id ===
  demoWorkflow.proposedChangeId)` — a hardcoded lookup for `proposal-mvp-shell`.
  A workspace holding a **real** OpenAI-generated proposal has no such id, so
  Overview reports "No active work" while Approvals shows that proposal waiting.
  The heading makes a workspace-level claim on the evidence of one fixture.

  **The fix made the falsehood more confident, which is worth stating.** Before,
  the card contradicted itself — a tell. It now reads "No active work" over
  "Nothing is waiting for review.": cleaner, and false in exactly the same case.
  Removing a contradiction can make a falsehood more persuasive; #2 and #3 both
  record that a false account costs more than an obviously broken one.

  Deliberately not fixed with the UI breaks: pointing the card at real work means
  deciding whether "active work" is the workspace total or the active
  repository's — the two-count question #6 settled deliberately — and #11 owns
  whether the demo fixtures should exist at all. That is a product decision, not
  a UI-break fix. Options and reasoning are in `.loop/decisions.md`, which is
  gitignored, so the finding is recorded **here** as well rather than only on one
  machine: retire the card (per slice F's deferred Overview removal), point it at
  real work with an explicit scope label, or rename it to the demo workflow's
  proposal so it stops claiming workspace truth. **First resolved by the second
  option — then MOOT (re-verified 2026-07-16): part 4 deleted the Overview
  section and `features/overview/activeWork.ts` entirely, so the card no longer
  exists on any surface.** The first resolution stands in history; the card it
  fixed is gone.

## Design Changes

These are product and UX judgments from the review, not defects. Nothing here is
misbehaving; the argument is that the current shape communicates badly. They are
tasks, not bugs, and each needs a decision before implementation.

### #8 One apply entry point

**Landed as IA restructure slice A — see the Done entry.** The apply detail now
renders only behind Approval Review; Agent Runs shows the plan, a read-only
artifact summary, and the "Review approval" handoff. Kept here as a stub because
its argument — that apply belongs behind the approval decision, not beside it —
is the rationale later slices build on.

### #9 Make post-apply verification loud

**Landed as IA restructure slice E (with #10) — see the Done entry.** The proof
is no longer a status pill: after a verified apply it renders as a heading naming
the exact applied path and stating nothing was staged or committed, as the first
child of the Changes dashboard. Kept here as a stub because the argument — that
the product's entire value proposition deserves to be the loudest thing on screen
rather than a badge — is the rationale for the emphasis this slice gave it.

### #10 Land in Changes after an apply

**Landed as IA restructure slice E (with #9) — see the Done entry.** A verified
apply now navigates to Changes, on real read-only Git state, with the
verification result as the primary content by position. **One half is
deliberately deferred:** dropping the full indexed-file browser Changes also
hosts is a separate surface removal with its own test surface and is not among
slice E's assertions, so it is left for its own slice. Kept here as a stub for
that remaining half.

### #11 Rename and information architecture

"Changes" currently means three things (proposed change, patch artifact, Git
change). "Agent Runs" implies autonomy that does not exist — nothing runs; there
is one request and one response, no loop and no tools. Review should be the front
door. Validation and dry-run are two words for one idea and should collapse into
"Checks", with the eighteen readiness gates behind an advanced view rather than
presented as workflow steps.

**Slices landed so far.** 1: the product is Airlock, the bundle identifier moved
once to `com.airlocklab.airlock` and is now pinned by a native test. 2: the mock
repository fixture is retired — the last fabrication that could present itself as
a saved repository. A (#8): one apply entry point — the patch artifact detail
renders only behind Approval Review, and Agent Runs hands off to the linked
approval (see the Done entry). B: the eighteen readiness gates are evidence, not
workflow — they no longer render on arrival; an explicit Advanced control reveals
them, and when application is not ready a single summary line names the first
blocking gate's reason instead. `applyReadiness.ts` was untouched (display only),
so the apply button's disabled state is unchanged and its pinning tests stayed
green unmodified (see the Done entry). D: Index merged into Select — selecting a
repository starts indexing on both selection surfaces (native picker first-run and
saved-list switch), with no control between select and indexed; Reindex survives as
an explicit action for refreshing an already-indexed repository, and its label
stops asserting a first index that never happened (see the Done entry). C: validate
and dry-run collapse into one Checks line that runs on review-open — a projection
of `evaluateApplyReadiness`, not of the durable `validationStatus`, so a stale
dry-run reads failed rather than "passed" forever (#4d), and the reload race it
exposed is closed by `preserveInMemoryValidation` (see the Done entry). E (#9 +
#10): proof is the destination — a verified apply lands the operator in Changes
with the exact-path verification as a heading (naming the path, stating nothing
was staged or committed) ahead of the file list, rather than a pill left on the
approval surface; #10's second half — dropping the indexed-file browser Changes
hosts — is deliberately deferred to its own slice (see the Done entry). F: Review
is the front door — a populated workspace enters through Approval Review rather
than the Overview dashboard, an empty workspace lands on Repositories (the
next-action section), and "Repository Intelligence" is demoted from the
Repositories headline to a sub-panel label within it; the six-item nav set is
kept and pinned, with removing Overview deferred as an unbid surface removal (see
the Done entry). G (#11 slice 5): the six distinctions as copy — each of approve
vs apply, checks vs apply, proposed vs actual, demo vs real provider, quarantine
vs failed, and backup vs rollback now names the line between the two ideas as
text at the surface where they are easiest to confuse (see the Done entry).
Remaining:
3 nav rename, 4 domain nouns, 6 demo-workflow copy.
(The letter/number split is intentional: these lettered slices — order A, B, D, C,
E, F, G — are the restructure's stable identifiers; the numbers above predate them
and are kept for continuity.) The bound throughout is user-visible copy
only: types, tables, columns, and serde names keep their identifiers, because
renaming those is a migration wearing a rename's clothes.

Slice 2 cost the browser preview (`npm run dev:web`) its usefulness, knowingly.
It could only render a workspace by fabricating a repository, and it can never
reach the native picker to choose a real one, so it was already fake past the
first screen. Packaged QA replaces its purpose.

**Do not revive it with a dev-only seeded repository. Verified, not argued:**

```text
$ vitest run   # import.meta.env inside the suite
MODE=test DEV=true PROD=false
```

**`import.meta.env.DEV` is `true` under vitest.** A seed gated on it would be
live in **every test in the suite** — the vacuous-fixture trap re-armed, in the
one place this project has been caught six times, and pointed at the fixture
slice 2 deleted. #6 records that against the old `repo-workspace` fixture a "demo
records are unlinked" assertion was not merely vacuous but *wrong*. Any future
proposal here must state which flag it uses and prove that flag is false under
vitest, or it is this trap with a different name.

**The deeper reason, which survives a perfect flag.** #2 and slice 2 protected
*users* from invented state presented as real, and a build gate genuinely does
that. But when the preview exists so that an **agent** can see the UI it is
changing, the deceived party is the agent making the claims a human then relies
on. Dev-only does not remove the fabrication; it relocates it from the user to
the reviewer, which for that purpose is worse. And the case that makes it
self-defeating: the empty first-run state is what defeated the operator in the
packaged QA, so a build that can never be empty can never show the screen under
investigation. It is not a workaround for the trap — it is the trap, wearing a
build flag.

The accepted alternative is that a human looks and reports (option (c) in that
investigation). An agent may claim *structurally correct* and *copy-complete*,
both assertable against the rendered tree; it may never claim **polished**, which
is a judgment no screenshot confers. Granting macOS Screen Recording so an agent
can capture the packaged window stays available for a slice that genuinely turns
on something visual; it buys pixels, not judgment, and it was declined for the IA
restructure on that basis.

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

**RESOLVED — the demo provider now produces a real, applyable patch.** It returns
exactly one create-patch for `airlock-demo.md` at the repository root, three fixed
lines that say what the file is and that it is safe to delete, so apply,
post-apply verification, and rollback are reachable with no key and no network.
The entry below stands as the record of why that mattered; its first bullet
("Mock Provider … cannot reach the product's entire point") is **withdrawn**.

**Not the fabrication #2 and slice 2 removed, and the distinction is the whole
argument.** Those wrote demo rows into durable tables *on launch*, with no user
action and nothing marking them invented. This produces a patch only when a human
asks for a run, is labelled a demo everywhere it surfaces, writes a file that
explains itself in its own content, and is a **fixed fixture that never claims to
be model output**. Option 2 of the three below, taken on its own terms.

**Every byte proven against real git before the code existed**, in a disposable
repository: `git apply --check` accepts it, `git apply` creates the file,
delete-and-re-apply succeeds (so the demo survives its own rollback), and
applying while the file exists is refused rather than clobbering it.
`new file mode 100644` is **load-bearing** — without it git rejects the diff
("error: dev/null: No such file or directory"), because git will not read
`--- /dev/null` as a creation unless the mode line marks the file new. The brief
that specified this work enumerated the diff's parts and omitted that line; the
probe is what caught it. **See #18** — this is that pattern, third-party edition:
the spec modelled git's consumer by assumption and git disagreed.

**Two shipped sentences became false the moment it landed, and their tests stayed
green over the lie.** Slice G's distinction 4 ("Mock Provider is a demo that plans
only; applying and rolling back a patch needs a real provider such as OpenAI") and
the Provider Context prose ("Mock runs do not generate patch content") were both
true only while `supportsPatchGeneration` was `false`. A string assertion cannot
notice the world moving underneath it. Both corrected; a test now pins the old
claims *absent*. This is the clearest instance yet of this document's own warning
that green means nothing crashed — the copy tests were green and the app was
lying.

**Airlock cannot demonstrate its own core loop without a paid API key and an
unproven provider path.** Found while preparing the packaged click-through, and
recorded here rather than as a QA note because it is a product fact, not a
testing inconvenience.

The core loop is propose → approve → validate → apply → roll back. The apply half
requires a generated patch artifact, and there are exactly two producers:

- **Mock Provider** — declares `supportsPatchGeneration: false` and returns
  `patchArtifacts: []`. Every mock run persists candidate files at
  `not_generated`. The generation gate blocks; **Apply Patch** is unreachable.
  The default provider, the one that needs no key and no network, and the one the
  demo script leans on, **cannot reach the product's entire point**.
- **OpenAI** — can return review-only artifacts, but needs `OPENAI_API_KEY` in
  the packaged process environment, and the roadmap records that path as
  unproven. It has never produced an artifact that a human then applied.

The seeded demo artifact is not a third producer. Its proposal carries
`repositoryId: "repo-workspace"`, which no saved repository has matched since
slice 2 retired the fixture, so it fails the `repository` readiness gate; and its
targets are this project's own source files.

**This answers "why has apply never been clicked" — not scheduling, the path did
not exist.** The safety machinery is the engineering, and the only door to it is
the least-trusted, least-proven component, behind a paywall. Everything a
keyless evaluator can reach is the half the product is weakest at.

Three consequences for this item, none of them QA's to decide:

1. The demo story is upside down. `docs/demo-script.md` presents mock-provider
   planning as the walkthrough; the apply and rollback machinery — the part
   competitors lack — cannot be shown on that path at all.
2. Whatever "Mock Provider" is for, it is not for demonstrating Airlock. Either
   it gains a deterministic generated artifact scoped to the selected repository
   (a fixture, with #2's and slice 2's fabrication rules applying in full — it
   must be unmistakably a fixture and must not present as provider output), or
   the product states plainly that its core loop needs a real provider.
3. Positioning above understates the problem. It is not only that the product is
   *described* by its weakest part — without a key it *is* only its weakest part.

Deliberately not resolved here. Option 1 is a fabrication question that #2 and
slice 2 spent their whole argument on, and reaching for a fixture is how this
project has previously talked itself into presenting invented state as real.
That decision belongs to this item, not to a QA run that happened to surface it.

**A latent validator gap found alongside it, recorded so it is not
rediscovered.** Both the provider validator (`packages/ai/src/index.ts`) and
native structure validation (`lib.rs:952`) require the diff header to equal
`diff --git a/{path} b/{path}` literally. For a path containing a space, **git's
own generator emits the quoted form** (`diff --git "a/my file.md" "b/my file.md"`),
which those checks reject — while `git apply --check` was verified to accept both
forms. So a canonically-generated spaced-path diff is refused by Airlock and
would have applied cleanly. It fails closed, so it is a capability gap rather
than a safety hole, and the existing native test `ROLLBACK_MODIFY_DIFF` pins the
unquoted form as the supported convention. It matters now because it makes a
spaced-path OpenAI artifact a coin flip on how the model chooses to quote.

It is the third instance of one pattern, not a standalone quirk; **see #18**,
which was opened because of it and which found a fourth instance by asking what
the pattern predicts.

## Later

### #18 Git's textual interface is modelled by assumption, in four places

Three confirmed findings and one probe share a root cause, and the pattern is the
finding: **this code repeatedly hardcodes a belief about git's text where the
truth was one probe away.** Recorded as its own entry because three scattered
instances read as three bugs, and the fourth was found by asking what the pattern
predicts rather than by reading the code.

| # | Site | Belief | Reality | Direction |
| --- | --- | --- | --- | --- |
| F1 | `validate_generated_patch_structure` | one `diff --git` per file | git *applies* traditional sections with no `diff --git` header | **fail-open** — `.env` smuggled after the first hunk |
| #3 | `parse_porcelain_line` | git prints paths literally | git quotes and C-escapes spaces, non-ASCII, quotes, backslashes | fail-closed — false quarantine of a correct apply |
| new | provider + native structure validation | header is `diff --git a/{p} b/{p}` | git's generator **quotes** spaced paths; `git apply --check` accepts both forms | fail-closed — refuses a valid patch |
| probe | `parse_porcelain_line` rename split | ` -> ` separates old from new | a *filename* may contain ` -> `, and git quotes it | fail-closed — dropped status line |
| new | `validate_generated_patch_structure` + the demo-patch spec | `--- /dev/null` + `+++ b/{p}` is a create | git needs `new file mode 100644` or it reads `/dev/null` as a **literal path** and rejects | **fail-open** — validator says valid, `git apply` refuses |

**The fifth instance, found while unlocking the demo.** The native structure
validator accepts a create-diff with the mode line **stripped**; git rejects that
same diff outright. So the validator's model of a creation is broader than git's,
and passing it is **necessary but never sufficient** — a patch can clear every
structural gate and still fail at apply. It fails closed in practice only because
git itself refuses, which is luck rather than design: the gate is not the thing
catching it. Pinned by a native test that asserts *both* forms pass the validator,
so the disagreement is recorded rather than rediscovered. Direction matters here —
this is the second **fail-open** row after F1, and like F1 it comes from modelling
git's *consumer* too narrowly.

**Correction to the framing that prompted this entry.** It proposed one root
cause: "the code assumes a form git does not actually produce." That is exact for
#3 and the new finding — and **F1 is its mirror image.** F1's smuggled section is
a form git does *not* produce; the validator's error was assuming `git apply`
would therefore never *accept* it. The unifying statement is one level up:

> **What git emits and what git accepts are different sets, and neither matches
> the code's model of them.**

The direction matters, which is why collapsing the three loses information.
Modelling git's *generator* too narrowly fails **closed** — a false account, #3's
failure class, expensive in trust. Modelling git's *consumer* too narrowly fails
**open** — F1, a `.env` exfiltration. Same mistake, and only one of them writes a
secret. A sweep that only looks for #3's shape will not find the next F1.

#### The Fourth Instance, Probed Rather Than Reasoned About

`parse_porcelain_line` splits a rename on the first ` -> ` **before** unquoting,
so a filename containing that sequence splits inside its own quoted string.
Verified against real git rather than argued:

```text
$ git mv "a -> b.txt" renamed.txt && git status --porcelain=v1
R  "a -> b.txt" -> renamed.txt

split_once(" -> ")  ->  old = "\"a"   new = "b.txt\" -> renamed.txt"
```

Both halves fail `unquote_porcelain_path`, the line is dropped, F4's raw
line-count check sees the mismatch, and the repository quarantines or refuses
with `repository_state_unverifiable`. **Fail-closed and exotic — the value is not
the severity, it is that #3's own entry says "Renames were verified to parse
correctly and were not a defect."** That verification was real and it was run
against ordinary renames. Probing the common case and assuming the tail is the
same move that produced every row in the table above, and it survived inside the
commit that fixed the pattern's second instance.

The fix is ordering — unquote first, then split — but it is not worth a commit on
its own severity. It is worth one as the test case that pins the pattern.

#### Where To Look Next

Ordered by how confident the code sounds about git's text:

1. **`git status --porcelain=v1` → `--porcelain=v1 -z`.** The structural fix, not
   a patch: `-z` emits NUL-delimited **unquoted** paths, deleting the quoting
   problem, the C-escape problem, and the rename-delimiter problem at the source
   rather than parsing around them. Verified on the same tree that produces the
   table's first two rows:

   ```text
   --porcelain=v1        M "release notes.md"
                        R  "a -> b.txt" -> renamed.txt

   --porcelain=v1 -z     M release notes.md<NUL>R  renamed.txt<NUL>a -> b.txt<NUL>
   ```

   This retires #3's parser rather than extending it, and it changes a path that
   feeds the apply gate — which is why it is an entry, not a cleanup.

   **It also carries the pattern's own trap, which is why it is listed with the
   evidence rather than as an obvious win.** Under `-z` a rename emits **new path
   first, then old** — the reverse of `--porcelain=v1`'s `old -> new`. A
   migration that keeps the existing old-then-new assumption would silently swap
   every rename's paths: no parse error, no dropped line, no F4 count mismatch,
   just wrong evidence in a structure the apply gate trusts. That would be this
   entry's first **fail-open** instance since F1, introduced by the fix for the
   fail-closed ones. Whoever takes this must probe `-z`'s field order rather than
   assume it mirrors the form they are replacing — which is, exactly, the mistake
   this entry is about.
2. **Diff-header parsing wherever a path is read back out of `diff --git`.** The
   new finding is the *validation* half; anything that parses those headers
   inherits the same quoting assumption.
3. **`git rev-parse --short HEAD`** — already recorded under #12 as
   abbreviation-length scaling. Same class: a textual git output whose form was
   assumed stable and is not.
4. **`core.quotepath`, and any config that changes git's output form.** #3
   verified it is not a fix for the space case; the general hazard is that git's
   textual output is *configurable*, so any parser has an implicit dependency on
   the user's git config.

The rule this entry exists to state: **anywhere the code names an exact git
output string, there is an untested assumption until someone runs git and looks.**
Every instance above was found by running git, and none by reading the code.

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

**Slice 2 measured one corner of it, and #17 was not what fired.** Retiring the
mock repository fixture was expected to make `repositories[0]` live for the first
time and to own the crash that followed. It did neither, and the expectation was
a premise taken from this document rather than from the code. Empty
`repositories` was *already* reachable — hydration calls `setRepositories([])` on
the no-saved-repositories path, which is every fresh install — already guarded
(`?? repositories[0] ?? emptyRepository` resolves correctly at runtime precisely
because the index really is `undefined`), and already covered by three tests, one
asserting the heading "No repository selected". Measured rather than argued: with
the fixture emptied, **146 of 148 tests passed and nothing crashed**; both
failures were unrelated to nullability. The lie in `repositories[0]` is real and
the flag would still name that line — it simply was not load-bearing, because a
runtime fallback already stood behind it. Evidence for the noise-to-findings
ratio above, and against assuming any particular `[0]` is a bug.

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

**"Pending" was the wrong word for the apply half: it was blocked, and nobody
knew.** `docs/qa/disposable-repository-apply-qa.md` step 4 instructed the
operator to "Create a Mock Provider run that proposes one bounded text-file
change" — a run the mock provider has never been able to produce, since it
declares `supportsPatchGeneration: false` and returns no artifacts. The doc has
been wrong since it was written, and every reader took the missing click-through
for a scheduling gap. The step now names the OpenAI requirement; the product
finding sits under #11.

Corrected in the same pass: the doc's disposable repository contained only
`README.md`, so following it exactly could never exercise the spaced-path
coverage `rollback-v1-design.md` requires.

## Known Data Hazards

Surfaced during investigation; recorded so they are not rediscovered.

- **Dangling `agent_run_id`.** Seeded approvals were persisted but seeded agent
  runs never were — `saveAgentRunRecord` is only called from `startAgentRun`. The
  UI guards this (`?? "No linked run"`) and #2 pinned that guard with a test.
  Demo fixtures keep their runs in memory, so the link resolves today; the hazard
  is that nothing enforces the reference.
- ~~Hardcoded home path~~ and ~~a storage failure leaves the fabricated mock
  repository active, permanently~~ — both landed with #11 slice 2, which retired
  `createMockRepositories` rather than re-pathing it. Re-pathing would have
  hardcoded a fresh home directory: same hazard, new string.
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
  piecemeal. **Merging indexing into selection has since landed as #11 slice D**
  — done inside the IA restructure it was reserved for, not piecemeal, which is
  exactly the condition this entry set. **Demoting Repository Intelligence has
  since landed as #11 slice F** — the Repositories section headline stops reading
  "Repository Intelligence" (the phrase survives as a sub-panel label within the
  section), done inside the IA restructure it was reserved for rather than
  piecemeal, which is the condition this entry set for it too.
