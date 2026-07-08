# Repository Indexing Feature

## Purpose

Repository indexing turns selected local repositories into browsable facts for the app shell and future agent context.

## MVP Behavior

- Users choose local repositories through the native Tauri dialog.
- Repository records persist locally.
- Git metadata records branch, open changes, and Git repository status.
- File-tree indexing scans selected repositories with ignore rules.
- Indexed file facts persist in SQLite.
- The app shell shows indexing status, extension counts, searchable files, and selected-file details.

## UI Treatment

Repository indexing appears as a premium dashboard workflow:

- Overview metric tiles summarize repositories and indexing mode.
- Active repository cards show path, branch, Git status, and open changes.
- Indexing progress uses an accent progress bar.
- Indexed-file browsing uses searchable rows, extension pills, and a detail preview panel.

## Boundaries

Indexing must respect ignore rules, large-file limits, local-only persistence, and safe preview boundaries.
