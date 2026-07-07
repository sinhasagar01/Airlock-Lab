# User Journeys

## Purpose

This document describes end-to-end workflows through the product.

User journeys connect personas and use cases into concrete sequences. They should guide product design, information architecture, agent behavior, and future specs.

## Journey 1: First Repository Understanding

### Persona

AI-native senior builder

### Scenario

The user opens a repository they want to understand before making changes.

### Flow

1. The user selects or opens a local repository.
2. The workspace scans the repository structure.
3. The workspace identifies languages, frameworks, entry points, package boundaries, tests, and documentation.
4. The AI creates an evidence-linked repository overview.
5. The workspace surfaces major modules, likely architecture, docs, setup instructions, and uncertainty.
6. The user drills into a module, file group, or documentation area.
7. The user saves the generated repository understanding as a durable project artifact.

### Key Product Surfaces

- Repository picker
- Repository overview
- File and module map
- Documentation graph
- AI reasoning panel
- Save-to-doc action

### Required Trust Signals

- File citations
- Clear distinction between facts and inference
- Confidence and uncertainty notes
- No hidden writes during scan

### Success State

The user understands the project shape and knows where to go next.

## Journey 2: Product Idea To Scoped Work

### Persona

Solo founder building with AI

### Scenario

The user has a feature idea and wants to turn it into scoped work before implementation.

### Flow

1. The user creates a new product task.
2. The workspace asks for the intended user, problem, and desired outcome.
3. The AI drafts a product brief with goals, non-goals, requirements, and open questions.
4. The user edits the brief.
5. The workspace suggests related docs, specs, and existing features.
6. The AI proposes acceptance criteria and risk areas.
7. The user approves the scope.
8. The workspace creates or links follow-up technical planning tasks.

### Key Product Surfaces

- Task creation
- Product brief editor
- Requirements checklist
- Related context panel
- Approval state

### Required Trust Signals

- Open questions are explicit
- Non-goals are visible
- The user can edit before approval
- Implementation does not start automatically

### Success State

The feature has a clear product artifact that can guide design and engineering.

## Journey 3: Scoped Work To Technical Plan

### Persona

Product-minded developer

### Scenario

The user has an approved product task and wants a technical plan.

### Flow

1. The user starts a technical planning workflow from a product task.
2. The workspace gathers relevant files, docs, patterns, and prior decisions.
3. The AI proposes an implementation plan.
4. The plan includes affected areas, approach, alternatives, risks, validation, and unresolved questions.
5. The user edits or narrows the plan.
6. The workspace records the approved plan as part of the task.
7. The user chooses whether to begin implementation.

### Key Product Surfaces

- Plan view
- Context sources panel
- Risk section
- Validation checklist
- Approval controls

### Required Trust Signals

- Affected files are listed
- Assumptions are visible
- Risk is not hidden
- The user explicitly approves before edits

### Success State

The user has a bounded, reviewable implementation plan grounded in repository context.

## Journey 4: AI-Assisted Implementation

### Persona

AI-native senior builder

### Scenario

The user approves a technical plan and asks the system to implement it.

### Flow

1. The user starts an implementation run.
2. The workspace shows the approved scope, permissions, and expected files.
3. The AI agent performs the change.
4. The workspace shows progress, touched files, and intermediate notes.
5. The agent stops if scope expands or approval is required.
6. The workspace presents a final diff, summary, and validation status.
7. The user reviews the change.
8. The user accepts, requests revisions, or discards the run.

### Key Product Surfaces

- Agent run view
- Permission summary
- File change timeline
- Diff review
- Validation output
- Revision request input

### Required Trust Signals

- Scope boundaries are visible
- Agent actions are logged
- The diff is reviewable before acceptance
- Validation gaps are explicit

### Success State

The user receives a useful implementation while remaining fully in control.

## Journey 5: Review And Decision Capture

### Persona

Engineering lead

### Scenario

The user reviews an AI-assisted change and wants the decision trail preserved.

### Flow

1. The user opens the completed change review.
2. The workspace summarizes what changed and why.
3. The AI reviewer identifies potential issues, missing tests, and documentation impacts.
4. The user reviews the diff and feedback.
5. The workspace suggests whether an ADR, RFC, spec update, or doc update is needed.
6. The user accepts selected documentation updates.
7. The user approves the change for commit or PR preparation.

### Key Product Surfaces

- Review summary
- AI review findings
- Diff navigator
- Documentation impact panel
- Decision capture action

### Required Trust Signals

- Findings cite exact files or reasoning
- Suggested docs are optional and reviewable
- Approval is explicit
- No commit or PR is created silently

### Success State

The change is reviewed, risks are understood, and important context is preserved.

## Journey 6: Pull Request Preparation

### Persona

Engineering lead

### Scenario

The user wants to prepare a pull request after a validated change.

### Flow

1. The user selects a reviewed change.
2. The workspace gathers the task, plan, diff, validation, and decision records.
3. The AI drafts a PR title and description.
4. The workspace shows testing, risk, and documentation links.
5. The user edits the PR draft.
6. The user explicitly approves creating or publishing the PR.
7. The workspace records the action in the change history.

### Key Product Surfaces

- PR draft editor
- Linked context panel
- Validation summary
- Risk summary
- Publish approval

### Required Trust Signals

- The draft does not exaggerate validation
- Links to context are visible
- Publishing requires approval
- External side effects are clear

### Success State

The user has a high-quality PR draft grounded in the actual change history.

## Journey 7: Bug Diagnosis

### Persona

AI-native senior builder

### Scenario

The user has a failing test, bug report, or error output and wants a diagnosis.

### Flow

1. The user starts a diagnosis workflow and provides the observed failure.
2. The workspace collects relevant logs, test output, files, recent changes, and docs.
3. The AI proposes likely causes ranked by confidence.
4. The user inspects evidence for each hypothesis.
5. The workspace suggests diagnostic commands or targeted code inspection.
6. The user approves a fix plan or continues investigation.

### Key Product Surfaces

- Diagnosis workspace
- Evidence panel
- Hypothesis list
- Suggested commands
- Fix planning action

### Required Trust Signals

- Causes are ranked, not asserted as certain
- Evidence is linked
- Uncertainty is visible
- Fixes are not applied automatically

### Success State

The user has a clear path from symptom to likely cause and next action.

## Journey 8: Documentation Alignment

### Persona

Product-minded developer

### Scenario

The user makes or reviews a change that may affect documentation.

### Flow

1. The workspace detects changed product behavior, architecture, prompts, or workflows.
2. The AI identifies docs likely to be affected.
3. The workspace shows suggested documentation updates.
4. The user reviews and edits suggested updates.
5. The workspace links the updates to the original task or change.

### Key Product Surfaces

- Documentation impact panel
- Suggested edits
- Linked task context
- Review and accept controls

### Required Trust Signals

- Suggestions explain why a doc may be affected
- The user can accept, modify, or reject each update
- Documentation changes are visible as diffs

### Success State

Documentation remains aligned with product and implementation changes.

## MVP Journey Priority

The MVP should support the first four journeys well:

1. First repository understanding
2. Product idea to scoped work
3. Scoped work to technical plan
4. AI-assisted implementation

The next product layer should add:

1. Review and decision capture
2. Pull request preparation
3. Bug diagnosis
4. Documentation alignment
