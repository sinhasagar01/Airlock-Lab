# Repository Indexing

## Purpose

This document defines how the workspace should index local repositories.

Repository indexing is the foundation for repository understanding, context retrieval, planning, agent workflows, change review, validation, and documentation alignment.

## Core Principle

The product should understand repositories through observed facts first and AI-generated interpretation second.

Indexing should produce reliable local knowledge that AI workflows can reference, cite, and update over time.

## Indexing Goals

Repository indexing should help the workspace answer:

- What files and directories exist?
- What languages and frameworks are used?
- What packages and scripts are available?
- Where are entry points?
- Where are tests?
- Where is documentation?
- What modules appear to exist?
- What changed recently?
- What context is relevant to a task?
- What facts are observed versus inferred?

## Indexing Scope

### File System Index

The workspace should index:

- File paths
- Directory paths
- File extensions
- File sizes
- Modified timestamps
- Ignored files
- Generated files where detectable
- Binary files where detectable

The file system index should avoid reading unnecessary large files.

### Language And Framework Index

The workspace should detect:

- Primary languages
- Frameworks
- Build tools
- Package managers
- Runtime requirements
- Configuration files
- Monorepo structure where applicable

Detection should be evidence-based and cite files such as package manifests, config files, lockfiles, and framework-specific conventions.

### Package And Script Index

The workspace should index:

- Package manifests
- Scripts
- Dependencies
- Dev dependencies
- Workspace packages
- Build commands
- Test commands
- Lint commands
- Typecheck commands

This index supports validation planning and agent workflows.

### Documentation Index

The workspace should index:

- README files
- Product docs
- Architecture docs
- Specs
- ADRs
- RFCs
- Playbooks
- Prompt docs
- Inline documentation where useful

Documentation should be linked into the documentation graph.

### Git Index

The workspace should index:

- Current branch
- Working tree status
- Changed files
- Recent commits where available
- Untracked files
- Staged files
- Remote metadata where available

Git state should be treated as dynamic and refreshed before important actions.

### Test And Validation Index

The workspace should detect:

- Test directories
- Test files
- Test frameworks
- Test scripts
- CI configuration
- Lint commands
- Typecheck commands
- Build commands
- Known validation gaps

This should feed the validation layer.

## Fact Types

Indexed knowledge should be classified as:

- Observed fact
- Inferred fact
- AI-generated summary
- User-confirmed fact
- Stale fact

Observed facts are derived directly from repository state. Inferred facts require confidence and evidence. AI-generated summaries should never be treated as raw repository truth.

## Incremental Indexing

The index should support incremental updates.

Triggers may include:

- Workspace open
- Repository selection
- File changes
- Git branch changes
- User-initiated rescan
- Agent run completion
- Validation completion

The system should avoid expensive full rescans when a targeted refresh is sufficient.

## Index Freshness

Index records should include:

- Last scan time
- Source file timestamp
- Repository branch
- Commit reference where available
- Index schema version
- Confidence where relevant

If the index may be stale, AI workflows should disclose that.

## Privacy And Exclusions

Indexing should respect:

- `.gitignore`
- Workspace ignore settings
- Large file limits
- Secret file patterns
- Dependency directories
- Build outputs
- Generated artifacts

The product should avoid indexing or sending sensitive files unless explicitly approved.

## MVP Scope

The MVP should support:

- File tree indexing
- Basic language detection
- Package/script detection
- Documentation discovery
- Git status detection
- Basic test command discovery
- Repository summary inputs
- Fact freshness metadata

The MVP can defer:

- Deep semantic code graph
- Cross-repository indexing
- Advanced incremental file watchers
- Hosted indexes
- Organization-level knowledge graph

## Success Criteria

Repository indexing is successful when:

- Repository summaries are grounded in evidence
- AI workflows can retrieve relevant context
- Validation workflows can identify likely commands
- Git and working tree state are visible
- Users can distinguish facts from inference
- Indexing feels fast enough for daily use
