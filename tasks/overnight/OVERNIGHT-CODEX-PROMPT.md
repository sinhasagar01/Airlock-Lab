# Overnight Codex Task Runner

You are running overnight after usage reset.

Do not perform uncontrolled broad changes.

Work through the tasks below in order.

After each task:

1. Implement only that task.
2. Switch into verifier mode.
3. Review your own changes against:
   - references/final-dashboard-design/final-dashboard-design.png
   - references/final-dashboard-design/IMPLEMENTATION-SPEC.md
   - existing product behavior
4. Fix serious verifier findings.
5. Run available checks.
6. Update PROJECT-STATE.md and CHANGELOG.md.
7. Continue only if the previous task is stable.

Hard rules:

- Do not weaken Tauri filesystem safety.
- Do not remove existing functionality.
- Do not rewrite app architecture unnecessarily.
- Do not introduce a new UI library.
- Do not touch unrelated tabs unless required.
- Preserve repository picker.
- Preserve Git metadata loading.
- Preserve indexing.
- Preserve file preview states.
- Preserve approval persistence.
- Preserve approve/reject actions.
- Preserve six-tab navigation.

## Task 1: Make file preview panel native to the new design system

Goal:
The indexed file browser and preview panel should feel like a first-class part of the redesigned product.

Preserve:

- safe Tauri read command
- file size limits
- no file selected state
- loading state
- text preview
- binary file state
- too-large file state
- unavailable/outside repo state
- error state
- selected file metadata

Improve:

- file browser panel
- selected file styling
- search/filter styling
- metadata hierarchy
- preview code block
- binary/too-large/error states
- empty state
- badges
- icon treatment
- spacing

Use existing design primitives and tokens.

Run checks.

## Task 2: Add repository intelligence view scaffold

Goal:
Create a proper repository intelligence section using existing indexed/Git/package data where available.

Include cards for:

- Repository overview
- Framework/package hints if detectable
- Git health
- Index freshness
- Key folders
- Available scripts if package.json exists
- File tree summary

This can be a scaffold if some data is not available yet, but it should be designed cleanly and not fake unsupported data.

Preserve repository picker, indexing, and Git metadata behavior.

Run checks.

## Task 3: Improve smoke tests if test setup exists

If test setup exists, add or improve tests for:

- six tabs render
- sidebar navigation works
- file preview states render
- approval buttons exist
- pending approval count renders

If test setup does not exist or is unstable, configure only the minimal safe setup. Do not spend the whole run rewriting testing architecture.

Run checks.

## Stop condition

Stop after Task 3.

Do not start additional tasks.

Final response should include:

1. tasks completed
2. files changed
3. verification performed
4. commands run
5. failing checks if any
6. remaining issues
7. recommended next tasks
