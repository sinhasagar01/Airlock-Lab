# Airlock

Change-control airlock for AI-generated code changes. Nothing reaches the working
tree unless a human approved it and the machine can prove exactly what it did.

Read docs/roadmap.md before any task. It is the single source of truth for scope,
findings, and corrections. Update it when work lands.

## Non-negotiable discipline

- Tests first. Show each failing FOR THE RIGHT REASON before the fix.
- Green on arrival proves nothing. Neutralise the guard, watch it fail, restore.
- Vacuous fixtures: 6 catches so far. If a neutralised guard leaves a test green,
  the test is the bug. Pick values that fail in BOTH directions.
- Green means nothing crashed, not that it's right. Renaming the product broke 0
  tests; deleting a whole fixture left 146/148 passing.
- Predict test counts AFTER tests exist, BEFORE committing. Actual != predicted → STOP.
- Investigate before scoping. Correct the brief when it's wrong — never build to a
  false premise.
- Prove by exercise, not construction. Disposable temp repos, read-only git.
- Low on context → STOP at a coherent boundary. Never economise on proof.

## Git

- State the commit sequence in your report, then commit it. You are running headless —
  there is no human to approve a proposal. Work that stays uncommitted did not happen.
- Every task ends with: commits made, --ff-only to main, main green, pushed.
- Verify each commit in a throwaway worktree. Confirm @ai-dev/* resolves INSIDE it
  before trusting any result.
- --ff-only to main, re-verify green, delete branch, push behind a SCRIPTED
  isPrivate gate. Never force-push.
- NEVER: reset, checkout of files, clean, rebase, amend.

## Safety

- Native authoritative for all writes. React passes durable IDs only.
- Fail closed on anything undeterminable. Never weaken a gate.
- Restore only from app-local backups. Never git in apply/rollback flows.
- Bundle identifier com.airlocklab.airlock is pinned by a test. Never change it.
- Provider context bounded and repository-accurate.
- Don't touch types/tables/columns/serde names (UI-local unions like
  NavigationSection are fine). Don't rewrite App.tsx. Don't enable
  noUncheckedIndexedAccess.

## Blindness

You cannot see pixels. dev:web is a shell; screencapture is blocked. You can assert
structure via jsdom. You will NOT claim "polished" or any visual judgment. Every
report ends with an EYES-ONLY list: what you could not assert and why.

## Verify

npm run typecheck && npm run lint && npm run test && npm run build && git diff --check
cargo fmt --manifest-path apps/desktop/src-tauri/Cargo.toml --check
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml

Baseline: 150 frontend, 104 native, 15 AI. Remote private, main pushed.

## Report format

8 points: files changed / inspected / root cause or implementation / safety
boundaries preserved / tests / commands run / known gaps / next task.
Plus the eyes-only list.

## When you need a human decision

Append the question to .loop/decisions.md, then continue to the next task that does
not depend on it. Do not stall. Do not guess.
