# Module Boundaries

## Purpose

This document defines architectural ownership boundaries for the product.

The goal is to prevent the codebase from becoming a tangled mix of UI, provider calls, repository parsing, agent orchestration, persistence, and external integrations.

These boundaries are conceptual. Future package and application specs should translate them into concrete folders, packages, APIs, and dependency rules.

## Boundary Principles

- Domain logic should not depend on UI components.
- Product workflows should not depend directly on provider-specific APIs.
- Provider adapters should not own product behavior.
- Repository analysis should separate facts from AI interpretation.
- Tool execution should pass through permission checks.
- External integrations should be behind integration adapters.
- Persistence should store domain state without becoming the domain model itself.
- UI should render workflow state, not secretly invent it.

## Proposed Module Areas

### 1. App Shell

#### Owns

- Top-level layout
- Navigation
- Routes
- Command entry
- Global search entry point
- Workspace switching
- Active repository selection
- High-level workflow surfaces

#### Must Not Own

- AI provider logic
- Repository scanning algorithms
- Agent execution semantics
- Persistence schemas
- Tool permission policy

#### Depends On

- Workspace domain
- UI system
- Workflow services
- Settings services

### 2. UI System

#### Owns

- Reusable components
- Design tokens
- Layout primitives
- Accessibility patterns
- Interaction states
- Icons and visual language
- Review surfaces

#### Must Not Own

- Product-specific domain decisions
- AI reasoning
- Tool execution
- Repository indexing

#### Depends On

- Design system assets
- Shared type definitions where needed

### 3. Workspace Domain

#### Owns

- Workspace model
- Tasks
- Plans
- Agent run records
- Changes
- Validations
- Decisions
- Approvals
- Activity events
- Domain lifecycle rules

#### Must Not Own

- Provider-specific request formats
- UI rendering
- Filesystem scanning implementation
- External API clients

#### Depends On

- Shared primitives
- Persistence interfaces
- Repository context interfaces

### 4. Repository Context

#### Owns

- Repository registration
- File tree scanning
- Language detection
- Framework detection
- Package detection
- Documentation discovery
- Test discovery
- Repository facts
- Context retrieval

#### Must Not Own

- Product task lifecycle
- Agent identity
- Provider routing
- UI review behavior

#### Depends On

- Filesystem interfaces
- Git interfaces where needed
- Shared domain types

### 5. Documentation And Knowledge

#### Owns

- Documentation graph
- Document metadata
- Links between docs and work artifacts
- Project memory records
- Decision references
- Prompt and playbook references

#### Must Not Own

- Markdown editor implementation details
- AI provider calls
- Git operations
- External documentation publishing

#### Depends On

- Workspace domain
- Repository context
- Persistence interfaces

### 6. Product Workflow Layer

#### Owns

- Product task workflows
- Brief generation workflow
- Requirements workflow
- Planning workflow
- Review workflow orchestration
- Approval checkpoints

#### Must Not Own

- Provider-specific APIs
- Tool execution internals
- UI components
- Persistence implementation details

#### Depends On

- Workspace domain
- Agent runtime
- Provider abstraction
- Repository context
- Documentation and knowledge

### 7. Agent Runtime

#### Owns

- Agent definitions
- Agent run lifecycle
- Context assembly
- Tool access mediation
- Run progress
- Handoff protocol
- Output normalization
- Agent error states

#### Must Not Own

- Model provider internals
- Product-specific UI
- Raw filesystem access outside tools
- Git side effects without tool mediation

#### Depends On

- Provider abstraction
- Tool registry
- Permission layer
- Workspace domain
- Repository context

### 8. Provider Abstraction

#### Owns

- Internal model request contract
- Internal model response contract
- Streaming abstraction
- Tool call protocol boundary
- Provider adapters
- Model capability metadata
- Provider errors
- Routing hooks

#### Must Not Own

- Product task semantics
- Agent role definitions
- UI behavior
- Repository indexing
- Approval policy

#### Depends On

- Shared types
- Provider-specific SDKs or runtime clients inside adapters only

### 9. Tool And Permission Layer

#### Owns

- Tool registry
- Tool metadata
- Tool capability classification
- Permission policy
- Approval requirement detection
- Action previews
- Tool execution audit

#### Must Not Own

- Product workflow goals
- Provider-specific logic
- UI layout
- Repository analysis beyond tool behavior

#### Depends On

- Workspace domain
- Integration adapters
- Filesystem and process interfaces

### 10. Change And Review Layer

#### Owns

- Changed file tracking
- Diff summaries
- Change status
- Review state
- Risk summaries
- Revision requests
- Accept and reject state

#### Must Not Own

- Git commit execution
- PR publishing
- Provider calls directly
- Test execution internals

#### Depends On

- Workspace domain
- Repository context
- Validation layer
- Git interface

### 11. Validation Layer

#### Owns

- Validation plan
- Validation command records
- Validation status
- Output summaries
- Validation gaps
- Quality gate state

#### Must Not Own

- Product task definition
- Provider adapter details
- UI presentation rules
- Deployment policy

#### Depends On

- Tool layer
- Workspace domain
- Repository context

### 12. Git Layer

#### Owns

- Git status
- Branch metadata
- Commit metadata
- Diff retrieval
- Local Git operations behind permission checks
- PR preparation data

#### Must Not Own

- Product review policy
- AI-generated PR narrative
- GitHub API integration directly
- UI components

#### Depends On

- Tool and permission layer
- Repository context
- Integration interfaces for remote hosts

### 13. Integration Layer

#### Owns

- External service adapters
- GitHub adapter
- CI adapter
- Deployment adapter
- Observability adapter
- MCP adapter
- Plugin tool adapters

#### Must Not Own

- Core domain lifecycle
- Product workflows
- Agent run semantics
- Provider abstraction internals

#### Depends On

- External APIs
- Tool and permission layer
- Shared integration contracts

### 14. Persistence Layer

#### Owns

- Storage adapters
- Local database access
- Index storage
- Migration mechanisms
- Serialization
- Query APIs

#### Must Not Own

- Domain decision logic
- UI behavior
- Provider behavior
- External service behavior

#### Depends On

- Storage engine
- Shared schemas

## Dependency Direction

Preferred direction:

1. UI depends on workflows and domain interfaces.
2. Workflows depend on domain, agents, repository context, docs, and provider abstractions.
3. Agents depend on provider abstraction, tools, permissions, and context services.
4. Provider adapters depend on external providers, but no product layer depends on provider adapters directly.
5. Persistence implements storage interfaces, but domain logic should not be written as database logic.
6. Integrations implement external contracts, but product logic should call integration interfaces.

## Forbidden Couplings

- UI components directly importing provider SDKs
- Product workflows directly calling OMP or any provider SDK
- Agent runtime bypassing permission checks to execute tools
- Repository context engine mutating tasks or approvals
- Provider adapters writing workspace state
- Integration adapters owning core domain status transitions
- Validation results being inferred only from chat output without recorded evidence

## MVP Boundary Expectations

The MVP can be implemented with fewer physical packages, but it should preserve logical boundaries.

Acceptable for MVP:

- One app with internal modules
- Simple local persistence
- A small number of provider adapters
- Basic agent runtime
- Basic repository context engine

Not acceptable for MVP:

- Provider calls embedded throughout UI code
- Tool execution without approval policy
- Git or filesystem writes hidden inside AI workflow helpers
- Domain state stored only in chat messages
- Repository inference treated as confirmed fact

## Boundary Health Checklist

Before adding a feature, ask:

- Which module owns this behavior?
- Does this introduce provider coupling?
- Does this bypass permissions?
- Is this UI state or domain state?
- Is this an observed fact, inference, or user-confirmed knowledge?
- Does this external integration leak into core models?
- Will this still work if the provider changes?
- Can this action be audited later?
