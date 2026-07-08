# Buttons

## Purpose

Buttons should make high-value actions obvious while keeping the workspace calm.

## Implemented Variants

### Primary Action

Used for high-contrast workflow entry points such as choosing a repository.

- Deep navy fill.
- White text.
- Fully rounded pill shape.
- Soft action shadow.
- Visible focus ring.
- Implemented as `PrimaryButton` in `packages/ui`.

### Secondary Action

Used for local actions such as starting indexing or approval decisions.

- Coral fill.
- White text.
- Rounded pill shape.
- Hover deepens the coral accent.
- Implemented as `SecondaryButton` in `packages/ui`.
- Full-width layout is opt-in through container-specific classes such as the
  sidebar upgrade card, not part of the default secondary button contract.

## Accessibility

- Native `button` elements are used.
- Disabled buttons preserve state through opacity and cursor.
- Focus-visible outlines use the accent focus ring.
- Button labels remain concise and action-oriented.
