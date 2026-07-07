# Quality Gates

## Purpose

This document defines quality gates for moving from documentation to MVP implementation and from implementation to release readiness.

Quality gates prevent the project from accumulating hidden product, architecture, AI, UX, or validation debt.

## Gate 1: Documentation Foundation Ready

### Required

- Product vision exists.
- Product principles exist.
- MVP scope exists.
- Architecture foundation exists.
- AI and provider abstraction docs exist.
- UX and design foundation exists.
- MVP specs exist.
- Templates and contribution workflow exist.

### Pass Criteria

Implementation can begin without inventing core product behavior during coding.

## Gate 2: Implementation Scaffold Ready

### Required

- Stack selected.
- Package structure created.
- TypeScript configured.
- Lint and format configured.
- Test runner configured.
- Development command works.
- Core package compiles.

### Pass Criteria

Contributor can run, edit, validate, and extend the project locally.

## Gate 3: Domain And Persistence Ready

### Required

- Core domain types implemented.
- Local persistence selected.
- Workspace can persist.
- Repository metadata can persist.
- Task, plan, run, change, validation, approval, and activity records can persist.

### Pass Criteria

Durable workspace objects survive app restart.

## Gate 4: Repository Intelligence Ready

### Required

- Repository can be registered.
- File tree scan works.
- Package/script detection works.
- Documentation discovery works.
- Git state read works.
- Validation candidates are detected.
- Repository facts distinguish observed from inferred.

### Pass Criteria

Repository overview can be generated from local facts.

## Gate 5: AI Runtime Ready

### Required

- Provider interface exists.
- Initial adapter exists.
- Context package creation works.
- Agent run lifecycle works.
- Tool call mediation path exists.
- Approval pause state works.
- Provider errors are normalized.

### Pass Criteria

An approved plan can start a bounded agent run through provider abstraction.

## Gate 6: MVP UX Ready

### Required

- App shell exists.
- Navigation works.
- Repository overview exists.
- Task detail exists.
- Plan detail exists.
- Agent run detail exists.
- Change review exists.
- Pending approvals are visible.
- Active runs are visible.

### Pass Criteria

User can complete the MVP journey through the UI.

## Gate 7: Review And Validation Ready

### Required

- Changes are reviewable.
- Risk summary appears.
- Validation summary appears.
- Accept, revise, reject actions exist.
- Tests cover critical domain behavior.
- Validation gaps are visible.

### Pass Criteria

User can decide whether to accept AI-assisted work with enough evidence.

## Gate 8: Release Candidate Ready

### Required

- MVP journey works end to end.
- Critical tests pass.
- Known validation gaps are documented.
- High-risk issues are resolved or accepted.
- Documentation matches implemented behavior.
- Git state is clean.

### Pass Criteria

The MVP can be shared for real use or focused evaluation.
