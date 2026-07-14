# MVP Demo Script

## Demo Goal

Show the complete local-first review workflow without implying that provider
plan generation can generate patches, write files, or mutate Git state.

The recommended demo uses the packaged native app. The web preview is useful
for UI rehearsal, but repository picking, SQLite persistence, indexing, and Git
reads require the Tauri runtime.

## Pre-Demo Checklist

1. Launch the native `AI Developer Workspace.app` build.
2. Have one non-sensitive local Git repository ready to select.
3. Prefer a repository with indexed files. Use `Reindex repository` before the
   demo if Repository Intelligence reports zero files.
4. Decide whether to demonstrate a clean repository or an existing local
   change. Do not create or modify project files for the demo.
5. Keep Mock Provider selected for the deterministic demo. OpenAI is an optional
   plan-only path when the native process has `OPENAI_API_KEY` configured.
6. Confirm Settings shows cache clearing and reset as unavailable or guarded.
7. Use this task prompt:

   `Add a repository onboarding summary and validation plan`

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

The successful result follows the same persisted run, proposed-change, pending
approval, and `not_generated` patch-artifact workflow. If OpenAI is unavailable
or returns malformed output, show the error state and confirm that no partial
review records were created.

### 5. Inspect The Proposed Plan

In the selected Agent Run, walk through:

- Ordered implementation steps
- Expected affected files
- Risk summary
- Validation checks
- Generated patch artifact placeholders

Say: "Affected files are proposed scope. They are not proof that a file was
changed. Patch artifacts are a separate model and begin as `not generated`."

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
stored generated content as sample/demo data.

If no matching local diff exists, use the visible `No local diff yet` state. Do
not modify the repository to force a match.

### 8. Approve Or Reject

Choose either **Approve** or **Reject**. Confirm that the selected request and
linked proposed-change statuses update, the pending count decreases, and both
decision buttons become disabled.

Say: "This decision updates local review metadata only. It does not apply a
patch, write files, or execute a Git command."

### 9. Inspect Real Git State

Open **Changes** and select **Refresh Git status**.

If the repository is clean, show the clean state. If it already has local
changes, select a changed file and show its read-only diff.

Say: "Changes is the real repository state, loaded through fixed read-only Git
commands. It remains separate from proposed and generated artifacts."

### 10. Close With Guarded Maintenance

Open **Settings** and show the Mock Provider adapter status, local storage
status, reindex action, disabled cache clearing with explanation, and guarded
reset confirmation.

Say: "Maintenance actions stay unavailable until their app-local deletion
boundaries are implemented and tested. Repository files and Git state are never
targets of these controls."

## Recovery Notes

- **Repository picker does not open:** use the packaged native app, not the web
  preview.
- **Storage unavailable:** the web preview uses in-memory state. Switch to the
  native app for persistence.
- **Zero indexed files:** select the intended repository and run reindexing.
- **No affected files on a new run:** reindex first, then create another run.
- **No local Git diffs:** this is valid for a clean repository or non-matching
  proposed paths. Show the honest empty state.
- **No generated patch:** this is expected. The current mock flow creates
  artifact placeholders and never generates or applies patches.
- **Non-Git repository:** Repository Intelligence still shows indexed facts;
  Changes should report Git status as unavailable without attempting writes.

## Five-Minute Version

1. Show Repository Intelligence.
2. Start a mock run with the prepared prompt.
3. Inspect plan, proposed files, risks, and validation.
4. Open the linked approval.
5. Contrast generated artifact states with local Git diffs.
6. Approve or reject and show the updated pending count.
7. Close on Changes and guarded Settings maintenance.

## Demo Boundaries

Real today:

- Repository selection and saved repositories in Tauri
- Indexing and Repository Intelligence facts
- SQLite run, proposal, and approval persistence
- Read-only Git status and local diffs
- Approval/rejection metadata updates

Mock or sample today:

- Deterministic Mock Provider planning
- Seeded connected demo records
- Stored generated artifact preview content labeled as sample/demo

Optional real capability today:

- OpenAI structured plan generation when configured in the native process

Not implemented:

- Real patch generation
- Patch application or file writes
- Git staging, reset, checkout, commit, clean, or other mutation
