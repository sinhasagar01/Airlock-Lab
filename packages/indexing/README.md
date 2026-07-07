# Indexing Package

## Purpose

`packages/indexing` owns repository indexing and repository fact generation.

It should produce evidence-linked repository knowledge for context retrieval, planning, validation discovery, and repository summaries.

## Responsibilities

- File tree scanning
- Ignore handling
- Language detection
- Framework detection
- Package manifest detection
- Script detection
- Documentation discovery
- Test and validation command discovery
- Git state reader boundary
- Repository fact generation
- Scan warnings

## Must Not Own

- UI components
- AI provider calls
- Agent runtime behavior
- Product task lifecycle
- Approval policy
- Persistence engine implementation

## Dependency Rules

Allowed:

- `packages/core`
- Structured parsers where selected
- Git interface abstraction

Avoid:

- Provider SDKs
- UI libraries
- Direct writes to domain records outside service boundaries

## MVP Exports

Expected exports:

- `scanRepository`
- `detectLanguages`
- `detectPackageScripts`
- `discoverDocumentation`
- `discoverValidationCommands`
- `readGitState`
- `RepositoryScanResult`
- `RepositoryFactCandidate`

## Acceptance Criteria

- Repository service can call indexing package to produce scan results.
- Scan results distinguish observed facts from inferred facts.
- Indexing package does not call AI providers.
- Scan output can feed context packages and repository summaries.
