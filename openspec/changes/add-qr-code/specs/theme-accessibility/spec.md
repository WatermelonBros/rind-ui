## MODIFIED Requirements

### Requirement: State Visible Without Colour

Every state the theme styles (selected, checked, pressed, highlighted, disabled,
invalid) SHALL have a non-colour cue (border, outline, glyph or text), and under
forced colors SHALL use system colours (`Highlight`, `HighlightText`, `GrayText`).
Indicators SHALL use `currentColor` or real glyphs, not background images.
`forced-color-adjust: none` SHALL be used only on colour swatches and on the frame of a QR
code symbol, whose function depends on dark modules on a light ground: there the theme SHALL
set explicit colours (black modules on a white ground) so that forced colors and dark
colour schemes never invert the symbol.

#### Scenario: Switch in high contrast (ARK#3421, RX#2993)

- **WHEN** a checked and an unchecked indicator are rendered with forced colors
  emulated
- **THEN** both are visible and distinguishable

#### Scenario: QR code in forced colors

- **WHEN** a QR code is rendered with forced colors emulated in a dark colour scheme
- **THEN** its modules are dark on a light ground (the symbol decodes), not light on a dark
  `Canvas`
