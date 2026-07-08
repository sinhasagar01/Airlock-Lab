# Spacing

## Purpose

Spacing should make the product feel calm and spacious without slowing expert workflows.

## Implemented Scale

The desktop app defines semantic spacing tokens in `apps/desktop/src/styles.css`.

- `--space-1`: 4px
- `--space-2`: 8px
- `--space-3`: 12px
- `--space-4`: 16px
- `--space-5`: 20px
- `--space-6`: 24px
- `--space-8`: 32px
- `--space-10`: 40px
- `--space-12`: 48px

## Usage

- Sidebar and dashboard regions use larger gaps to preserve calm scan paths.
- Cards use generous internal padding for product-led overview surfaces.
- Dense file lists use smaller row spacing so indexed files remain efficient to browse.
- Status pills, extension chips, and file badges use compact spacing and stable height.
