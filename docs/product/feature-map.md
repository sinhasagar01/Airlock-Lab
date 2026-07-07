# Feature Map

## Purpose

This document organizes product capabilities into coherent areas.

The feature map is not a release plan. It is a product architecture map that helps future specs, designs, tasks, and implementation work stay organized.

## Product Areas

The product is organized into ten major areas:

1. Workspace Foundation
2. Repository Understanding
3. Product And Planning
4. AI Agent Runtime
5. Provider Abstraction
6. Change Execution And Review
7. Documentation And Knowledge
8. Git And Pull Requests
9. Validation And Quality
10. Integrations And Operations

## 1. Workspace Foundation

### Purpose

Provide the core application structure where repositories, tasks, docs, agents, and changes can coexist.

### Capabilities

- Local workspace creation
- Repository selection
- Project dashboard
- Navigation shell
- Command surface
- Search
- Activity timeline
- Settings
- Permissions overview
- Workspace memory overview

### MVP Status

Required.

The MVP needs a coherent workspace shell even if many advanced areas are not yet implemented.

## 2. Repository Understanding

### Purpose

Help users understand repositories faster and provide context for AI workflows.

### Capabilities

- Repository scan
- File tree analysis
- Framework and language detection
- Dependency summary
- Entry point detection
- Module map
- Documentation graph
- Test setup detection
- Repository summary
- Uncertainty reporting
- Evidence-linked explanations

### MVP Status

Required.

Repository understanding is the foundation for trusted AI assistance.

## 3. Product And Planning

### Purpose

Turn ideas and user intent into structured work before implementation.

### Capabilities

- Product task creation
- Product brief generation
- Requirements drafting
- Non-goals
- Acceptance criteria
- User journey linking
- Technical plan generation
- Risk identification
- Validation planning
- Approval state

### MVP Status

Required.

The product should model disciplined work definition from the beginning.

## 4. AI Agent Runtime

### Purpose

Coordinate AI work through structured, inspectable, permission-aware agent runs.

### Capabilities

- Agent role definitions
- Agent run creation
- Scoped context injection
- Tool permission model
- Progress timeline
- Intermediate outputs
- Handoff protocol
- Stop and revise controls
- Run history
- Human approval gates

### MVP Status

Required in basic form.

The first version can support a small number of core agents before expanding into full multi-agent orchestration.

## 5. Provider Abstraction

### Purpose

Keep the product independent from any single model, provider, or runtime.

### Capabilities

- Provider interface
- Provider adapters
- OMP adapter
- Model capability metadata
- Routing policy
- Cost and latency awareness
- Fallback handling
- Provider health state
- Evaluation hooks

### MVP Status

Required.

Even if the first implementation uses one provider, the internal architecture must preserve provider independence.

## 6. Change Execution And Review

### Purpose

Support AI-assisted implementation while keeping changes inspectable and human-controlled.

### Capabilities

- Approved implementation scope
- File change tracking
- Diff review
- Change summary
- Risk summary
- Validation status
- Revision request
- Accept or reject run
- Documentation impact suggestion

### MVP Status

Required in basic form.

The product’s trust model depends on reviewable changes.

## 7. Documentation And Knowledge

### Purpose

Keep project knowledge durable, structured, and connected to work.

### Capabilities

- Documentation index
- Product docs
- Architecture docs
- Specs
- ADRs
- RFCs
- Playbooks
- Prompt docs
- Decision capture
- Documentation impact detection
- Project memory

### MVP Status

Partially required.

The MVP should support docs as first-class artifacts, even if automated documentation alignment comes later.

## 8. Git And Pull Requests

### Purpose

Connect local changes to Git workflows while preserving human approval.

### Capabilities

- Git status
- Branch awareness
- Commit preparation
- Pull request draft generation
- PR summary
- Reviewer notes
- Linked tasks and docs
- Risk and validation summary
- Explicit publish approval

### MVP Status

Post-MVP for full workflow.

Basic Git awareness may be needed early, but PR automation can come after the core workspace proves useful.

## 9. Validation And Quality

### Purpose

Help users determine whether work is correct, safe, and ready.

### Capabilities

- Test command discovery
- Manual validation checklist
- Typecheck and lint execution
- Test result summary
- Quality gates
- AI review
- Prompt evaluation
- Visual review support
- Security checks

### MVP Status

Required in basic form.

The MVP should at minimum record recommended validation and display executed validation results.

## 10. Integrations And Operations

### Purpose

Extend the workspace into the broader engineering environment.

### Capabilities

- GitHub integration
- MCP integration
- CI integration
- Deployment integration
- Observability integration
- Logs
- Monitoring
- Analytics
- Customer feedback
- Incident workflows

### MVP Status

Mostly post-MVP.

The long-term Engineering OS vision requires this area, but the first product should not depend on broad integrations.

## Cross-Cutting Capabilities

### Permissions

Every action that reads, writes, modifies Git state, calls external tools, or affects external systems should have an explicit permission model.

### Explainability

AI actions should expose goal, reasoning summary, inputs, affected files, confidence, risks, and validation.

### Auditability

Important actions should be recorded in an inspectable timeline.

### Search

Users should be able to search files, docs, tasks, decisions, agent runs, and changes.

### Command Surface

Frequent workflows should be accessible through a fast command interface.

### Design System

The product should use consistent components, patterns, tokens, accessibility rules, and interaction principles.

## MVP Feature Set

The MVP should include:

- Workspace shell
- Local repository selection
- Repository scan and overview
- Documentation-aware project map
- Product task creation
- Product brief drafting
- Technical plan generation
- Basic agent run flow
- Provider abstraction
- OMP adapter
- Human approval gates
- File change summary
- Diff review
- Validation summary
- Project memory basics

## Post-MVP Feature Set

The next layer should include:

- Pull request draft generation
- GitHub integration
- Documentation impact detection
- Multi-agent orchestration
- ADR/RFC creation flows
- AI review agent
- Test command discovery
- Saved workflow templates
- Team permissions

## Long-Term Feature Set

The Engineering OS layer should include:

- CI integration
- Deployment integration
- Observability integration
- Regression detection
- Incident diagnosis
- Runtime-aware fix planning
- Automated PR preparation
- Release readiness
- Governed deployment support
- Organization-level knowledge graph
