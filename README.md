# AI Developer Workspace

AI Developer Workspace is a local-first Tauri desktop application for
understanding a repository, creating provider-backed implementation plans, and
reviewing proposed changes behind explicit human approval and read-only safety
checks.

This repository is at the **MVP Demo v1** checkpoint. It is suitable for an
internal recorded demo and engineering review. Patch application is
intentionally not implemented.

## MVP Workflow

```text
Select repository
  -> index files
  -> inspect Repository Intelligence
  -> start an Agent Run
  -> review the proposed plan and patch artifacts
  -> validate structure and run read-only git apply --check
  -> review approval and matching local Git diffs
  -> approve or reject without applying files
```

## Current Capabilities

- Native repository folder selection and persisted local repository records
- File-tree indexing, Repository Intelligence, search, and safe file preview
- Mock Provider planning for deterministic offline demos
- Optional OpenAI plan and generated-artifact creation through native
  environment configuration
- Persisted Agent Runs, Proposed Changes, patch artifacts, and Approval Requests
- Generated patch structure validation and read-only applicability dry-run
- SHA-256 artifact digests, target-file fingerprints, and repository snapshot
  digests for staleness detection
- Read-only local Git status and per-file diff inspection
- Approval decisions separated from explicit Safe Patch Application
- Native single-artifact application with exact typed confirmation, pre-apply
  backup, and post-apply Git status
- Confirmation-gated Settings maintenance actions
- Frontend, provider-contract, and native safety tests
- Packaged macOS `.app` and DMG output

## Safety Boundary

The MVP can safely apply one eligible persisted patch artifact through a
dedicated native command.

- Agent Runs, approval, validation, and dry-run do not write repository files.
- `Apply Patch` appears only after every gate passes and requires the exact
  phrase `APPLY PATCH`.
- React sends durable IDs only; native code reloads persisted patch content and
  runs fixed `git apply --whitespace=nowarn -` over stdin.
- A bounded backup is persisted before the working-tree write.
- Interrupted native attempts are reconciled conservatively on startup and
  review entry; ambiguous state requires manual inspection and is never retried.
- No Git add, commit, reset, checkout, clean, or staging operation is exposed.
- Approval means the review record was approved. It does not itself write.
- Generated patch artifacts and local Git diffs are displayed as separate data.

See [Safe Patch Application Design](docs/security/patch-application-safety.md)
for the implemented boundary and remaining rollback/concurrency gaps. Candidate
builds should follow the
[disposable repository apply QA](docs/qa/disposable-repository-apply-qa.md).

## Prerequisites

- macOS for the current packaged desktop target
- Node.js and npm
- Rust with Cargo
- Tauri v2 system prerequisites

The workspace scripts currently add Homebrew rustup at
`/opt/homebrew/opt/rustup/bin` to `PATH` for desktop commands.

## Install And Run

```bash
npm install
npm run dev
```

`npm run dev` launches the native Tauri application. Native repository
selection, SQLite persistence, Git inspection, and safe file access require
this runtime.

For a browser-only UI preview:

```bash
npm run dev:web -w @ai-dev/desktop
```

The browser preview cannot open local folders or use native safety commands. It
must not be used to demonstrate native repository behavior.

## Provider Configuration

Mock Provider is the default and requires no credentials.

OpenAI planning is optional and reads credentials only from the native process
environment:

```bash
OPENAI_API_KEY="..." npm run dev:tauri
```

`OPENAI_MODEL` may optionally select a configured model. Credentials are not
stored in React state, SQLite, localStorage, logs, documentation, or committed
files.

OpenAI currently generates plans and review-only patch artifacts. It does not
apply patches, call arbitrary tools, or mutate Git.

## Verification

```bash
npm run typecheck
npm run lint
npm run test
npm run build
git diff --check
```

Rust-specific checks:

```bash
PATH=/opt/homebrew/opt/rustup/bin:$PATH cargo fmt \
  --manifest-path apps/desktop/src-tauri/Cargo.toml -- --check
PATH=/opt/homebrew/opt/rustup/bin:$PATH cargo test \
  --manifest-path apps/desktop/src-tauri/Cargo.toml
```

The desktop build emits macOS artifacts under
`apps/desktop/src-tauri/target/release/bundle/`.

## Workspace Layout

```text
apps/desktop/       React, Vite, Tauri shell, native commands, and persistence
packages/ai/        Provider, agent-run, proposal, artifact, and approval types
packages/core/      Shared workspace and Git contracts
packages/indexing/  Repository indexing and intelligence helpers
packages/ui/        Shared dashboard primitives and icons
docs/               Product, architecture, safety, engineering, and demo docs
```

## Release Documentation

- [Current MVP scope](docs/mvp-scope.md)
- [Recorded demo script](docs/demo-script.md)
- [MVP Demo v1 release notes](docs/release-notes/mvp-demo-v1.md)
- [Current project state](PROJECT-STATE.md)
- [Changelog](CHANGELOG.md)

## Known MVP Limitations

- Patch application and repository writes are not implemented.
- Approval does not consume or apply an artifact.
- OpenAI requires runtime environment configuration and network access.
- Native packaging is currently verified for macOS ARM64.
- Team collaboration, remote repositories, deployment automation, and
  production-grade credential storage are outside this checkpoint.
