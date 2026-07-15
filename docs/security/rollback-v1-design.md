# Rollback v1 Design

## Status

- Status: **Implemented**
- Scope: User-initiated restore of one `applied_verified` patch artifact from its
  app-local pre-apply backup
- Roadmap item: #4
- Depends on: #3 (status-path parser) — landed; `git_output` timeout — landed
- Last updated: 2026-07-15

### Corrections Made During Implementation

Three decisions in this brief changed while it was being built. They are recorded
here with their reasoning, in place, rather than as an appendix — a later reader
must not have to reconstruct the argument.

1. **Post-restore verification does not require `staged_count == 0`.** It
   compares staged paths as a delta, like changed paths. See
   [Post-Restore Verification](#post-restore-verification). The original rule
   would have falsely quarantined a correct rollback.
2. **The proposal moves to `rolled_back` too**, not only the artifact. See
   [Terminal States](#terminal-states).
3. **`acquire_repository_apply_lock` takes an `operation`** rather than
   hardcoding `apply_patch`. See [Gate Ordering](#gate-ordering).

One further guard was added that this brief did not anticipate: the **native
apply guard had to learn `rolled_back`**. See
[The Apply Guard Must Refuse A Rolled-Back Artifact](#the-apply-guard-must-refuse-a-rolled-back-artifact).

This is an implementation brief. It records the reasoning, not only the
conclusions, because the reasoning is what stops a later reader from
"simplifying" a decision that looks arbitrary in the code. Read
[`patch-application-safety.md`](./patch-application-safety.md) first; every
invariant there still applies.

## Non-Negotiable Constraints

- Restore **only** from app-local backups. Never Git. No `reset`, `checkout`,
  `clean`, `add`, or `commit`.
- Native is authoritative. React passes durable IDs and a typed confirmation
  phrase only — never a path, never file bytes.
- Refuse on drift. Fail closed on anything undeterminable.
- Verify what was restored. Do not trust that the copy succeeded.
- Weaken no existing gate.

## The Load-Bearing Question: Can We Detect Drift?

The safety rule is "rollback must not overwrite user edits made after apply."
That requires knowing what the target looked like **immediately after apply**.

**We have that record.** After the write, `apply_approved_patch_artifact_under_lock`
calls `capture_repository_validation_snapshot` again over `relevant_file_paths`
— which includes the target — and persists it as `post_apply_evidence_json` on
the attempt row. That snapshot carries `target_file_fingerprints` with a
`content_sha256` of the file **as apply left it**. It also carries `branch` and
`head_sha` in the same object.

**But it is best-effort, and rollback's safety depends on it:**

```rust
let post_apply_snapshot = capture_repository_validation_snapshot(...).ok();   // None on failure
let _ = sqlx::query("UPDATE patch_apply_attempts SET ... post_apply_evidence_json = ? ...");  // fire-and-forget
```

An artifact can therefore be `applied_verified` with **no baseline at all**, and
apply still reports success. So:

- **Eligibility is per-artifact, not per-version.** There is nothing to migrate;
  load the baseline and decide per artifact.
- **Absent or incomplete baseline ⇒ refuse.** Not an edge case to paper over.
- Existing already-applied artifacts do have baselines wherever the capture and
  the persist both succeeded.

Follow-up task (not v1): apply must not be able to report success without
persisting a baseline. Fixing it inside v1 would change the apply path while
adding the first consumer that depends on it — two risks at once, on the
highest-risk task.

## Eligibility

| Outcome                   | Eligible | Why                                                                                     |
| ------------------------- | -------- | --------------------------------------------------------------------------------------- |
| `applied_verified`        | **Yes**  | The only state where expected == observed and exactly one path is known to have changed |
| `quarantine_required`     | No       | See below                                                                               |
| `interrupted`             | No       | Outcome unknown _by definition_ — incomplete evidence is what makes it interrupted      |
| `needs_inspection`        | No       | Evidence conflicts; restoring on contradictory evidence is not fail-closed              |
| `failed` / `apply_failed` | No       | Working tree unchanged — nothing to undo                                                |
| `inspected`               | No       | Its `acknowledged_from_status` was always one of the unresolved states                  |

### Why `quarantine_required` Is Excluded

A quarantined apply means paths were written that we cannot account for, and we
have **no backup for those paths**. Rollback could restore only the declared
target and could not undo the rest. Three reasons that is not acceptable in v1:

1. Quarantine means our account of what happened is **already known to be
   wrong**. Restoring on a model we have formally declared untrustworthy
   contradicts "fail closed on anything undeterminable."
2. A partial undo reported as "rolled back" is the false-account failure that
   #3 removed: the app telling the user something that is not true.
3. **The unexpected path may be the actual damage.** The worked example is the
   F1 smuggled-`.env` bypass: restoring the declared target undoes the harmless
   half and leaves the secret overwritten.

If this is ever revisited, the only honest shape is a distinctly labelled
**partial restore** naming exactly what it does not undo.

## Preconditions

Every one is required. Missing or unknown values are ineligible.

1. Artifact `applyStatus == applied_verified`.
2. Baseline present: `post_apply_evidence.repositorySnapshot` exists, with a
   `content_sha256` for the target and a `branch` and `head_sha`.
3. **No drift**: current target fingerprint == baseline fingerprint.
4. **HEAD and branch unchanged since apply.**
5. **Target not staged.**
6. Backup present and integrity-verified: `sha256(stored content) ==
stored contentSha256`.
7. Target path passes `validate_apply_target_boundary`.
8. Repository lock acquired; no unresolved attempt for the repository.

### Why 4 and 5 Are Not Special Cases

**HEAD/branch unchanged.** If the user committed the applied change, the apply
is now history. Writing pre-apply bytes is not an undo — it is a new
modification, and the post-restore expected-state model below collapses, because
restoring would make the file _differ_ from the new HEAD rather than match it.

**Target not staged.** Staging does not alter content, so the drift check passes
— but we never touch the index, and restoring under a staged entry leaves index
and working tree disagreeing. This falls out of the existing rule "we never
touch the index"; it is not a new policy.

### Deleted-Since Needs No Branch

If the target was deleted after apply, `fingerprint_target_file` returns
`missing` while the baseline holds `captured(X)` → mismatch → the **existing
drift rule refuses**. No extra branch, no special case. Fewest branches wins.

Refusing is also right on the merits: a deletion **is** a user edit, restoring
resurrects a file they deliberately removed, and we cannot distinguish "the user
deleted it" from "something else did" — undeterminable, so fail closed.

For a create-operation rollback the user has already done what rollback would
do. We still refuse rather than claim to have rolled anything back.

### Oversized And Non-UTF-8 Targets

`fingerprint_target_file` returns typed statuses — `too_large`
(`> MAX_FINGERPRINT_BYTES`, 256 KiB), `binary` (NUL or invalid UTF-8),
`forbidden`, `missing`, `unavailable`, `captured` — and **only `captured`
carries a `content_sha256`**.

Post-apply content is pre-apply plus the patch, so it can exceed the bound. That
case resolves **before** the pre-rollback backup is reached: the post-apply
snapshot recorded `too_large` with no hash → no baseline → refused by
precondition 2. A file that grew or became non-UTF-8 after apply fails the drift
check the same way.

So by the time the pre-rollback backup runs, the drift check has already
established the target is `captured`, within bounds, and valid UTF-8 — the case
is **structurally unreachable there**.

**Refuse explicitly anyway**, with its own reason (`rollback_backup_unavailable`
— "The current file cannot be backed up, so it will not be overwritten"). Never
truncate, never panic, never silently skip. Unreachable-by-construction is an
argument; a refusal is a guarantee.

## Write Ordering — And Why It Inverts Apply's

**This is the most losable decision in the design.** A reader comparing rollback
to apply will see an inconsistency and may "fix" it. Do not.

```text
apply:    backup insert -> attempt row -> write
rollback: attempt row (rolling_back) -> backup insert -> write
```

Apply can insert its backup first because that backup is the **pre-image it
restores from** — an orphaned apply-backup row is inert.

Rollback's backup records the bytes it is **about to destroy**, so the "we
started" marker must land first. If the backup were inserted first and the
process died, there would be a backup row with no attempt: invisible to
reconciliation, with a write about to begin and no durable record that it
started.

**Consequence, accepted deliberately:** a kill between the `rolling_back` insert
and the backup insert reconciles to `quarantine_required` even though nothing
was written. Over-quarantining there is correct; the alternative is a write with
no record that it began.

## Interrupted Rollback

Rollback is a write that can die mid-flight. Apply has a whole reconciliation
model for exactly this; rollback must not ship without one.

**Today, a new in-flight status would be invisible and non-blocking:**

- The reconciliation query selects `WHERE status IN ('pending', 'applying')` — a
  `rolling_back` row would never be seen, never classified, never resolved.
- The unresolved-attempt gate lists `pending, applying, interrupted,
needs_inspection, quarantine_required` — `rolling_back` is absent, so a dead
  rollback would not block a later apply either.

That is strictly worse than the #1 dead end: a state with no exit **and no
door** — an attempt stuck mid-write, the target in an unknown state, and the
repository still accepting applies as though nothing were pending.

**v1 therefore:**

1. Persists `rolling_back` before the write, as apply persists `applying`.
2. Adds `rolling_back` to the **reconciliation query** so it is seen.
3. Adds `rolling_back` to the **unresolved-attempt gate** so it blocks.
4. Classifies it **unconditionally to `quarantine_required`**.

### Why No Probe

`classify_unfinished_apply_attempt` probes with forward and reverse
`git apply --check` using the patch bytes. That says **nothing** about whether a
file restore completed. An interrupted rollback is undeterminable by definition:
we cannot distinguish "backup written, restore not started" from "restore
half-written." Rather than invent a probe whose evidence cannot be justified, v1
reconciles straight to quarantine — no probes, no retry, no re-restore.

The exit already exists: the `INSPECTED` acknowledgement clears the
repository-wide block while the artifact stays permanently ineligible.

## Gate Ordering

- **No self-block.** `acquire_repository_apply_lock` runs the unresolved-attempt
  gate, and rollback calls it **before** inserting its own `rolling_back` row.
  The gate cannot see a row that does not exist yet.
- **The lock records which operation held it.**
  `acquire_repository_apply_lock` hardcoded `operation = 'apply_patch'` in its
  durable audit row. Now that two destructive operations share the lock, it takes
  an `operation` parameter (`apply_patch` / `rollback_patch`). Misreporting a
  rollback as an apply in the audit trail is a small dishonesty, and the audit
  trail is the product.
- **A dead `rolling_back` does block.** Once in the gate's status list, an
  abandoned rollback blocks any subsequent apply _or_ rollback with
  `unresolved_apply_attempt` until reconciliation classifies it and a human
  clears it with `INSPECTED`.

Both behaviours are intended.

## Backup Storage: A Separate Table

The pre-rollback backup goes in a **new `patch_rollback_backups` table**, not
into `patch_apply_backups`.

**Reason, recorded verbatim because it is the point:** conflating the bytes we
restore from with the bytes we overwrote is how a recovery path destroys what it
is recovering. Reconciliation already reads `patch_apply_backups` scoped by four
IDs expecting apply semantics; an extra row there could be mistaken for the
pre-apply backup, which is the one thing rollback restores _from_.

Schema mirrors the apply backup and carries **its own `contentSha256`** over the
post-apply bytes: `id`, `rollback_attempt_id`, `proposed_change_id`,
`patch_artifact_id`, `repository_id`, `files_json`, `created_at`. Same bounded
256 KiB / UTF-8 mechanism, same atomic insert before the write, same app-local
location — never inside the selected repository.

## Post-Restore Verification

Apply required a clean tree, so the pre-apply content **was** HEAD's content.
Restoring it returns the path to clean: the path simply leaves `git status`.

| Operation | Filesystem                                             | Git status                |
| --------- | ------------------------------------------------------ | ------------------------- |
| modify    | target exists, `sha256(bytes) == backup.contentSha256` | target absent from status |
| create    | target does not exist                                  | target absent from status |

**The expectation is not "the tree is clean."** The user may have dirtied
unrelated files since apply, and over-refusing on those would be wrong. The
checkable form mirrors `verify_post_apply_changed_paths`:

```text
observed_changed_paths == pre_restore_changed_paths - {target}
observed_staged_paths  == pre_restore_staged_paths
HEAD unchanged across the restore
```

Any mismatch ⇒ **`quarantine_required`**, artifact permanently ineligible.

### Why The Staged Check Is A Delta And Not `staged_count == 0`

**This brief originally specified `staged_count == 0`. That was wrong, and it is
worth knowing why, because the wrong version looks stricter and therefore safer.**

Precondition 5 requires only that *the target* is unstaged. `staged_count` is
repository-wide. So: the user applies a patch, stages an unrelated file of their
own, then rolls back. Every precondition passes, the restore succeeds, and the
result is fully provable — and `staged_count == 0` fails it, producing permanent
`quarantine_required` plus a repository-wide block on a repository where nothing
went wrong.

That is a **false account** — the app telling the user something untrue — which
is the exact failure class #3 was landed to remove. Over-refusing is not
automatically the safe direction: a refusal that misdescribes reality costs the
same trust as a permission that misdescribes it.

The argument against it is already in the paragraph above, written for changed
paths: "the user may have dirtied unrelated files since apply, and over-refusing
on those would be wrong." Staging is the same act with the same reasoning. The
delta form completes the thought rather than weakening it.

**This still proves the target did not become staged**, which is the thing the
check exists for: precondition 5 guarantees the target is absent from
`pre_restore_staged_paths`, so requiring the staged set to be *unchanged* means
the target cannot appear in it afterwards.

Covered by `rollback_tolerates_unrelated_dirty_and_staged_files`, which was
verified to fail — returning `quarantine_required` instead of `rolled_back` —
when the check is reverted to `staged_count == 0`.

## TOCTOU Bound

The drift check reads and hashes, then writes. **A concurrent editor can change
the file in between.** We hold the repository-scoped app lock, which excludes our
own processes but not the user's editor. Same class as the fingerprint window
recorded under roadmap #12.

v1 **does not close this window.** It hashes immediately before the write to
narrow it, and verifies after — so a concurrent edit is **detected and
quarantined**, not prevented. The edit can still be lost. This is a stated
bound, not an assumption.

## Native Contract

```ts
type RollbackAppliedPatchRequest = {
  repositoryId: string;
  proposedChangeId: string;
  patchArtifactId: string;
  confirmationPhrase: "ROLL BACK";
};
```

No path, no bytes, no Git arguments. Native reloads every durable record and
re-derives every check.

### Refusal List

`not_applied_verified`, `baseline_unavailable`, `target_drifted`,
`target_missing`, `head_changed`, `branch_changed`, `target_staged`,
`backup_unavailable`, `backup_corrupt`, `rollback_backup_unavailable`,
`outside_repository`, `apply_locked`, `unresolved_apply_attempt`,
`confirmation_required`, `storage_unavailable`.

Added during implementation, because a code that is not on this list is a
deviation and must be recorded rather than smuggled in:

- `repository_state_unverifiable` — the current `git status` could not be read as
  a complete, representable set of paths (a dropped status line, or a path that
  cannot be safely compared). An observed set we cannot trust before the write is
  one we cannot verify against after it, so this refuses rather than proceeding.
- `repository_unavailable`, `proposal_not_found`, `artifact_not_found`,
  `file_link_missing`, `link_mismatch`, `invalid_identifier`,
  `invalid_persisted_record`, `forbidden_path`, `parent_unavailable` — shared
  with the apply path, reached through the same record-loading and
  path-boundary code.
- `rollback_state_persistence_failed` — the restore ran and its final durable
  state could not be saved. Distinct from every code above: those all mean
  nothing was written.

The apply path additionally gained `already_rolled_back` and
`rollback_in_progress`; see
[The Apply Guard Must Refuse A Rolled-Back Artifact](#the-apply-guard-must-refuse-a-rolled-back-artifact).

### Sequence

```text
acquire lock -> preflight -> drift check
  -> INSERT attempt (rolling_back)
  -> INSERT patch_rollback_backups
  -> write
  -> verify
  -> rolled_back | quarantine_required
```

## Terminal States

`rolled_back` is new, on the artifact, the attempt, **and the proposal**. The
artifact becomes **permanently ineligible**; re-applying requires a fresh
proposal and validation cycle. Reopening it would reintroduce replay, which every
existing gate exists to prevent.

### Why The Proposal Moves Too

This brief originally defined `rolled_back` on the artifact and the attempt only,
and was silent on `PersistedProposedChange.status`. Apply sets that to `applied`.
Leaving it there after the change was undone would render a rolled-back proposal
as **applied** in Changes and both review surfaces — a lie on the product's most
honest surface, and the same defect class as the Overview/Changes disagreement
#2 fixed.

So the proposal moves to `rolled_back` in the same write as the artifact.

Its tone is **neutral**, deliberately: nothing went wrong and nothing is pending.
The change was applied and then intentionally undone, which is a completed
outcome rather than a success or a failure. `success` would repeat the `applied`
claim the rollback disproved; `danger` would invent a problem that does not
exist. In `proposedChangeStatusTone` this falls out of the default rather than
needing a branch — an explicit `if` there was verified to be dead code and was
removed. The behaviour is pinned by a test instead.

### The Apply Guard Must Refuse A Rolled-Back Artifact

**Not anticipated by this brief, and the most dangerous thing found while
implementing it.**

The native apply guard *enumerates blocked statuses* rather than allow-listing
eligible ones: it refused `applying`/`applied`/`applied_verified` and the
unresolved trio. A status it had never heard of fell through every arm and
reached the write.

So on arrival, an artifact with `applyStatus: "rolled_back"` **applied
successfully** and returned `applied_verified`. Verified by test before the fix.

This is F7's shape exactly — adding an exit without a native guard made an
ineligible artifact re-appliable — and it is why the native and UI commits land
together. The UI is not what stops the second write. Two arms were added:

- `already_rolled_back` — terminal; needs a fresh proposal and validation cycle.
- `rollback_in_progress` — an in-flight rollback refuses a concurrent apply.

The enumerate-don't-allow-list shape remains. It is worth revisiting the next
time a status is added; the guard should probably invert.

**A second rollback is blocked twice over:** the artifact status refuses it, and
the drift check independently refuses — after a rollback the file matches the
pre-apply content, not the post-apply baseline.

`rolled_back` and rollback-flavoured `quarantine_required` cross `packages/ai`,
the native enum, and the UI, so the native and UI commits must land together: a
rolled-back artifact must never render with an unmapped status.

## UX Contract

Eligibility — **and ineligibility, with the reason** — is shown where the
artifact is displayed, before any action. An artifact with no baseline can never
be rolled back; the user must learn that from the surface, not by clicking. A
button that exists only to refuse is dishonesty in a smaller box.

Confirmation copy is operation-specific. The two acts are different and must not
share one sentence.

**modify:**

> **Roll back this patch?**
> This restores `src/foo.ts` to its pre-apply contents, overwriting what is on
> disk now.
> It changes working-tree files only. It does not stage, commit, or touch Git
> history, and it cannot be undone from here.
> Type `ROLL BACK` to confirm.

**create:**

> **Roll back this patch?**
> This deletes `src/foo.ts`. The file did not exist before the apply, so there
> are no previous contents to restore.
> It changes working-tree files only. It does not stage, commit, or touch Git
> history, and it cannot be undone from here.
> Type `ROLL BACK` to confirm.

## Required Test Coverage

Tests first, each seen failing for the right reason. Anything green on arrival is
proven able to fail by neutralising the guard it claims to test.

- Drift refusal (edit after apply).
- Deleted-since refusal.
- Missing-baseline refusal.
- Staged-target refusal.
- HEAD-moved and branch-moved refusal.
- Backup-integrity refusal (corrupt stored content).
- Restore verification: content hash matches after the write.
- Create-operation rollback deletes the file.
- Double-rollback refusal.
- Lock contention.
- Interrupted rollback reconciles to `quarantine_required`.
- End-to-end disposable-repository rollback, **including a spaced filename** —
  this is where #3's parser is load-bearing.
