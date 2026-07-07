# RFC 0002: Local Indexing Strategy

## Status

Proposed.

## Summary

The product should index repositories locally for the MVP.

Local indexing should produce repository facts, file metadata, documentation discovery, package/script detection, Git state, and validation command candidates. AI-generated summaries may use this data, but observed facts must remain distinct from AI inference.

## Problem

AI workflows need reliable project context.

Without local indexing, users must manually paste context, AI outputs become less grounded, and the workspace cannot provide fast repository understanding, validation discovery, risk analysis, or documentation graph behavior.

Hosted indexing may become useful later, but the MVP should prove local trust and speed first.

## Goals

- Support fast local repository understanding.
- Preserve privacy by default.
- Produce evidence-linked repository facts.
- Support context retrieval for AI workflows.
- Support validation command discovery.
- Support documentation graph creation.
- Support Git state awareness.
- Avoid sending source code externally unless needed and approved.

## Non-Goals

- Build a full semantic code graph in MVP.
- Host repository indexes in the cloud.
- Support organization-wide search.
- Build production telemetry correlation.
- Depend on AI as the only indexing mechanism.

## Proposal

Implement a local repository indexing system that captures:

- File tree.
- Language and framework signals.
- Package manifests and scripts.
- Documentation files.
- Test and validation candidates.
- Git state.
- Repository facts.
- Scan freshness metadata.

The index should classify knowledge as:

- Observed.
- Inferred.
- AI-generated.
- User-confirmed.
- Stale.

## Indexing Inputs

Inputs:

- Repository path.
- Ignore settings.
- Git state.
- Package manifests.
- Documentation files.
- Known framework conventions.

## Indexing Outputs

Outputs:

- Repository snapshot.
- File index.
- Documentation index.
- Package/script index.
- Validation candidates.
- Repository facts.
- Scan warnings.

## Privacy Rules

The indexer should respect:

- `.gitignore`.
- Workspace ignore settings.
- Large file limits.
- Dependency directories.
- Build outputs.
- Secret-like files.

Sensitive files should be excluded by default where practical.

## Alternatives Considered

### AI-Only Repository Understanding

Rejected because AI inference without observed facts is harder to trust and cite.

### Hosted Index First

Rejected for MVP because local-first behavior is a product principle and faster to validate.

### Full Semantic Graph First

Rejected because it increases scope before the basic workspace flow is proven.

## Risks

### Risk: Indexing Is Too Shallow

Mitigation: Start with useful observed facts and evolve toward deeper code intelligence.

### Risk: Indexing Is Too Slow

Mitigation: Respect ignores, avoid large files, and support incremental indexing later.

### Risk: Sensitive Files Are Indexed

Mitigation: Conservative exclusions and future secret detection.

## Open Questions

- Which storage engine should persist indexes?
- Which language ecosystems should receive first-class detection first?
- Should file watching be included in MVP or deferred?

## Related Documents

- [Repository Indexing](../../docs/repositories/repository-indexing.md)
- [Repository Spec](../../specs/product/repository-spec.md)
- [Context Protocol](../../specs/ai/context-protocol.md)
- [Local-First Architecture](../../docs/architecture/local-first-architecture.md)
