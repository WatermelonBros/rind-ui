## MODIFIED Requirements

### Requirement: Scales From Inputs

Spacing tokens `--rind-space-1…8` SHALL be multiples of `0.25rem ×
--rind-brand-density`; control heights `--rind-size-sm|md|lg` SHALL be
`1.75rem|2rem|2.5rem × density` and SHALL NOT compute below 24 CSS px; text tokens
`--rind-text-xs|sm|md|lg` SHALL be multiples of `--rind-brand-font-size` in `rem`;
radius tokens SHALL be `--rind-radius-sm|md|lg` (0.5×, 1×, 1.5× the base),
`--rind-radius-full`, and per family `--rind-radius-control` (md),
`--rind-radius-panel` (lg) and `--rind-radius-indicator` (sm); durations
`--rind-duration-fast|normal|slow` SHALL be `90ms|180ms|280ms × --rind-brand-motion`.

#### Scenario: Compact density keeps target size

- **WHEN** `--rind-brand-density` is `0.75` and a small control is rendered
- **THEN** its height is at least 24 CSS px

#### Scenario: Browser text size is respected (radix-ui/themes#121)

- **WHEN** the browser's default font size is set to 20 px
- **THEN** every `--rind-text-*` token scales by 1.25 relative to the 16 px default

#### Scenario: Radius zero

- **WHEN** `--rind-brand-radius` is `0`
- **THEN** every radius token except `--rind-radius-full` computes to `0`

## ADDED Requirements

### Requirement: Key Depth And Tracking Tokens

Tier 2 SHALL include `--rind-shadow-key` (a raised control: a lit top edge, a contact edge
and a short soft shadow) and `--rind-shadow-key-pressed` (the same control pressed: an inset,
no lift), both scheme-aware through `light-dark()`, and `--rind-tracking-tight` and
`--rind-tracking-label` letter-spacing tokens. Component stylesheets SHALL read them through
tier-3 tokens. No theme rule SHALL transition a colour property; a raised control MAY
transition `translate` only.

#### Scenario: Pressed key

- **WHEN** a solid Button carries `data-pressed`
- **THEN** its box shadow is `--rind-shadow-key-pressed` and it is translated 1px down

#### Scenario: Ghost key is flush

- **WHEN** a Button has `data-variant="ghost"`
- **THEN** it has no box shadow
