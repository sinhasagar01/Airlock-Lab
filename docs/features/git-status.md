# Git Status Feature

## Purpose

Git status turns the Changes tab into a real repository state surface. It is the
read-only foundation for future local diff review.

## MVP Behavior

- The desktop app loads Git status for the selected repository.
- The Changes tab shows branch, repository path, last refresh time, clean/dirty
  state, total changed file count, staged count, unstaged count, untracked
  count, and changed files.
- Changed files include path, previous path for detectable renames, change kind,
  stage, and raw Git status code.
- Users can manually refresh Git status.
- The indexed-file browser and safe file preview remain available below the Git
  status surface.

## Safety Boundary

Git status is read-only.

Allowed native commands:

- `git rev-parse --is-inside-work-tree`
- `git branch --show-current`
- `git rev-parse --short HEAD`
- `git status --porcelain=v1`

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
repository path.

## Data Model

The shared model lives in `packages/core`:

- `GitStatusSummary`
- `GitChangedFile`
- `GitChangeKind`
- `GitChangeStage`

The diff model is intentionally not implemented yet.
