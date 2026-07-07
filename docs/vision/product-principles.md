# Product Principles

## Purpose

These principles define the standards every major feature, workflow, agent, interface, and architectural decision must satisfy.

They are intended to be used as a decision-making tool. When a tradeoff is unclear, choose the option that better preserves these principles.

## 1. AI Native

AI is part of the workspace, not an add-on.

The product should not treat AI as a chat panel attached to traditional software. AI should be integrated into the structure of the workspace: tasks, files, repositories, specs, plans, reviews, diffs, deployments, and decisions.

AI-native behavior means the system can:

- Use project context without requiring the user to paste it manually
- Work with structured objects instead of only free-form text
- Maintain continuity across sessions and tasks
- Coordinate specialized agents around clear responsibilities
- Explain work in terms of engineering intent, scope, and risk
- Produce outputs that belong in the repository, not only in chat history

AI should make the workspace more capable without making it less legible.

## 2. Human Control

The human is the final authority.

The system may propose, prepare, analyze, generate, validate, and recommend. It must not take meaningful destructive action without explicit approval.

Human control requires:

- Clear permission boundaries
- Approval gates for destructive or externally visible actions
- Reversible workflows where practical
- Visible action history
- Clear ownership of decisions
- No hidden automation that changes code, Git state, deployments, secrets, or external systems

The product should make the user feel powerful, not bypassed.

## 3. Explainability

Every significant AI action must be explainable.

The product should help users understand not only what the AI produced, but why it produced it and how much confidence they should place in it.

For meaningful AI actions, the system should expose:

- Goal
- Reasoning summary
- Inputs used
- Affected files or systems
- Confidence
- Uncertainty
- Assumptions
- Risks
- Validation performed
- Recommended next action

Explainability is not a verbose transcript. It is actionable clarity.

## 4. Local First Where Practical

The workspace should use local computation and local indexing whenever practical.

Local-first design improves speed, privacy, resilience, and developer trust. The product should be able to understand and navigate repositories without depending on remote services for every interaction.

Local-first does not mean local-only. Some workflows will require cloud AI providers, GitHub, CI systems, deployment platforms, observability tools, or team collaboration services.

The principle is:

> Keep control, context, and fast feedback close to the developer whenever possible.

## 5. Provider Independence

The product must not be tightly coupled to any single AI provider, runtime, or model.

OMP is an AI runtime, not the product.

The system must include an abstraction layer that allows providers to be swapped, combined, routed, evaluated, and upgraded over time.

Provider independence requires:

- Stable internal interfaces for model calls
- Separation between product workflows and provider-specific APIs
- Adapter-based integration
- Model capability metadata
- Routing policies
- Evaluation hooks
- Clear handling of provider limitations and failures

The product should be able to evolve as the AI ecosystem changes.

## 6. Documentation-Driven Development

Documentation is the source of truth.

Major product behavior should be documented before implementation. Specs should describe what must be built. ADRs should record architectural choices. RFCs should support larger debates. Playbooks should define repeatable workflows. Prompts should be versioned and reviewed like product-critical assets.

Documentation-driven development requires:

- Product intent before feature implementation
- Architecture before broad code structure
- Specs before complex workflows
- ADRs for durable technical decisions
- RFCs for consequential open questions
- Prompt documentation for important agent behavior
- Continuous alignment between docs and code

The repository should teach future contributors how the system thinks.

## 7. Exceptional UX Is A Feature

The product should be beautiful, fast, and deeply usable.

AI-native engineering tools will only become daily workspace software if they feel trustworthy and enjoyable under real work pressure.

The UX should prioritize:

- Speed
- Spatial clarity
- Keyboard fluency
- Dense information design
- Low-friction review
- Clear navigation
- Calm visual hierarchy
- Immediate feedback
- Accessible interaction patterns
- Excellent empty, loading, error, and approval states

The product should feel crafted, not generated.

## 8. Structured Work Over Chat Drift

Chat is useful, but it cannot be the only organizing surface.

The product should convert intent into structured work artifacts:

- Tasks
- Plans
- Specs
- Diffs
- Reviews
- Decisions
- Approvals
- Agent runs
- Validation reports
- Pull requests

Free-form conversation should be able to initiate work, clarify intent, and explain outcomes. It should not become the only place where important project knowledge lives.

## 9. Transparency Over Magic

The product should avoid opaque automation.

Users should never have to guess what the system did, what context it used, or what will happen if they approve an action.

Transparency requires:

- Visible state
- Clear action previews
- Audit trails
- Explainable permissions
- Diff-first workflows
- Explicit external side effects
- Confidence and uncertainty indicators

The system may feel intelligent, but it should not feel mysterious in high-stakes moments.

## 10. Extensibility From The Beginning

The product should be designed for extension.

The long-term platform may support multiple AI providers, MCP servers, plugins, custom agents, repository analyzers, workflow automations, and team-specific playbooks.

Extensibility should be built through stable boundaries, not premature complexity.

The product should define:

- Extension points
- Internal contracts
- Permission models
- Tool registries
- Agent capabilities
- Provider adapters
- Integration boundaries

The goal is a system that can grow without becoming tangled.

## 11. Safety Is Product Design

Safety is not only a backend concern or policy layer.

Safety must appear in product design, architecture, permissions, prompts, agent workflows, review states, and release processes.

Safe behavior includes:

- No destructive action without approval
- No hidden writes to important systems
- No silent credential exposure
- Clear handling of uncertainty
- Conservative defaults
- Action previews
- Risk summaries
- Validation before recommendation
- Human review for consequential changes

The product should help users move quickly without normalizing recklessness.

## 12. Preserve Context

Software projects lose enormous value through context loss.

The workspace should preserve the reasoning behind decisions, changes, investigations, and reviews.

The product should capture:

- Why work was started
- What context was considered
- What alternatives were rejected
- What files changed
- What risks were identified
- What validation was performed
- Who approved the work
- What follow-up remains

Context preservation turns AI assistance from disposable output into durable project knowledge.

## 13. Build For Expert Users First

The first version should respect expert builders.

Expert users need speed, control, inspectability, and composability more than hand-holding. The product should not hide complexity that matters. It should organize complexity so it can be understood and acted on.

This means:

- Fast navigation
- Powerful search
- Clear shortcuts
- Inspectable agent runs
- Rich diff and review surfaces
- Fine-grained permissions
- Configurable workflows
- Minimal ceremony for common actions

Begin with experts. Earn their trust. Broaden carefully.

## 14. Quality Compounds

The product should be built as if it may become a venture-backed company and a long-lived engineering platform.

Shortcuts that damage architecture, documentation, reliability, or UX should be treated as product debt, not harmless speed.

Quality compounds through:

- Clear information architecture
- Consistent design system
- Strong module boundaries
- Reliable tests
- Well-documented prompts
- Repeatable playbooks
- Recorded decisions
- Careful provider abstractions
- Excellent developer experience

The product should become easier to extend over time, not harder.

## 15. The Workspace Should Learn

The product should become more useful as it accumulates project context.

Learning does not mean uncontrolled model training. It means the workspace should preserve structured knowledge and make it available to future workflows.

The system should learn from:

- Repository analysis
- Documentation
- ADRs
- RFCs
- Task history
- Agent runs
- Pull request reviews
- Incidents
- Validation results
- User corrections

The workspace should gradually understand the project the way a strong technical teammate would.

## Principle Checklist

Before building or approving a major feature, ask:

- Is this AI-native, or just AI-adjacent?
- Does the human remain in control?
- Can the system explain what it is doing?
- Does it preserve useful project context?
- Is it provider-independent?
- Does it improve documentation alignment?
- Is it fast and clear enough for daily expert use?
- Are risks visible before action?
- Are extension points clear?
- Does this make the product more trustworthy over time?
