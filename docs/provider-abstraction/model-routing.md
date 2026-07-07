# Model Routing

## Purpose

This document defines how the product should choose providers and models for AI workflows.

Model routing should allow workflows to request capabilities and intent without hard-coding a specific model. Routing can begin simple and grow more sophisticated over time.

## Routing Principle

Workflows should describe what they need.

The routing layer should decide which provider and model best satisfy that need under current user policy, capability metadata, cost, latency, and availability constraints.

## Routing Inputs

Routing should consider:

- Workflow type
- Agent role
- Task complexity
- Required capabilities
- Context size
- Tool call needs
- Structured output needs
- Privacy constraints
- User preferences
- Provider availability
- Cost sensitivity
- Latency sensitivity
- Historical performance

## Routing Intents

Initial routing intents may include:

- Repository summarization
- Product planning
- Technical planning
- Code implementation
- Code review
- Documentation drafting
- Bug diagnosis
- Validation explanation
- Fast draft
- High-confidence reasoning
- Low-cost background work

Routing intents should remain provider-independent.

## Capability Matching

The router should check capabilities such as:

- Text generation
- Code generation
- Tool calling
- Structured output
- Streaming
- Required context window
- Local-only support
- Vision or other modalities if needed

If no provider matches, the workflow should fail clearly and explain what capability is missing.

## Policy Constraints

Policy may restrict routing.

Examples:

- Use only local providers for sensitive repositories
- Do not send source code to specific providers
- Prefer low-cost providers for summaries
- Require high-reasoning models for architecture decisions
- Disable fallback for privacy-sensitive tasks

Policy should override optimization.

## Routing Flow

1. Workflow submits routing intent and requirements.
2. Router filters providers by user policy.
3. Router filters models by required capabilities.
4. Router estimates context size and fit.
5. Router applies preference, cost, latency, and reliability rules.
6. Router selects provider and model.
7. Provider interface executes request.
8. Router records selection metadata.
9. Evaluation records outcome for future improvement.

## Fallback Behavior

Fallback may happen when:

- Selected provider fails
- Rate limit is reached
- Context exceeds capacity
- Required structured output fails
- Tool call behavior is unsupported

Fallback must respect privacy and policy constraints.

The system should record:

- Original route
- Failure reason
- Fallback route
- User-visible implications

## User Visibility

Users should be able to inspect:

- Which provider was used
- Which model was used
- Why it was selected at a high level
- Whether fallback occurred
- Whether policy constrained routing
- Whether context was reduced

This should be available without making everyday workflows noisy.

## MVP Routing

MVP routing can be simple.

It should support:

- Default provider selection
- Routing intent field
- Basic capability checks
- Context limit check
- User provider preference
- Clear failure when required capability is unavailable

The MVP can defer:

- Automated benchmarking
- Cost optimization
- Multi-step ensemble routing
- Dynamic model switching during a run
- Organization policy engine

## Future Routing

Future routing may support:

- Per-agent model preferences
- Per-workflow evaluation scores
- Cost and latency budgets
- Local-first fallback
- Automatic context compression
- Multi-model review
- Specialized models for code, planning, and docs
- Team policy

## Success Criteria

Model routing is successful when:

- Workflows stay provider-independent
- Model selection is explainable
- User policy is respected
- Missing capabilities fail clearly
- Fallback is safe and visible
- Routing can improve without rewriting agents or workflows
