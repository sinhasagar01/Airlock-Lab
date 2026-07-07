# Pull Request Workflows

## Purpose

This document defines how the workspace should help prepare and manage pull requests.

Pull requests are review artifacts. The workspace should make them clearer by linking product intent, technical plan, diff, validation, risks, and decisions.

## Core Principle

The product may draft pull requests, but publishing a pull request is an external side effect that requires explicit human approval.

## PR Inputs

A high-quality PR draft should gather:

- Task
- Product brief
- Technical plan
- Changed files
- Diff summary
- Validation records
- Risk analysis
- Documentation updates
- ADRs or RFCs
- Screenshots or artifacts where relevant

The PR should not be generated from the diff alone.

## PR Draft Content

A PR draft should include:

- Title
- Summary
- Motivation
- Scope
- Implementation notes
- Testing performed
- Validation gaps
- Risk notes
- Documentation impact
- Linked tasks and decisions
- Reviewer guidance

The PR should not overstate certainty or validation.

## Review Readiness

Before PR creation, the workspace should check:

- Is there a linked task or plan?
- Are changed files understood?
- Are unrelated changes excluded?
- Has validation been run or explicitly skipped?
- Are risks documented?
- Are required docs updated or flagged?
- Does the user approve publishing?

## AI Role

AI may:

- Summarize change intent
- Draft PR title and description
- Identify review focus areas
- Explain risks
- Summarize validation
- Suggest screenshots or artifacts
- Link relevant docs

AI must not publish without approval.

## PR Lifecycle

### Draft Prepared

The workspace creates a local PR draft.

### Ready For Approval

The user reviews the draft, changed files, validation, and risks.

### Published

After approval, the PR may be created in an external Git provider.

### Updated

The workspace may update the PR draft or published PR after additional changes, with approval for external writes.

### Closed Or Merged

The workspace records final status where available.

## MVP Scope

The MVP may support local PR draft preparation without publishing.

MVP capabilities:

- PR title draft
- PR description draft
- Diff summary
- Validation summary
- Risk notes
- Linked task and plan

Post-MVP:

- GitHub PR creation
- PR comments
- Review status sync
- CI status sync
- Merge readiness

## Success Criteria

Pull request workflows are successful when:

- PRs are grounded in product and technical context
- Reviewers can understand why the change exists
- Validation and risk are visible
- Publishing is explicit
- The workspace preserves PR context for future memory
