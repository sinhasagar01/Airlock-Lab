# Iconography

## Purpose

Iconography should make product areas easier to scan without becoming decorative noise.

## Current Implementation

The shared UI package exports an `Icon` primitive from `packages/ui/src/index.tsx`.

Dashboard iconography is provided by `lucide-react`, wrapped by the shared `Icon` primitive. Product code should use semantic icon names such as `repository`, `approval`, or `settings`; the shared package owns the Lucide component mapping.

Current icon names:

- `activity`
- `agent`
- `approval`
- `branch`
- `changes`
- `chevron`
- `database`
- `file`
- `grid`
- `index`
- `play`
- `repository`
- `search`
- `settings`
- `spark`
- `user`

`IconBadge` provides the circular icon treatment for dashboard summary cards and
future workflow cards. Badge tone should come from the semantic surface:
accent, success, warning, danger, neutral, agent, or context.

## Usage Rules

- Use `Icon` for navigation, dashboard metrics, sidebar actions, and compact product cues.
- Pair icons with visible text unless the control has a strong accessible label.
- Keep icon drawing on the 24px grid.
- Use Lucide's consistent rounded stroke language for dashboard navigation, metrics, CTAs, and compact product cues.
- Use containers, not custom icon sizes, when a larger circular treatment is needed.
- Do not introduce route-local SVGs, CSS glyphs, or a second icon family for product navigation.

## Tone

Icons should feel simple, technical, and calm:

- Rounded strokes.
- Minimal detail.
- Single-color by default.
- Accent color only when supporting hierarchy or active state.
- Avoid icons in overview panel headings when the reference layout relies on clean text hierarchy.
