# Provider Interface

## Purpose

This document defines the conceptual internal interface between product workflows and AI providers.

The provider interface protects the product from coupling to any single model, SDK, runtime, or vendor. Product behavior should depend on stable internal contracts, not provider-specific APIs.

## Core Rule

Product workflows call the provider interface.

Provider adapters call provider-specific APIs.

No product workflow should directly depend on OMP, OpenAI, Anthropic, local model runtimes, or any future provider SDK.

## Implemented MVP Contract

`packages/ai` now exports the execution boundary used by planning workflows:

- `AgentProviderId`
- `AgentProviderCapabilities`
- `AgentRunContext`
- `CreateAgentPlanInput`
- `CreateAgentPlanResult`
- `AgentProviderAdapter`

An `AgentProviderAdapter` exposes provider identity, capability metadata, and a
single `createPlan(input)` operation. The input contains a run ID, repository
identity, task title and prompt, and already-derived indexed context. It does
not expose filesystem handles, arbitrary read commands, persistence engines,
approval mutation, or Git mutation.

The normalized result contains provider/model identity, summary, ordered
steps, proposed affected files, risks, validation checks, optional review-only
patch artifacts, and the approval requirement. Artifact data is never
permission to write files or mutate Git.

The current Mock Provider implements this interface with these capabilities:

- Plan generation: supported
- Patch generation: not supported
- Streaming: not supported
- Tool use: not supported

The OpenAI adapter supports plan generation and validated patch proposal
artifacts. It receives no full file contents, so it must use `unavailable` when
existing content would have to be guessed. Generated artifacts remain separate
from local Git diffs and cannot be applied by this contract.

The existing mock Agent Run workflow now consumes the adapter result before it
creates the same durable run, proposed change, approval request, and
`not_generated` patch artifact placeholders. No demo behavior or safety
boundary changes at this layer.

## Provider Responsibilities

An AI provider adapter should support:

- Model invocation
- Message or prompt normalization
- Streaming output where available
- Tool call mediation where available
- Structured output support where available
- Error normalization
- Cancellation
- Capability metadata
- Token or context accounting where available
- Cost and latency metadata where available

## Internal Request Shape

A provider request should include:

- Request ID
- Workflow ID or agent run ID
- Model selection or routing intent
- Input messages or structured prompt
- Context package
- Tool definitions
- Output format expectations
- Safety and permission metadata
- Streaming preference
- Timeout or cancellation signal
- Provider-independent metadata

The request should not expose product internals unnecessarily.

## Internal Response Shape

A provider response should include:

- Request ID
- Provider ID
- Model ID
- Output content
- Structured output where requested
- Tool call requests
- Usage metadata where available
- Finish reason
- Warnings
- Error state where applicable
- Latency metadata

Responses should be normalized before reaching workflows.

## Capability Metadata

The product should understand provider and model capabilities.

Capabilities may include:

- Text generation
- Structured output
- Tool calling
- Streaming
- Large context
- Vision input
- Code-specialized behavior
- Low-latency mode
- Local execution
- Privacy characteristics
- Cost profile
- Reliability profile

Capability metadata enables model routing and safe fallback.

## Error Model

Provider errors should be normalized.

Error categories:

- Authentication error
- Rate limit
- Timeout
- Provider unavailable
- Invalid request
- Context too large
- Tool call unsupported
- Structured output failure
- Safety refusal
- Unknown provider error

Workflows should receive actionable provider errors, not raw SDK-specific exceptions.

## Tool Calls

Provider tool calls should not directly execute tools.

Flow:

1. Provider requests a tool call.
2. Provider adapter normalizes the tool request.
3. Agent runtime validates the request.
4. Tool and permission layer approves or denies execution.
5. Tool result is returned to the provider through the adapter.

This prevents providers from bypassing product governance.

## Streaming

Streaming should be supported through a provider-independent event interface.

Events may include:

- Output delta
- Tool call requested
- Tool result accepted
- Warning
- Error
- Completion

The UI should not depend on provider-specific streaming event formats.

## Routing Intent

The interface should allow product workflows to specify intent without naming a specific model.

Examples:

- Planning
- Code implementation
- Review
- Summarization
- Documentation
- Fast draft
- High-reasoning task
- Low-cost background work

The routing layer can translate intent into provider and model choices.

## Security And Privacy

The provider interface should support metadata for:

- Context sensitivity
- User approval status
- Allowed providers
- Local-only requirements
- Redaction requirements
- Logging restrictions

The provider layer should not decide product policy alone, but it should enforce policy inputs.

## MVP Scope

The MVP provider interface should include:

- Basic text invocation
- Structured prompt input
- Context package input
- Normalized response
- Basic streaming support if needed
- Error normalization
- Model capability metadata
- Initial adapter contract

The initial implementation covers structured plan generation and capability
metadata. Provider SDK invocation, streaming events, tool mediation,
credentials, error normalization, and routing remain future work.

The MVP can defer:

- Complex multi-model orchestration
- Advanced cost optimization
- Fine-grained provider benchmarking
- Rich multimodal support

## Success Criteria

The provider interface is successful when:

- Product workflows do not import provider SDKs
- OMP can be used without becoming the product architecture
- A second provider can be added through an adapter
- Tool calls remain permissioned
- Errors are understandable to workflows and users
- Model routing can evolve independently
