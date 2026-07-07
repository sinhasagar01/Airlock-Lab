# Personas

## Purpose

This document defines the initial users for the AI-native software engineering workspace.

Personas are not demographic profiles. They describe working contexts, motivations, anxieties, decision patterns, and product needs. They should help product, design, architecture, prompts, and agent workflows stay anchored in real user behavior.

## Primary Persona: AI-Native Senior Builder

### Summary

The AI-native senior builder is an experienced engineer who uses AI as a serious daily tool, not as a novelty.

They can design, implement, review, and ship software independently. They care about architecture, product quality, UX, and long-term maintainability. They want AI to increase leverage without reducing judgment or craft.

### Context

This user often works across:

- Product definition
- UI architecture
- Frontend implementation
- Design systems
- Repository organization
- Technical documentation
- Code review
- AI-assisted implementation
- Release planning

They may be building a new product from zero, maintaining a complex application, or exploring a large unfamiliar repository.

### Goals

- Move faster without lowering quality
- Preserve product and architectural intent
- Use AI to handle more work while staying in control
- Understand complex repositories quickly
- Keep documentation, specs, and implementation aligned
- Review AI-generated changes with confidence
- Build reusable workflows instead of repeating prompts manually
- Maintain a beautiful, fast, disciplined engineering environment

### Pain Points

- AI chat sessions lose context
- Generated code is hard to audit at scale
- Project decisions are scattered across files, chat, memory, and tickets
- Existing tools do not understand the full engineering system
- Documentation drifts from code
- AI tools often optimize for output volume instead of engineering quality
- Switching between editor, terminal, GitHub, docs, and AI tools creates friction
- Provider-specific workflows create lock-in

### Product Needs

- Repository-aware context
- Structured tasks and plans
- Inspectable agent runs
- Clear approval gates
- High-quality diffs and review surfaces
- Persistent project memory
- Documentation-first workflows
- Provider abstraction
- Fast navigation and keyboard-first interaction
- Strong UX polish

### Success Looks Like

The user can move from intent to reviewed change faster than before, while understanding exactly what the system did, why it did it, and what risks remain.

## Secondary Persona: Solo Founder Building With AI

### Summary

The solo founder is building an ambitious software product with limited human help. They use AI to stretch their capacity across product, design, engineering, documentation, and operations.

They may be technical, semi-technical, or design/product-led with enough engineering fluency to supervise AI-assisted work.

### Goals

- Build a real product faster than a small team traditionally could
- Maintain architectural coherence despite heavy AI usage
- Avoid losing the thread across many AI-generated tasks
- Turn product ideas into specs, plans, tasks, and implementation
- Keep a high bar for UX and product quality
- Prepare the project for future engineers or investors

### Pain Points

- Too many AI outputs are disposable
- It is hard to know whether AI-generated code is safe
- Important decisions are not captured
- The founder must constantly restate context
- AI can create architecture sprawl
- Shipping pressure competes with documentation and quality

### Product Needs

- A durable project brain
- Opinionated documentation structure
- Scope control
- Clear MVP boundaries
- AI agents with defined roles
- Review and validation workflows
- Decision records
- Release readiness guidance

### Success Looks Like

The founder can use AI to build quickly while producing a repository that still feels intentional, understandable, and ready for collaboration.

## Secondary Persona: Engineering Lead

### Summary

The engineering lead manages technical direction across one or more repositories. They care about team throughput, code quality, architecture, incident response, and review standards.

They may not write every line of code, but they need a reliable understanding of what is changing and why.

### Goals

- Understand repository health and change risk
- Keep architecture decisions explicit
- Improve review quality
- Reduce onboarding time
- Connect product intent to implementation
- Govern AI-assisted development safely
- Ensure destructive or externally visible actions require approval
- Make team workflows repeatable

### Pain Points

- Reviewers lack context
- Architecture knowledge lives in a few people’s heads
- AI-generated work can be hard to trust
- Incidents require reconstructing history under pressure
- Documentation is incomplete or stale
- Tooling is fragmented across GitHub, CI, docs, tickets, and observability

### Product Needs

- Repository maps
- Risk summaries
- Pull request intelligence
- ADR and RFC workflows
- Audit trails
- Approval policies
- Team playbooks
- Observability-aware diagnosis

### Success Looks Like

The lead can see what changed, why it changed, how it was validated, what risks remain, and what decisions should be recorded.

## Secondary Persona: Product-Minded Developer

### Summary

The product-minded developer works across user needs, interaction design, and implementation. They care that software solves the right problem and feels good to use.

They often translate ambiguous ideas into shipped user experiences.

### Goals

- Connect user journeys to implementation work
- Avoid building features without product clarity
- Use AI to explore options without losing product judgment
- Keep UX principles visible during engineering execution
- Maintain design system consistency
- Review generated UI work against product intent

### Pain Points

- AI often produces plausible but generic UX
- Feature work can start before the user problem is clear
- Design system rules are easy to violate
- Product decisions disappear into implementation details
- Specs and UI behavior drift apart

### Product Needs

- Product docs linked to tasks and specs
- User journey views
- Design system references
- UX review agents
- Acceptance criteria
- Visual and interaction review workflows

### Success Looks Like

The user can move from product intent to implementation while preserving the user experience standards defined earlier in the process.

## Future Persona: Team Contributor

### Summary

The team contributor joins an existing project and needs to become productive quickly. They may be an engineer, designer, technical writer, QA specialist, or AI workflow operator.

### Goals

- Understand the project quickly
- Find relevant docs and decisions
- Know the correct workflow for a task
- Use AI safely within team permissions
- Contribute changes that match existing architecture and standards

### Pain Points

- Onboarding requires asking many people for context
- Docs may be incomplete
- Repository structure is unclear
- It is hard to know which decisions are still current
- AI tools may not know team conventions

### Product Needs

- Project map
- Documentation graph
- Workflow playbooks
- Agent role definitions
- Permission-aware actions
- Contribution guidance

### Success Looks Like

The contributor can understand the project’s structure, standards, and workflows without needing weeks of informal knowledge transfer.

## Anti-Personas

The product should not initially optimize for:

- Non-technical users who want a no-code app builder
- Users who want fully autonomous code changes without review
- Users who only need generic chatbot assistance
- Teams that do not value documentation, review, or explicit decisions
- Users seeking a replacement for all editor functionality on day one

These users may be served later, but they should not shape the first product.

## Persona Priority

Initial product priority:

1. AI-native senior builder
2. Solo founder building with AI
3. Product-minded developer
4. Engineering lead
5. Team contributor

The product should begin with expert individual leverage, then expand toward team governance and the broader Engineering Operating System vision.
