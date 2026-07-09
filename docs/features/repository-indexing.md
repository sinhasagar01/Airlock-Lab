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
- The Repositories tab derives a Repository Intelligence view from repository
  metadata, Git metadata, indexing status, and indexed file facts.

## UI Treatment

Repository indexing appears as a premium dashboard workflow:

- Overview metric tiles summarize repositories and indexing mode.
- Active repository cards show path, branch, Git status, and open changes.
- Indexing progress uses an accent progress bar.
- Indexed-file browsing uses searchable rows, extension pills, and a detail preview panel.
- Repository Intelligence summarizes repository overview, index health, top
  file extensions, important folders, key files, package/framework hints, and
  entry points into file browsing, reindexing, agent runs, and changes.

## Repository Intelligence

Repository Intelligence is deliberately fact-based for the MVP. It does not use
AI analysis yet and must not invent unsupported conclusions.

Derived data includes:

- Repository name, path, Git status, current branch, open changes, indexing
  status, indexing progress, and last indexed time.
- Total indexed files and unique indexed directory count.
- Top file extensions derived from indexed file facts.
- Important folders when present, including `apps`, `packages`, `src`,
  `components`, `docs`, `tests`, `scripts`, and `config`.
- Key files when present, including `package.json`, `README.md`,
  `tsconfig.json`, `vite.config.ts`, `tauri.conf.json`, `Cargo.toml`,
  `CHANGELOG.md`, and `PROJECT-STATE.md`.
- Framework hints inferred only from indexed paths or known config files, such
  as TypeScript, React, Vite, Tauri, and documentation presence.

Unavailable data should be shown as unavailable, not faked. Package scripts and
dependency details remain unavailable until the app adds a bounded, safe
metadata reader for `package.json`.

## Boundaries

Indexing must respect ignore rules, large-file limits, local-only persistence,
and safe preview boundaries. Repository Intelligence should prefer already
indexed metadata over new filesystem reads.
