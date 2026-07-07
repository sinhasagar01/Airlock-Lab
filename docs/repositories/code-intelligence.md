# Code Intelligence

## Purpose

This document defines how the workspace should understand source code beyond file listings.

Code intelligence should support planning, implementation, review, risk analysis, validation, and repository onboarding. It should begin pragmatic and grow toward deeper semantic understanding.

## Core Principle

Code intelligence should make the repository more understandable without pretending to be omniscient.

The system should cite evidence, preserve uncertainty, and separate static analysis from AI interpretation.

## Capabilities

### Structural Understanding

The workspace should identify:

- Entry points
- Modules
- Components
- Routes
- Services
- Libraries
- Configuration files
- Test files
- Generated files
- Shared utilities

This can begin with conventions and file patterns before evolving into deeper language-aware parsing.

### Dependency Understanding

The workspace should detect:

- Package dependencies
- Internal imports
- Module relationships
- Shared package usage
- Circular dependency risks where detectable
- High fan-in or high fan-out files

Dependency understanding supports risk analysis and planning.

### Ownership And Responsibility

The workspace should infer what areas own:

- UI shell
- State management
- Data access
- AI provider integration
- Agent runtime
- Repository indexing
- Validation
- Git integration
- Design system

These inferences should be confidence-scored and correctable by users.

### Pattern Recognition

The system should identify local patterns before proposing changes.

Examples:

- Component conventions
- File naming
- Test style
- Error handling
- State management patterns
- API boundary patterns
- Styling patterns
- Documentation conventions

AI implementation should follow existing patterns unless the approved plan explicitly changes them.

### Change Impact Understanding

The workspace should estimate:

- Which files may be affected by a change
- Which tests may be relevant
- Which docs may require updates
- Which modules depend on changed code
- Whether changes cross module boundaries
- Whether public interfaces changed

Impact understanding should feed risk analysis and review.

## Code Intelligence Sources

Sources may include:

- File tree index
- Package manifests
- Static import parsing
- Language server output where available
- Typecheck output
- Test output
- Git history
- Documentation graph
- AI-generated summaries
- User-confirmed annotations

The system should prefer structured tools and parsers over ad hoc text matching when practical.

## AI Role

AI should help interpret code intelligence, not replace it entirely.

AI can:

- Summarize modules
- Explain architecture
- Identify likely responsibilities
- Propose affected areas
- Review consistency with patterns
- Explain risk

AI should not be the only source of truth for facts that tools can observe directly.

## MVP Scope

The MVP should support:

- File and module summaries
- Basic import/dependency discovery where practical
- Pattern summaries from selected files
- Affected file suggestions
- Relevant test suggestions
- Documentation impact suggestions

The MVP can defer:

- Full language server integration
- Precise call graph
- Advanced static analysis
- Cross-repository symbol graph
- Automated ownership inference from Git history

## Success Criteria

Code intelligence is successful when:

- Users understand repository structure faster
- Plans reference real code patterns
- Agents avoid inconsistent changes
- Reviews surface likely impact areas
- Risk analysis has evidence
- AI claims are grounded in code context
