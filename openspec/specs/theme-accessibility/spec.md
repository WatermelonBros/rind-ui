# theme-accessibility Specification

## Purpose
Defines the accessibility guarantees of the optional `@rind-ui/theme` stylesheet —
visible focus that survives forced colors, non-colour state cues, minimum target size
and reduced motion — so the components can be shown accessibly and consumers have a
reference to copy.
## Requirements
### Requirement: Focus Ring

The theme SHALL draw focus on `[data-focus-visible]` as an `outline` of at least 2 CSS
px with an offset, at a contrast of at least 3:1 against the adjacent colours, and
SHALL NOT draw focus with `box-shadow` alone. The ring SHALL remain visible under
`forced-colors: active`.

#### Scenario: Forced colors (RA#5931)

- **WHEN** a focused button is rendered with forced colors emulated
- **THEN** its focus ring is visible

#### Scenario: Pointer focus

- **WHEN** a button is focused by a click
- **THEN** the theme draws no focus ring

### Requirement: State Visible Without Colour

Every state the theme styles (selected, checked, pressed, highlighted, disabled,
invalid) SHALL have a non-colour cue (border, outline, glyph or text), and under
forced colors SHALL use system colours (`Highlight`, `HighlightText`, `GrayText`).
Indicators SHALL use `currentColor` or real glyphs, not background images.
`forced-color-adjust: none` SHALL be used only on colour swatches.

#### Scenario: Switch in high contrast (ARK#3421, RX#2993)

- **WHEN** a checked and an unchecked indicator are rendered with forced colors
  emulated
- **THEN** both are visible and distinguishable

### Requirement: Target Size

Every pressable part the theme styles SHALL have a target of at least 24×24 CSS px.
Visually smaller parts SHALL extend their hit area with a pseudo-element sized by the
`--rind-hit-area` custom property instead of being resized.

#### Scenario: Small remove button

- **WHEN** a 16 px tag remove button is rendered with the theme
- **THEN** its pointer hit area is at least 24×24 CSS px

### Requirement: Motion And Hidden Content

Theme transitions and animations SHALL use duration tokens that become zero under
`prefers-reduced-motion: reduce`, SHALL skip the opening animation for content
carrying `data-reveal="find-in-page"`, and SHALL NOT override `[hidden]` with
`display: none`, which would defeat `hidden="until-found"`.

#### Scenario: Reduced motion

- **WHEN** an overlay opens with reduced motion emulated
- **THEN** no transition with a non-zero duration runs

#### Scenario: Find-in-page

- **WHEN** content rendered with `hidden="until-found"` contains the searched text
- **THEN** the theme does not prevent the browser from finding it

