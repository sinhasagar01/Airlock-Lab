# MVP Demo Script

## Demo Goal

Show the complete local-first review workflow without implying that generated
patch artifacts are applied, that approval writes files, or that Git state is
mutated.

The recommended demo uses the packaged native app. The web preview is useful
for UI rehearsal, but repository picking, SQLite persistence, indexing, and Git
reads require the Tauri runtime.

## Recording Profile

- Target length: 8 to 10 minutes; use the five-minute version for a short clip.
- Capture: Native application window at 1440 x 900 or larger.
- Repository: A disposable, non-sensitive local Git repository with no secrets.
- Provider: Mock Provider for the required deterministic path; OpenAI is an
  optional second take.
- Audio: Narrate product intent and safety boundaries, not implementation code.
- Privacy: Hide terminal history, API keys, unrelated local paths, notifications,
  and other applications before recording.
- Cursor: Pause briefly over status pills, artifact states, fingerprints, and
  disabled controls so the evidence is readable in the recording.

## Pre-Demo Checklist

1. Launch the native `AI Developer Workspace.app` build.
2. Have one non-sensitive local Git repository ready to select.
3. Prefer a repository with indexed files. Use `Reindex repository` before the
   demo if Repository Intelligence reports zero files.
4. Decide whether to demonstrate a clean repository or an existing local
   change. Do not create or modify project files for the demo.
5. Keep Mock Provider selected for the deterministic planning demo. OpenAI is
   the optional path for real plan and review-only patch artifact generation
   when the native process has `OPENAI_API_KEY` configured.
6. Confirm Settings shows cache clearing and reset as unavailable or guarded.
7. Use this task prompt:

   `Add a repository onboarding summary and validation plan`

8. Run the release checks before the recording session:

   ```bash
   npm run typecheck
   npm run lint
   npm run test
   npm run build
   git diff --check
   ```

9. Confirm the app contains no API key, secret value, or sensitive repository
   path in visible diagnostics.
10. Record one uninterrupted Mock Provider take before attempting the optional
    OpenAI variant.

## Recorded Demo Run Sheet

| Time | Scene           | Required proof                                        |
| ---- | --------------- | ----------------------------------------------------- |
| 0:00 | Overview        | Local-first positioning and review-only boundary      |
| 0:40 | Repositories    | Native selection, indexing, and intelligence          |
| 1:45 | Agent Runs      | User prompt, provider choice, persisted plan          |
| 3:15 | Patch artifacts | Generated state, preview, digest, and validation      |
| 4:30 | Apply Readiness | Fingerprints, snapshot digest, staleness, gated Apply |
| 5:45 | Approvals       | Linked evidence and approve/reject decision           |
| 6:30 | Safe Apply      | Typed confirmation, backup, no-stage/no-commit result |
| 7:15 | Changes         | Separate real local Git status and diff               |
| 8:00 | Settings        | Provider diagnostic and guarded maintenance           |
| 8:45 | Restart         | Durable validation, approval, and applied state       |

Do not cut from approval directly to a changed working tree. Show the separate
typed-confirmation action so approval is never mistaken for application.

## Full Walkthrough

### 1. Open The Workspace

Start on **Overview**.

Say: "This is a local-first engineering workspace. Repository reads stay
bounded to a selected local repository, and human approval is required before
future write-capable work."

Point out the Mock Provider status, pending approval count, Active Work, and
Quick Start.

### 2. Select And Index A Repository

Open **Repositories** and choose a repository if one is not already saved.
Select **Reindex repository** and wait for the completed state.

Say: "The repository picker establishes the allowed root. Indexing derives
file facts inside that root; it does not modify repository files."

If the repository is already indexed, show its last indexed time before
optionally reindexing.

### 3. Show Repository Intelligence

On **Repository Intelligence**, show:

- Repository path and branch
- Git repository and open-change state
- Indexed file count and top extensions
- Important folders and key docs/config files
- Framework hints when safely derivable

Say: "This is factual repository context derived from metadata and indexed
paths. It is not AI-authored analysis."

Select **Start mock agent run**.

### 4. Create A Mock Agent Run

Enter the prepared task prompt and select **Run mock agent**. Wait for the
success message and the new selected run.

Say: "The deterministic mock provider creates a review-only planning record.
It does not call an external model, generate a patch, or write files."

Confirm the run shows the submitted task, Mock Provider and
`mock-planner-v1`, selected repository and branch, waiting-for-approval status,
and linked proposal and approval.

### Optional OpenAI Planning Variant

For a provider-backed rehearsal, launch the native app with `OPENAI_API_KEY`,
choose **OpenAI** in the Agent Run composer, and submit the same task. Explain
that only the displayed repository summary is sent: repository name, branch,
indexed count, key files, project folders, extension counts, Git summary, and
the task. Full file contents and secret/environment files are not sent.

The successful result follows the same persisted run, proposed-change, and
pending-approval workflow. OpenAI may attach generated, unavailable, failed,
binary, or too-large review-only artifact states; missing artifacts remain
`not_generated`. Generated artifacts are persisted review data and are never
applied by this workflow. If OpenAI is unavailable or returns malformed output,
show the error state and confirm that no partial review records were created.

Before this variant, open **Settings**, locate **Provider adapters**, and select
**Test connection**. Show the configured model and sanitized result. Explain
that the test verifies credential/model access through the native process
without sending repository context or exposing the API key to the UI. If the
button is disabled, restart the native app with `OPENAI_API_KEY` configured.

### 5. Inspect The Proposed Plan

In the selected Agent Run, walk through:

- Ordered implementation steps
- Expected affected files
- Risk summary
- Validation checks
- Generated patch artifact review states
- Persisted structure and dry-run validation status

Say: "Affected files are proposed scope. They are not proof that a file was
changed. Patch artifacts are provider proposals, not local Git state. Applied
state is shown only after the separate native action succeeds."

For a generated text artifact, select **Validate & dry-run**. Explain that the
app first validates the bounded single-file diff, then uses read-only
`git apply --check` in the selected repository. A pass means “potentially
applicable now,” not “approved” or “applied.”

Show **Apply Readiness** and walk through passed, blocked, not-checked, and
unavailable gates. Point out the artifact digest, validation snapshot, and
repository-state comparison. The SHA-256 digest binds validation to the exact
normalized patch text, while the snapshot records branch, short HEAD, clean
state, changed-file count, relevant paths, bounded target-file fingerprints,
and capture time without storing file contents. Existing safe text targets get
content hashes; missing, binary, oversized, forbidden, or unavailable targets
show typed states. Explain that **Apply unavailable** remains disabled until
every gate passes.

If the digest or repository state changes, show the blocked copy and explain:
"Stale review evidence must be revalidated. The native command will refuse the
patch." The current native snapshot digest is recomputed for comparison, while
capture timestamps are excluded from that digest. Missing authoritative native
evidence stays explicitly unavailable rather than being treated as a pass.

The seeded generated sample always demonstrates structure validation. Native
dry-run proceeds only when the selected repository is the proposal's linked
repository. Otherwise the UI keeps the `valid structure` result and explains
that the linked repository must be selected. Do not bypass this safety check.

If no affected files appear, explain that the selected repository has no
indexed file facts in the current session and reindex before repeating the run.

### 6. Review The Approval

Select **Review approval** and show the linked Agent Run, proposed-change
status, repository and risk context, proposed files, plan, risks, and
validation checks.

Say: "The approval request is a durable human decision record linked to this
run and proposal."

### 7. Separate Artifacts From Local Diffs

In Approval Review, compare the two sections:

- **Generated Patch Artifacts**: future or stored agent-generated patch records
- **Local repository diffs**: current read-only Git state for matching paths

Say: "These are intentionally separate. A local Git diff is never presented as
agent-generated output. The mock run does not create repository changes."

For the seeded demo approval, select artifact rows to show `not generated`,
`generated` sample/demo, `failed`, and `unavailable` states. Clearly identify
stored generated content as sample/demo data. Confirm the validation result
shown in Agent Runs also appears in Approval Review.

If no matching local diff exists, use the visible `No local diff yet` state. Do
not modify the repository to force a match.

### 8. Approve Or Reject

Choose either **Approve** or **Reject**. Confirm that the selected request and
linked proposed-change statuses update, the linked Agent Run is completed, the
pending count decreases, and both decision buttons become disabled.

Say: "This decision updates local review metadata only. It does not itself
apply a patch, write files, or execute a Git command."

Revisit Apply Readiness after the decision. Approval clears one gate, but every
other gate and explicit confirmation remain mandatory.

### 9. Apply One Eligible Artifact

Use only the prepared disposable repository. Confirm the working tree is clean,
the selected artifact is generated, validation and dry-run passed, digest and
snapshot evidence match, and the linked approval is approved.

Select **Apply Patch**. Read the warning aloud, type `APPLY PATCH`, and confirm.
Show the loading and success state. Explain that the native command reloads the
durable IDs, repeats all checks, persists a bounded pre-apply backup, and passes
only the stored patch to fixed `git apply --whitespace=nowarn -` over stdin.

Say: "This changed one working-tree file. It did not stage or commit anything.
Approval and dry-run did not perform the write; this separately confirmed native
action did."

If no artifact is eligible, do not weaken a gate. Show **Apply unavailable** and
record the blocking reason instead.

### 10. Inspect Real Git State

Open **Changes** and select **Refresh Git status**.

If the repository is clean, show the clean state. If it already has local
changes, select a changed file and show its read-only diff.

Say: "Changes is the real repository state, loaded through fixed read-only Git
commands. It remains separate from proposed and generated artifacts."

Confirm the applied file appears as an unstaged or untracked change and inspect
its local diff separately from the generated patch artifact.

### 11. Close With Guarded Maintenance

Open **Settings** and show the Mock Provider adapter status, local storage
status, reindex action, disabled cache clearing with explanation, and guarded
reset confirmation.

Say: "Maintenance actions stay unavailable until their app-local deletion
boundaries are implemented and tested. Repository files and Git state are never
targets of these controls."

### 12. Restart And Confirm Persistence

Quit and reopen the native app. Confirm that the selected repository, indexed
facts, created Agent Run, linked proposal, approval decision, artifact
validation result, backup reference, and applied state reload. Reopen Agent Runs
and Approval Review to show the same state on both surfaces.

Say: "Runs, proposals, approvals, validation, and application results are
durable local records. Restarting does not repeat the application."

If the prepared demo database contains an interrupted attempt, show **Manual
inspection required** in Agent Runs and Approval Review. Point out the attempt
and backup IDs, confirm **Apply unavailable** remains disabled, and explain that
reconciliation classified evidence without retrying or rolling back the patch.

If a quarantine fixture is present, show **Post-Apply Quarantine** and compare
the expected, observed, unexpected, and missing path lists. Explain that Git
may have exited successfully, but the native exact-path verifier refused to
classify the outcome as safely applied. The backup remains available, Apply is
disabled, and no automatic retry or rollback occurs.

## Recovery Notes

- **Repository picker does not open:** use the packaged native app, not the web
  preview.
- **Storage unavailable:** the web preview uses in-memory state. Switch to the
  native app for persistence.
- **Zero indexed files:** select the intended repository and run reindexing.
- **No affected files on a new run:** reindex first, then create another run.
- **No local Git diffs:** this is valid for a clean repository or non-matching
  proposed paths. Show the honest empty state.
- **No generated patch:** this is expected for Mock Provider. OpenAI can return
  generated artifacts when configured; application remains a separate reviewed
  native action.
- **Dry-run unavailable after structure validation:** select the proposal's
  linked repository. The app intentionally refuses to dry-run an artifact
  against a different saved repository.
- **Another patch operation is active:** wait for the first native request to
  finish. The app-local repository lock prevents concurrent application across
  windows and processes; do not bypass it.
- **Git operation timed out:** explain that the fixed child was terminated at
  15 seconds. A dry-run timeout writes nothing; an in-flight apply timeout
  preserves its backup and requires manual inspection without retry or
  rollback.
- **Post-apply quarantine:** inspect the expected and observed path evidence in
  Agent Runs or Approval Review, then inspect read-only Git status and diffs.
  Do not retry Apply; quarantine intentionally has no automatic repair action.
- **Non-Git repository:** Repository Intelligence still shows indexed facts;
  Changes should report Git status as unavailable without attempting writes.

## Five-Minute Version

1. Show Repository Intelligence.
2. Start a mock run with the prepared prompt.
3. Inspect plan, proposed files, risks, and artifact validation.
4. Open the linked approval.
5. Contrast generated artifact states with local Git diffs.
6. Approve, satisfy readiness, and apply one artifact in a disposable repo.
7. Show the unstaged result in Changes, then restart to confirm persistence.

## Demo Boundaries

Real today:

- Repository selection and saved repositories in Tauri
- Indexing and Repository Intelligence facts
- SQLite run, proposal, and approval persistence
- Persisted generated artifact validation and read-only `git apply --check`
- Artifact digests, bounded native target fingerprints, repository snapshot
  digests, and staleness comparison
- Native-authoritative Apply Readiness gates and typed confirmation
- One persisted single-file artifact application with a pre-apply backup
- Read-only Git status and local diffs
- Approval/rejection metadata updates

Mock or sample today:

- Deterministic Mock Provider planning
- Seeded connected demo records
- Stored generated artifact preview content labeled as sample/demo

Optional real capability today:

- OpenAI structured plan and review-only patch artifact generation when
  configured in the native process

Not implemented:

- Automated rollback
- Multi-artifact transactional application
- Git staging, reset, checkout, commit, clean, or other mutation beyond the
  single approved patch application

## Post-Recording Checklist

1. Verify the recording never displays a credential or sensitive local file.
2. Confirm generated artifacts and local Git diffs were described separately.
3. Confirm the narration states that approval and dry-run do not apply patches.
4. Confirm typed `APPLY PATCH`, backup creation, and no-stage/no-commit copy are
   visible.
5. Confirm the recording shows the persisted applied state after restart.
6. Record the build date, platform, and provider path in the published caption.
7. Link `docs/release-notes/mvp-demo-v1.md` from the recording description.
8. Complete and retain the evidence in
   `docs/qa/disposable-repository-apply-qa.md` for the recorded build.
