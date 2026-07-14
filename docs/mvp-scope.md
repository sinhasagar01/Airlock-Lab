# MVP Demo v1 Scope

## Status

- Checkpoint: MVP Demo v1
- Date: 2026-07-15
- Audience: Internal product, engineering, and safety review
- Runtime: Native Tauri desktop application on macOS
- Application state: Review-only patch workflow; patch application unavailable

## Product Thesis

The MVP demonstrates that an AI-native engineering workspace can safely help a
developer understand a local repository, request an implementation plan,
inspect proposed patch artifacts, compare them with current Git state, and make
a durable human approval decision without allowing the AI workflow to write to
the repository.

## End-To-End Workflow

```text
Select local repository
  -> index repository
  -> inspect Repository Intelligence
  -> start Agent Run
  -> generate structured plan
  -> persist Proposed Change and Approval Request
  -> inspect generated patch artifacts
  -> validate patch structure
  -> run read-only applicability check
  -> inspect digest, fingerprint, and staleness evidence
  -> compare matching local Git diffs
  -> approve or reject
```

The workflow ends at a review decision. No action applies a patch.

## In Scope

### Local Workspace

- Native folder picker restricted to the desktop runtime
- Persisted repository records and startup hydration
- Git repository detection, branch metadata, and open-change count
- Local SQLite persistence for workspace review records

### Repository Understanding

- Bounded file-tree indexing with ignore rules
- Indexing status and progress
- Repository Intelligence summary derived from indexed facts
- Project folders, key files, extension counts, and framework hints when data is
  safely available
- Indexed-file browser with search, filtering, metadata, and selected-file state
- Safe text preview with loading, error, binary, too-large, unavailable, and
  outside-repository states

### Agent Planning

- User-created Agent Runs
- Deterministic Mock Provider for repeatable offline demos
- Optional OpenAI plan and artifact generation through the provider adapter
- Bounded repository context without arbitrary full-file transmission
- Structured plan steps, affected files, risks, and validation checks
- Graceful provider unavailable, malformed-output, and request-failure states

### Proposed Change Review

- Persisted Proposed Changes linked to Agent Runs and Approval Requests
- Generated, not-generated, failed, unavailable, binary, and too-large artifact
  states
- Read-only generated diff preview
- Clear separation between provider-generated artifacts and local Git diffs

### Safety Evidence

- Single-file unified-diff structure validation
- Repository-relative path and operation checks
- Fixed read-only `git apply --check` dry-run
- SHA-256 digest of normalized retained patch text
- Native target-file fingerprints with bounded content hashes where policy
  permits
- Authoritative repository snapshot digest for validation/current-state
  comparison
- Apply Readiness gates for approval, validation, repository match, Git state,
  paths, artifact limits, fingerprints, and staleness
- Native/durable storage eligibility gates and exact `APPLY PATCH` confirmation
- One persisted single-file artifact application through fixed `git apply`
- Bounded pre-apply backup, application attempt, and post-apply Git status

### Human Approval And Git Review

- Persisted pending, approved, and rejected Approval Requests
- Approval detail with linked run, proposal, risks, artifacts, and local diffs
- Real read-only Git status with staged, unstaged, untracked, renamed, deleted,
  and conflict states where Git reports them
- Read-only per-file local Git diff viewer

### Operations And Quality

- Provider configuration status and sanitized connection test
- Confirmation-gated maintenance actions
- Frontend smoke and workflow tests
- Provider-contract tests
- Native path, Git parser, dry-run, fingerprint, and safety tests
- Production web build, native application build, and macOS ARM64 DMG packaging

## Explicitly Out Of Scope

- Applying multiple artifacts transactionally
- Applying directly from an Agent Run, provider, or browser preview without the
  dedicated confirmation boundary
- Automated backup rollback
- Git add, stage, commit, reset, checkout, clean, stash, branch switching, or
  remote operations
- Autonomous coding or unattended execution
- Arbitrary shell commands or provider tool use
- Streaming provider output
- Persistent credential storage or API-key entry in React
- Team collaboration, accounts, cloud sync, or organization administration
- Pull-request creation, CI orchestration, deployment, or rollback
- General IDE editing, terminal emulation, or language-server features
- Windows, Linux, Intel macOS, or signed/notarized distribution guarantees

## Demo Acceptance Criteria

The checkpoint is ready for a recorded demo when:

- The native app launches and selects a local repository.
- Indexing and Repository Intelligence complete for the selected repository.
- A Mock Provider run creates linked run, proposal, artifact, and approval state.
- OpenAI is either safely configured or clearly shown as unavailable.
- Generated artifacts remain visibly separate from local Git diffs.
- Structure validation and read-only dry-run report clear results.
- Artifact digest, target fingerprints, snapshot digest, and staleness gates are
  visible and durable.
- Approve/reject updates persist across restart.
- One eligible artifact can be applied in a disposable repository only after
  exact confirmation, and it remains unstaged and uncommitted.
- Changes shows real read-only Git status and diff data.
- Settings shows provider diagnostics and guarded maintenance actions.
- Typecheck, lint, tests, native tests, build, and diff checks pass.
- The presenter states that approval and dry-run do not apply patches; the
  separately confirmed native action does.

## Release Boundary

MVP Demo v1 is an internal demo checkpoint, not a production distribution or a
claim of autonomous implementation. Packaged `.app` and DMG artifacts prove the
native build path, but signing, notarization, update delivery, crash reporting,
and broad platform support are not part of this release.

## Next Product Boundary

The next major capability is Safe Patch Recovery and Application Hardening:
packaged disposable-repository QA, crash reconciliation, cross-process locking,
unexpected-path post-verification, and explicit user-driven rollback from the
persisted backups. Multi-artifact application remains out of scope until it has
its own atomicity design and integration coverage.
