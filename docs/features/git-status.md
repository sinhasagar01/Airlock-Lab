# Git Status Feature

## Purpose

Git status turns the Changes tab into a real repository state surface. Local
diff preview lets the user inspect changed-file content without modifying the
repository.

## MVP Behavior

- The desktop app loads Git status for the selected repository.
- The Changes tab shows branch, repository path, last refresh time, clean/dirty
  state, total changed file count, staged count, unstaged count, untracked
  count, and changed files.
- Changed files include path, previous path for detectable renames, change kind,
  stage, and raw Git status code.
- Users can manually refresh Git status.
- Users can select a changed file and inspect a read-only local Git diff.
- Approval review can reuse the same safe local diff wrapper when proposed
  affected files match changed files by repository-relative path.
- Diff preview supports staged, unstaged, combined, untracked, binary,
  too-large, unavailable, and empty states.
- The indexed-file browser and safe file preview remain available below the Git
  status surface.

## Safety Boundary

Git status is read-only.

Allowed native commands:

- `git rev-parse --is-inside-work-tree`
- `git branch --show-current`
- `git rev-parse --short HEAD`
- `git status --porcelain=v1`
- `git diff -- <path>`
- `git diff --cached -- <path>`

Not allowed:

- `git add`
- `git commit`
- `git reset`
- `git checkout`
- `git clean`
- `git apply`
- Arbitrary Git command passthrough

The Tauri command uses fixed argument lists, no shell interpolation, canonicalized
repository roots, and current-directory execution bounded to the selected
repository path. Diff paths are validated as repository-relative paths and
absolute paths, parent-directory traversal, and unsafe path components are
rejected.

## Data Model

The shared model lives in `packages/core`:

- `GitStatusSummary`
- `GitChangedFile`
- `GitChangeKind`
- `GitChangeStage`
- `GitFileDiff`
- `GitDiffKind`
- `GitDiffLine`
- `GitDiffLineType`

The diff model is read-only. It represents local working tree or staged diffs.
Approval review may attach matching local Git diffs for inspection, but these
are not generated patch diffs and do not imply file writes have happened.
