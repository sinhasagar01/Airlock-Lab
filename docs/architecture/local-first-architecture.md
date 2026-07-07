# Local-First Architecture

## Purpose

This document defines what local-first means for the product.

Local-first is a trust, speed, privacy, and developer experience strategy. It does not mean the product never uses cloud services. It means the product should keep core project context and common workflows close to the user whenever practical.

## Local-First Thesis

The workspace should be useful with a local repository, local project state, and explicit AI provider access.

The user should not need a hosted service for every basic action. Repository understanding, project memory, task planning, review state, and validation records should be available locally in the MVP.

External calls should be intentional, visible, permissioned, and routed through clear boundaries.

## What Should Be Local In The MVP

### Workspace State

The following should be stored locally:

- Workspace settings
- Registered repositories
- Active repository metadata
- Tasks
- Plans
- Agent run records
- Change records
- Validation records
- Approval records
- Activity history
- Project memory

### Repository Context

The following should be computed or indexed locally where practical:

- File tree
- Detected languages
- Detected frameworks
- Package metadata
- Script metadata
- Documentation files
- Test files
- Git branch and status metadata
- Repository facts
- Searchable local context

### Review And Validation State

The following should be locally available:

- Changed file list
- Diffs
- Review summaries
- Validation plans
- Command outputs
- Validation gaps
- Accepted or rejected state

### Documentation Knowledge

The following should be locally indexable:

- Repository docs
- Product docs
- Architecture docs
- Specs
- ADRs
- RFCs
- Playbooks
- Prompt docs
- Links between docs and work artifacts

## What May Be External

The product may call external systems for:

- AI model inference
- Provider-specific model tools
- GitHub actions
- Pull request creation
- CI status
- Deployment status
- Observability data
- Analytics data
- MCP tools
- Plugin-provided remote services
- Cloud sync in future versions

External systems must be integrated through explicit adapters and permission boundaries.

## AI Provider Calls

AI provider calls are allowed, but they must be:

- Routed through the provider abstraction
- Visible enough for the user to understand what kind of context is being sent
- Governed by workspace settings
- Logged at the product level without exposing secrets
- Designed so providers can be replaced

The product should never scatter provider calls throughout unrelated modules.

## Privacy And Trust

The product should make privacy behavior understandable.

Users should be able to know:

- Which repositories are registered
- Which files are indexed
- Which context may be sent to AI providers
- Which tools can access the filesystem
- Which integrations are connected
- Which actions affect external systems
- Which data is stored locally

The product should avoid vague claims like "secure by default" without concrete behavior.

## Permission Boundaries

Local-first does not remove the need for permissions.

Actions that require careful handling include:

- Writing files
- Deleting files
- Running commands
- Modifying Git state
- Reading secrets or environment files
- Sending source context to external providers
- Calling external integrations
- Publishing pull requests
- Triggering CI or deployment actions

The user should receive action previews for meaningful writes or external side effects.

## Local Indexing

Local indexing should support fast repository understanding and context retrieval.

Indexing should distinguish:

- Raw file metadata
- Parsed structural metadata
- Documentation metadata
- Dependency metadata
- Git metadata
- AI-generated summaries
- User-confirmed knowledge

AI-generated summaries should not be treated as equivalent to observed repository facts.

## Offline And Degraded Behavior

The MVP does not need to be fully offline, but it should degrade gracefully.

Without network access, the product should still support:

- Opening workspace state
- Viewing registered repositories
- Viewing existing tasks and plans
- Viewing existing docs
- Viewing existing agent run records
- Viewing diffs and validation records
- Running local repository scans where possible

Without AI provider access, the product should not pretend AI workflows can run. It should show clear provider availability states.

## Local Persistence Strategy

The persistence layer should support:

- Durable local workspace data
- Incremental repository indexes
- Activity history
- Schema migrations
- Backup or export in future versions
- Clear separation between stored facts and generated outputs

The storage engine is not decided here. Future specs should evaluate options based on reliability, portability, query needs, migration support, and developer experience.

## Sync And Cloud Future

Future versions may support cloud sync, teams, and organizations.

Cloud features should not require rewriting the local-first model. Instead, the architecture should treat sync as an additional layer over durable local domain objects.

Future cloud capabilities may include:

- Team workspaces
- Shared project memory
- Organization policies
- Shared agents
- Remote run history
- Cross-repository insights
- Hosted indexes

These should be added behind explicit sync and collaboration boundaries.

## Security Considerations

Local-first architecture should protect:

- Source code
- Secrets
- Git credentials
- Provider keys
- Local filesystem boundaries
- Tool execution
- External side effects

The product should avoid reading or transmitting sensitive files unless explicitly required and approved.

Future security specs should define:

- Secret detection
- Redaction behavior
- Permission prompts
- Audit logs
- Integration scopes
- Credential storage

## Human Control In Local Workflows

Local workflows still require human control.

The app should request approval before:

- Starting implementation from a plan
- Expanding scope
- Writing outside expected files
- Running risky commands
- Modifying Git state
- Sending broad repository context to providers
- Creating or publishing remote artifacts

Local-first should make the product faster and more trustworthy, not more autonomous by default.

## MVP Requirements

The MVP should include:

- Local workspace persistence
- Local repository registration
- Local repository scanning
- Local task and plan storage
- Local agent run records
- Local change review records
- Local validation records
- Provider calls through abstraction
- Explicit approval gates for meaningful writes

The MVP may defer:

- Cloud sync
- Team collaboration
- Organization policy
- Hosted indexing
- Production observability
- Deployment integrations

## Success Criteria

The local-first architecture is successful when:

- The app feels fast with local repositories
- Core project state is available locally
- Users understand what leaves their machine
- External providers can be swapped
- Repository context can be reused across workflows
- AI actions are permissioned and auditable
- Future sync can be added without replacing the core model
