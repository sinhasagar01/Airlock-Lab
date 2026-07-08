# Tokens

## Purpose

Design tokens are the shared source of truth for visual decisions across the desktop app and future package-level UI primitives.

## Current Source

The implemented MVP token source is `apps/desktop/src/styles.css`.

The shared UI package emits semantic class names such as
`status-pill--success` and `summary-card`; the app stylesheet owns their visual
values so product screens stay themeable.

## Token Groups

- Color roles: background, sidebar, surface, muted surface, text, accent, state, border, focus.
- Radius scale: small, medium, large, extra large.
- Spacing scale: 4px through 48px.
- Shadow roles: soft elevated card shadow and high-contrast action shadow.
- Typography roles: hero title, section heading, panel heading, body, metadata, status, code preview.
- Icon roles: shared 24px product icons for navigation, metrics, sidebar actions, and compact object cues.

## Rule

Components should consume semantic tokens or shared classes. Avoid one-off color literals unless introducing a new documented token.
