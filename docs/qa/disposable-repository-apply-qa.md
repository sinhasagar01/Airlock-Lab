# Disposable Repository Safe-Apply QA

## Purpose

This checklist verifies Safe Patch Application v1 and interrupted-attempt
reconciliation without risking a real project. Run it only against a newly
created disposable Git repository containing no secrets, credentials, private
keys, or valuable uncommitted work.

The product may apply one approved generated patch artifact. It must not stage,
commit, reset, check out, clean, retry an interrupted patch, or roll back files.

## Required Build

- Use the packaged `.app` produced by `npm run build` for the manual pass.
- Run the native automated interruption matrix with:

  ```bash
  cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml reconciliation_
  ```

- Record the app version, commit SHA, macOS version, and test date.
- Do not point the app at an existing development or personal repository.

## Create The Disposable Repository

```bash
tmp_repo="$(mktemp -d)/adw-safe-apply-qa"
mkdir -p "$tmp_repo"
cd "$tmp_repo"
git init
git config user.name "ADW QA"
git config user.email "adw-qa@example.invalid"
printf 'Disposable repository only.\n' > README.md
git add README.md
git commit -m "Disposable QA baseline"
git rev-parse HEAD
git status --short
git diff --cached --name-only
```

Expected baseline:

- `git rev-parse HEAD` returns one baseline commit.
- `git status --short` is empty.
- `git diff --cached --name-only` is empty.

Keep the baseline HEAD value for every comparison below.

## Packaged Happy-Path Check

1. Launch the packaged app.
2. Select only the disposable repository.
3. Index it and confirm Repository Intelligence names the expected repository.
4. Create a Mock Provider run that proposes one bounded text-file change.
5. Review and approve the linked approval request.
6. Run validation and dry-run.
7. Confirm every Apply Readiness gate passes.
8. Select **Apply Patch**, type `APPLY PATCH`, and confirm once.
9. Verify the artifact reports `applied` and shows a backup ID.
10. Open Changes and confirm the expected single working-tree change appears.
11. Quit and relaunch the packaged app. Confirm the applied state persists.

Capture these terminal results after application:

```bash
git status --short
git diff --cached --name-only
git rev-parse HEAD
```

Pass criteria:

- Only the expected target path appears in `git status --short`.
- `git diff --cached --name-only` remains empty.
- HEAD exactly matches the baseline commit.
- No second confirmation or automatic retry occurs after relaunch.
- The app does not claim that approval staged or committed the change.

## Interrupted-Attempt Matrix

Process termination during the very short `git apply` window is not a reliable
manual test. The native suite deterministically creates the same durable states
in disposable repositories and then runs the production reconciliation helper.

Verify all four tests pass:

- `reconciliation_repairs_clearly_applied_disposable_repository_attempt`
  - Expected target content exists exactly once.
  - Attempt and artifact are repaired to `applied`.
  - No patch is re-applied.
- `reconciliation_marks_untouched_disposable_repository_attempt_failed`
  - Working tree still matches pre-apply evidence.
  - Attempt becomes `failed`; artifact becomes `apply_failed`.
  - No file is written during reconciliation.
- `reconciliation_marks_incomplete_evidence_interrupted_without_retry`
  - Missing backup or pre-apply evidence becomes `interrupted`.
  - UI requires manual inspection.
  - No apply or rollback command runs.
- `reconciliation_defaults_ambiguous_disposable_repository_to_manual_inspection`
  - Conflicting target content remains byte-for-byte unchanged.
  - Attempt and artifact become `needs_inspection`.
  - Apply remains unavailable.

For every case, verify:

```bash
git diff --cached --name-only
git rev-parse HEAD
```

The index must remain empty and HEAD must remain unchanged.

## Cross-Process Lock Check

1. Launch two packaged app processes against the same disposable repository.
2. Prepare one eligible approved artifact in the first process.
3. Keep the first native apply request active using an instrumented test build
   or the native lock test fixture.
4. Attempt application from the second process or another review surface.
5. Confirm the second request reports that another patch operation is active.
6. Confirm only one active `patch_apply_locks` record exists for the repository.
7. Let the first request finish and confirm its durable lock becomes
   `released`.

Crash/stale-lock variant:

1. Terminate the instrumented holder after it records an active lock.
2. Restart the app and run reconciliation.
3. Confirm the abandoned durable lock becomes `stale` after the OS lock is
   reacquired.
4. Confirm any unfinished attempt is reconciled before another apply is
   allowed.
5. Confirm stale-lock recovery does not apply or reapply a patch.

The automated equivalents are:

```bash
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml repository_apply_lock
```

## Git Timeout Check

Run the bounded child-process test:

```bash
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml bounded_child_wait
```

Pass criteria:

- The child exceeds the test deadline and is killed and reaped.
- The test completes well before the child command's natural exit.
- Production dry-run and apply commands retain their fixed 15-second deadline.
- A dry-run timeout reports a sanitized failure without creating an apply
  attempt.
- An in-flight apply timeout preserves its backup, becomes `interrupted`, and
  requires manual inspection.
- No timeout path retries, rolls back, stages, commits, resets, checks out, or
  cleans.

## Restart And Review Check

For a test database containing an unresolved attempt:

1. Start the native app.
2. Confirm startup reconciliation classifies `pending` or `applying` attempts.
3. Open Agent Runs and Approval Review.
4. Confirm the same latest attempt is visible in both surfaces.
5. Confirm attempt ID, backup ID when available, and Git-state comparison appear.
6. Confirm **Manual inspection required** appears for `interrupted` and
   `needs_inspection`.
7. Confirm **Apply unavailable** remains disabled.
8. Restart again and confirm reconciliation does not retry the patch or change
   the terminal classification.

## Negative Safety Checks

- Browser/Vite preview cannot apply or reconcile native records.
- Apply lock files live in app-local data, never inside the selected repository.
- A live repository lock blocks concurrent apply and reconciliation rather than
  misclassifying an active attempt.
- A stale durable lock never grants permission to bypass an unresolved attempt.
- A missing backup produces `interrupted`; it never falls through to apply.
- Mismatched artifact digest or malformed durable records produce
  `needs_inspection`.
- Unexpected repository, branch, HEAD, fingerprint, or Git-status evidence is
  treated as ambiguous.
- The successful fixture persists `applied_verified` only when the artifact,
  proposal, parsed patch, backup, fingerprint, and Git changed paths all equal
  the one approved path.
- Native verifier fixtures with an additional changed path, a staged path, or
  mismatched path evidence persist `quarantine_required`; Agent Runs and
  Approval Review show manual-inspection guidance and keep Apply disabled.
- No raw Git stderr, repository file contents, backup contents, or secrets are
  displayed in recovery diagnostics.
- There is no rollback, retry, stage, commit, reset, checkout, or clean action.

## Evidence To Retain

- App build/commit identifier.
- Disposable repository baseline HEAD.
- Before/after `git status --short`.
- Before/after `git diff --cached --name-only`.
- After-apply HEAD.
- Screenshots of applied and manual-inspection states.
- Full test command results.
- Any attempt ID and backup ID involved in a failure.

Delete the disposable repository after the QA evidence is collected.
