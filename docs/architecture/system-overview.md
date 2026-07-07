# System Overview

## Purpose

This document defines the high-level architecture for the AI-native software engineering workspace.

It describes the major system areas, their responsibilities, and how they collaborate. It is not an implementation spec. Future specs should use this document as the architectural baseline.

## Architectural Thesis

The product is an AI-native engineering workspace, not a chat app, IDE, Git client, or thin wrapper around one model provider.

The architecture must preserve five core properties:

- Human control over meaningful actions
- Provider independence
- Local-first repository understanding where practical
- Structured work artifacts instead of transient chat-only state
- Extensibility for agents, tools, providers, integrations, and workflows

The system should be designed around durable engineering objects: workspaces, repositories, tasks, plans, agent runs, changes, validations, decisions, documents, approvals, and integrations.

## System Shape

At a high level, the product is composed of:

- Application shell
- Workspace domain
- Repository context engine
- Documentation and knowledge layer
- Product and planning workflows
- Agent runtime
- Provider abstraction
- Tool and permission layer
- Change execution and review layer
- Validation layer
- Persistence layer
- Integration layer

These areas should be modular, but not isolated in a way that makes product workflows awkward. The user experience should feel like one coherent workspace.

## Primary Runtime Context

The first product should optimize for a local desktop or local-first workspace.

The initial runtime context includes:

- Local application process
- Local workspace data
- Local repository access
- Local indexing and analysis where practical
- External AI provider calls through adapters
- Optional external integrations behind explicit boundaries

The architecture should not assume that all intelligence lives locally. It should assume that local context, local indexing, and explicit provider calls work together.

## Major Components

### 1. Application Shell

The application shell provides the user-facing container for the workspace.

Responsibilities:

- Navigation
- Command surface
- Global search entry point
- Active workspace and repository context
- Activity surfaces
- Settings
- Permission prompts
- Workflow state display

The shell should not contain domain logic. It should orchestrate product surfaces and call domain services.

### 2. Workspace Domain

The workspace domain owns the core product model.

Responsibilities:

- Workspace identity and settings
- Repository registrations
- Task records
- Plans
- Agent runs
- Changes
- Validation records
- Decisions
- Documentation artifacts
- Approvals
- Activity history

The workspace domain is the center of durable product state.

### 3. Repository Context Engine

The repository context engine understands local repositories.

Responsibilities:

- File tree scanning
- Language and framework detection
- Package and dependency discovery
- Documentation discovery
- Test and script discovery
- Module and entry-point inference
- Repository summaries
- Context retrieval for AI workflows
- Evidence-linked repository facts

The engine should separate observed facts from inferred conclusions.

### 4. Documentation And Knowledge Layer

The documentation and knowledge layer connects repository knowledge to durable docs.

Responsibilities:

- Documentation index
- Documentation graph
- Links between docs, tasks, decisions, and changes
- Project memory records
- ADR and RFC references
- Prompt and agent documentation references
- Documentation impact tracking

This layer should prevent important product and technical knowledge from living only in chat or model output.

### 5. Product And Planning Workflows

Product and planning workflows turn human intent into structured work.

Responsibilities:

- Product task creation
- Product brief generation
- Requirements
- Non-goals
- Acceptance criteria
- Technical planning
- Risk identification
- Validation planning
- Human approval before implementation

These workflows should produce durable artifacts that downstream agents can use.

### 6. Agent Runtime

The agent runtime coordinates AI-assisted work.

Responsibilities:

- Agent definitions
- Agent run lifecycle
- Context assembly
- Tool access
- Permission checks
- Progress recording
- Handoffs
- Interruption and revision
- Final summaries
- Run history

Agents should operate within explicit task boundaries and permission constraints.

### 7. Provider Abstraction

The provider abstraction decouples product workflows from specific AI providers and runtimes.

Responsibilities:

- Stable internal provider interface
- Provider adapters
- Model capability metadata
- Request and response normalization
- Error handling
- Streaming support
- Tool call mediation
- Routing and fallback hooks
- Evaluation hooks

OMP is one possible runtime behind this boundary. It must not become the product architecture.

### 8. Tool And Permission Layer

The tool and permission layer governs actions that can read, write, execute, or affect external systems.

Responsibilities:

- Tool registry
- Tool capability metadata
- Permission prompts
- Approval policies
- Action previews
- Audit records
- External side-effect boundaries

The system should treat tool access as product behavior, not incidental plumbing.

### 9. Change Execution And Review Layer

The change layer tracks modifications and makes them reviewable.

Responsibilities:

- Proposed changes
- Files touched
- Diff summaries
- Change rationale
- Risk summaries
- Documentation impact suggestions
- Accept, revise, or reject states
- Commit or PR preparation hooks

AI-generated changes should be inspectable before they become accepted project state.

### 10. Validation Layer

The validation layer records whether work has been checked.

Responsibilities:

- Validation plan
- Command discovery
- Command execution records
- Test summaries
- Typecheck and lint summaries
- Manual validation checklist
- Validation gaps
- Quality gate state

The product should distinguish between "implemented" and "validated."

### 11. Persistence Layer

The persistence layer stores local workspace state and indexes.

Responsibilities:

- Workspace metadata
- Repository metadata
- Indexes
- Tasks
- Plans
- Agent runs
- Validation records
- Decisions
- User settings
- Activity history

Persistence should be local-first for the MVP. Future synchronization should be added behind explicit boundaries.

### 12. Integration Layer

The integration layer connects the workspace to external systems.

Responsibilities:

- GitHub
- CI
- Deployment systems
- Observability
- Analytics
- Issue trackers
- MCP servers
- Plugin-provided tools

Integrations should be optional, permissioned, and isolated from core domain logic.

## Data Flow: From Intent To Reviewed Change

The core MVP flow should look like this:

1. User selects a repository.
2. Repository context engine scans and indexes relevant project information.
3. User creates a product task.
4. Product workflow drafts requirements, non-goals, acceptance criteria, and open questions.
5. User approves scope.
6. Planning workflow gathers repository context and drafts a technical plan.
7. User approves implementation.
8. Agent runtime assembles context and executes bounded work through tools.
9. Change layer records touched files and reviewable diff.
10. Validation layer records checks performed and gaps.
11. User accepts, revises, or rejects the result.
12. Workspace domain preserves the task, plan, run, change, validation, and decisions.

## Architectural Rules

- Product workflows must depend on provider abstractions, not provider-specific APIs.
- Agents must operate through tool and permission boundaries.
- Repository facts should be distinguishable from AI inference.
- Human approval should be modeled as a first-class domain object.
- Validation state should be recorded separately from change state.
- External integrations should not leak into core domain models.
- Docs, tasks, plans, runs, and decisions should be linkable.
- The system should preserve enough history to explain what happened.

## MVP Architecture Boundary

The MVP should include:

- Local workspace domain
- Local repository context engine
- Product task and planning workflows
- Basic agent runtime
- Provider abstraction with initial adapter
- Tool permission model
- Reviewable change state
- Basic validation records
- Local persistence

The MVP should defer:

- Team collaboration
- Cloud synchronization
- Production observability
- Deployment automation
- Complex plugin marketplace
- Organization-level administration
- Fully autonomous regression detection

## Success Criteria

This architecture is successful when:

- Product workflows can be built without coupling to one AI provider
- Repository understanding can support planning and agent workflows
- Agent work is inspectable and permissioned
- Changes and validation are reviewable
- Human approval is explicit and durable
- The system can expand toward integrations without rewriting core models
