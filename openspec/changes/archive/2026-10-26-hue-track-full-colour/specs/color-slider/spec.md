## MODIFIED Requirements

### Requirement: Track And Thumb Appearance

`Track` SHALL carry an inline `background-image` equal to the model's `channelGradient` for the current colour
(direction `to right`, `to left` under `dir="rtl"`, `to top` vertical) and the same string as
`--rind-color-slider-gradient`; it SHALL set `forced-color-adjust: none`. `Thumb` SHALL carry `--rind-color` (the colour
at the thumb: the channel value with the other channels as they are, opaque except for the alpha slider, which shows
the colour with the current alpha) and `forced-color-adjust: none`. The gradient and the variable SHALL change in
the same task as the value. `Track` SHALL NOT draw a checkerboard: a consumer places `TransparencyGrid` under it or the
theme draws one.

#### Scenario: Gradient follows the colour

- **WHEN** the area changes the hue of the shared colour while a saturation slider is rendered
- **THEN** the saturation slider's track gradient now uses the new hue in the same task

#### Scenario: Hue track at full colour

- **WHEN** the area changes the saturation and brightness of the shared colour while a hue slider is rendered
- **THEN** the hue slider's track gradient stays the full-colour strip; only its thumb's `--rind-color` changes

#### Scenario: Vertical (zag#3010)

- **WHEN** a vertical hue slider is pressed near its top
- **THEN** hue is near 360, the gradient direction is `to top`, and the thumb is near the top

#### Scenario: RTL (zag#2666)

- **WHEN** an alpha slider under `dir="rtl"` is pressed at its left end
- **THEN** alpha is 1, the gradient runs `to left` and the thumb is at the left
