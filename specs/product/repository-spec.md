# Repository Spec

## Status

Draft MVP spec.

## Purpose

This spec defines MVP repository registration, scanning, indexing, facts, summaries, Git state, documentation discovery, and validation discovery.

## References

- [Repository Indexing](../../docs/repositories/repository-indexing.md)
- [Code Intelligence](../../docs/repositories/code-intelligence.md)
- [Documentation Graph](../../docs/repositories/documentation-graph.md)
- [Git Workflows](../../docs/git/git-workflows.md)
- [Testing Strategy](../../docs/engineering/testing-strategy.md)

## MVP Goals

The repository system must allow the workspace to:

- Register a local repository path.
- Scan repository structure.
- Detect languages, frameworks, package files, scripts, docs, tests, and Git state.
- Produce evidence-linked repository facts.
- Generate repository summaries for AI workflows.
- Identify validation commands where practical.

## Non-Goals

The MVP does not include:

- Full semantic code graph.
- Hosted indexing.
- Cross-repository knowledge graph.
- Advanced language server integration.
- Production telemetry correlation.

## Repository Registration

### Required Fields

- `id`
- `workspaceId`
- `name`
- `path`
- `status`
- `createdAt`
- `updatedAt`
- `lastScannedAt`

### Statuses

- `registered`
- `scanning`
- `ready`
- `error`
- `missing`

### Requirements

- A repository path must be local.
- The system must verify the path exists.
- The system should detect whether the path is a Git repository.
- Registration must not perform external network calls.

## Repository Scan

### Inputs

- Repository path
- Workspace ignore settings
- Scan mode
- Prior scan metadata where available

### Outputs

- Repository snapshot
- File index
- Package/script index
- Documentation index
- Git state
- Validation command candidates
- Repository facts
- Scan warnings

### Requirements

- Scans must respect ignore settings.
- Scans should avoid large generated directories.
- Scans must record timestamp and freshness metadata.
- Scan failures must produce actionable errors.

## Repository Snapshot

### Required Fields

- `id`
- `repositoryId`
- `branch`
- `commitSha`
- `workingTreeState`
- `createdAt`
- `scanVersion`

### Requirements

- A snapshot must represent repository state at scan time.
- A snapshot must distinguish clean and dirty working tree state.
- A snapshot may omit commit SHA when unavailable.

## Repository Facts

### Required Fields

- `id`
- `repositoryId`
- `snapshotId`
- `type`
- `claim`
- `source`
- `evidence`
- `confidence`
- `createdAt`

### Types

- `observed`
- `inferred`
- `ai_generated`
- `user_confirmed`
- `stale`

### Requirements

- Observed facts must include evidence.
- Inferred facts must include confidence.
- AI-generated summaries must not be treated as observed facts.
- User corrections must be stored as user-confirmed knowledge.

## File Index

The file index should capture:

- Path
- Directory
- Extension
- Size
- Modified timestamp
- Classification

Classifications may include:

- Source
- Test
- Documentation
- Config
- Package manifest
- Generated
- Binary
- Unknown

## Package And Script Detection

The system should detect package metadata from common manifests.

For JavaScript and TypeScript repositories, the MVP should identify:

- `package.json`
- Package manager lockfiles
- Scripts
- Dependencies
- Dev dependencies
- Workspace configuration where obvious

Future specs may add deeper ecosystem coverage.

## Documentation Discovery

The system should identify:

- README files
- Docs directories
- Product docs
- Architecture docs
- Specs
- ADRs
- RFCs
- Playbooks
- Prompt docs

Discovered docs should feed the documentation graph.

## Git State

The repository view should expose:

- Current branch
- Working tree status
- Staged files
- Unstaged files
- Untracked files
- Recent commit summary where available

Git state should be refreshed before Git-related approval prompts.

## Validation Discovery

The repository scan should identify candidate validation commands:

- Test
- Typecheck
- Lint
- Build
- Format check

Commands should be candidates, not guaranteed truth. The UI should allow the user to approve or adjust validation.

## Repository Summary

The repository summary should include:

- Project shape
- Detected stack
- Major directories
- Documentation coverage
- Test and validation setup
- Git state summary
- Notable uncertainty
- Suggested next actions

Important claims should link to repository facts or files.

## Acceptance Criteria

- A repository can be registered by local path.
- A scan produces a repository snapshot.
- The app can show file, docs, package/script, Git, and validation summaries.
- Repository facts distinguish observed and inferred knowledge.
- AI workflows can request repository context from the scan output.
- Scan errors are visible and actionable.
