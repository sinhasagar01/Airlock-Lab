# ADR 0002: Use Tauri, React, TypeScript, And Vite For The MVP App

## Status

Proposed.

## Context

The MVP must provide a local-first engineering workspace with access to local repositories, local persistence, AI workflows, approval gates, review surfaces, and a polished expert-user interface.

The product needs:

- Local filesystem access.
- Local process and command boundaries.
- A fast frontend development loop.
- A high-quality React UI.
- Clear separation between UI and local system capabilities.
- A path to cross-platform desktop distribution.
- A runtime architecture that supports permissioned local capabilities.

The technical spike recommends Tauri 2 with React, TypeScript, Vite, TanStack Router, and TanStack Query.

## Decision

Use Tauri 2 as the MVP desktop application shell.

Use React, TypeScript, and Vite for the frontend.

Use TanStack Router for type-safe frontend routing.

Use TanStack Query for async application/service state such as repository scans, agent runs, validation commands, and job status.

## Architecture Shape

- `apps/desktop` owns the Tauri shell and frontend app.
- `packages/ui` owns reusable React design-system primitives.
- `packages/core` owns shared domain types.
- `packages/indexing` owns repository scanning and fact generation.
- `packages/ai` owns provider abstraction and agent contracts.
- Tauri commands expose local capabilities through explicit command boundaries.

## Consequences

### Positive

- Aligns with the local-first product direction.
- Keeps the app lightweight compared with a Chromium-plus-Node desktop shell.
- Allows the frontend to use the builder’s React and TypeScript strengths.
- Creates an explicit boundary between UI and local system capabilities.
- Supports polished desktop UX without requiring a hosted service for MVP.

### Negative

- Introduces Rust and Tauri-specific implementation knowledge.
- Requires early validation of filesystem, process, SQLite, and packaging capabilities.
- Webview behavior may vary across platforms and require QA.

### Neutral Or Tradeoffs

- Electron remains a fallback if Tauri blocks critical MVP workflows.
- The MVP should keep the Rust/Tauri layer thin until product workflows stabilize.
- Browser-only development may still be useful for fast UI iteration, but the product target is desktop.

## Alternatives Considered

### Electron

Electron is mature and proven for desktop applications. It was not selected as the first choice because it is heavier and makes Chromium and Node a broader default runtime surface than the MVP needs.

### Web App With Local Backend

A web app with a local backend would support some local-first behavior, but it introduces local service lifecycle complexity and feels less like a cohesive desktop workspace.

### Browser-Only Web App

Rejected for MVP because local repository access, command boundaries, persistence, and desktop workflow expectations are central to the product.

## Implementation Notes

- Validate Tauri filesystem, shell, and SQLite integration before building broad UI.
- Keep Tauri commands permission-aware.
- Do not let frontend components execute local capabilities directly.
- Keep product workflows independent from Tauri-specific APIs where possible.
- Use TanStack Router route objects that map to durable workspace objects.
- Use TanStack Query for server/local service state, not for durable domain ownership.

## Related Documents

- [Technical Spikes](../../tasks/research/technical-spikes.md)
- [App Shell Spec](../../specs/frontend/app-shell.md)
- [Frontend Component Architecture](../../specs/frontend/component-architecture.md)
- [Frontend State Management](../../specs/frontend/state-management.md)
- [Module Boundaries](../../docs/architecture/module-boundaries.md)
