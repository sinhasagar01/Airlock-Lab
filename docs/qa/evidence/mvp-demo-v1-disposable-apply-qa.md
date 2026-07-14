# MVP Demo v1 Disposable Apply QA Evidence

## Evidence Status

- Executed: 2026-07-15 04:00 IST
- Result: Automated safety matrix passed; packaged release launch passed
- Manual packaged UI click-through: Pending on a host with approved native UI
  automation or a human operator
- Product behavior changes: None
- QA coverage change: Added one durable quarantine-and-replay-blocking native
  fixture

This record covers the checklist in
`docs/qa/disposable-repository-apply-qa.md`. It distinguishes executed evidence
from interaction that could not be observed reliably in this environment. It
must not be read as a claim that the packaged UI was manually clicked through.

## Build Identity

| Field | Value |
| --- | --- |
| App version | `0.0.0` |
| Source commit | `0645ac6b67bf40feed6bec41e747678ec54d9cda` |
| Source state | `0645ac6-dirty` |
| Host | macOS 26.5.1 (`25F80`), Apple ARM64 |
| App binary SHA-256 | `69c435a578d7b3fcd597c1f8b2af653eae03545690e1b99513dcfbfde28321b8` |
| DMG SHA-256 | `ad299e1052b1d505a81b3a4ef812cfef508871124f0a5fc1c00f3b2dd8027e86` |
| App binary size | 20,083,232 bytes |
| DMG size | 7,182,122 bytes |

The source tree was intentionally dirty with the current safety-hardening work.
These hashes identify this exact QA build; they are not release-signing
identifiers.

## Isolation Evidence

A fresh disposable repository was created at a temporary path outside all user
projects. It contained only `README.md` and one baseline commit.

```text
Baseline HEAD: 250b57127eec6e9536832b014ae7db156ed34444
Status before: empty
Staged paths before: empty
Tracked tree: README.md
```

The packaged release binary was launched with `HOME` and
`CFFIXED_USER_HOME` pointed at a separate disposable home. It initialized:

```text
/private/tmp/adw-mvp-qa.wTaztk/isolated-home/Library/Application Support/
  com.aidev.workspace/workspace.db
```

The isolated database contained zero repositories and zero agent runs at
launch. The user's existing database retained its original size and modification
time (`155648` bytes, `2026-07-15T01:03:17+0530`). The isolated process was
terminated after the launch check. No user repository was selected.

After the packaged launch and automated matrix, the explicit disposable
baseline repository remained unchanged:

```text
HEAD after: 250b57127eec6e9536832b014ae7db156ed34444
Status after: empty
Staged paths after: empty
```

The native safety tests used additional newly created disposable repositories
and removed them after their assertions completed.

## Scenario Results

### 1. Happy Path Apply

**Result: Passed through the production native apply helper. Packaged UI
click-through remains pending.**

Executed test:

```text
tests::safe_apply_creates_backup_and_changes_only_the_expected_working_tree_file
1 passed; 0 failed
```

Verified by the disposable fixture:

- The approved single-file create patch was applied exactly once.
- The generated target contained the expected bytes.
- The pre-existing tracked `README.md` remained unchanged.
- A bounded backup record was persisted with the expected target path.
- The proposal became `applied` and the artifact/attempt became
  `applied_verified`.
- Post-apply verification observed only `generated.txt`.
- Git reported exactly one untracked changed path.
- The index remained empty.
- Baseline HEAD remained unchanged.
- Persisted post-apply verification contained the exact expected path.

The packaged binary itself launched and initialized isolated durable storage,
but native window interaction could not be driven or captured safely in this
environment. Repository selection, confirmation typing, visible backup ID, and
restart rendering therefore require the manual follow-up below.

### 2. Quarantine Path

**Result: Passed through deterministic native evidence injection and frontend
review-state verification.**

Executed native test:

```text
tests::post_apply_quarantine_persists_evidence_and_blocks_reapply
1 passed; 0 failed
```

The fixture first executes the real disposable happy-path apply, then supplies
an authoritative post-apply Git status containing the approved path plus an
unexpected path. It verifies:

- Verification returns `quarantine_required`.
- Attempt, proposal, and artifact quarantine state is durable in SQLite.
- Unexpected-path evidence is persisted.
- The pre-apply backup ID remains linked.
- A later lock acquisition is blocked with `unresolved_apply_attempt`.
- No automatic retry or rollback runs.
- No synthetic unexpected file is written by the fixture.

Executed frontend checks:

```text
App.test.tsx: quarantines an apply outcome when authoritative verification
  finds an unexpected path
App.test.tsx: shows reconciled interrupted attempts and keeps apply unavailable
2 passed; 0 failed
```

They verify **Post-Apply Quarantine**, **Manual inspection required**, the
unexpected path, backup evidence, and disabled **Apply unavailable** UI.

### 3. Interrupted And Reconciliation State

**Result: Passed.**

Executed command filter: `reconciliation_`

```text
4 passed; 0 failed
```

Covered outcomes:

- Clearly applied evidence repairs to `applied_verified` without reapply.
- An unchanged working tree becomes `failed` without a write.
- Incomplete evidence becomes `interrupted` without retry or rollback.
- Conflicting content becomes `needs_inspection` and remains byte-for-byte
  unchanged.

Every disposable fixture asserts no staged paths and no new commit.

### 4. Lock And Duplicate Apply

**Result: Passed through deterministic cross-process lock fixtures.**

Executed command filter: `repository_apply_lock`

```text
2 passed; 0 failed
```

Verified behavior:

- A second holder receives sanitized `apply_locked` while the first OS lock is
  active.
- Terminal release clears active durable lock state.
- An abandoned durable record becomes `stale` only after OS-lock reacquisition.
- An unresolved apply attempt blocks a later apply even after stale-lock
  recovery.

The fixture is deterministic and exercises the same app-local advisory lock and
SQLite ledger used by the packaged binary. A two-window visual reproduction was
not performed.

## Timeout Evidence

Executed command filter: `bounded_child_wait`.

```text
1 passed; 0 failed
```

The test terminated and reaped a child before its natural exit. The production
dry-run, reconciliation probes, and apply path retain the fixed 15-second
deadline. Timeout never authorizes retry, rollback, staging, or committing.

## Full Verification

The final repository-wide verification produced:

```text
npm run typecheck: passed
npm run lint: passed
npm run test: passed
  Desktop frontend: 68 passed
  Native Rust: 38 passed
  AI package: 15 passed
npm run build: passed
  Web production bundle: passed
  Rust release binary: passed
  macOS .app bundle: passed
  ARM64 DMG bundle: passed
```

No apply, rollback, staging, commit, reset, checkout, clean, or arbitrary Git
operation was run against a user repository during QA.

## Evidence Gaps And Manual Follow-Up

The following items are not claimed as executed evidence:

1. A human-driven end-to-end click-through in the packaged `.app` from
   repository picker through confirmation and restart rendering.
2. Screenshots of the packaged applied, quarantine, and interrupted states.
3. A visibly concurrent two-window packaged-app lock reproduction.

The environment could launch the isolated packaged process but could not safely
drive or capture its native window. Complete these three items on a recording
host using a fresh disposable repository, then append operator name, timestamp,
screenshots, attempt ID, and backup ID to this document. Do not reuse the
temporary paths or hashes above for a later build.

## Release Assessment

- Automated native safety evidence: **Pass**
- Frontend quarantine/interruption behavior: **Pass**
- Packaged build and isolated launch: **Pass**
- Full packaged UI manual sign-off: **Pending**
- Rollback readiness: **Out of scope and not implemented**

This build is suitable for the existing internal demo boundary with the noted
manual packaged-UI caveat. It is not evidence of production-ready autonomous
repository modification.
