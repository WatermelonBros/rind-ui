## MODIFIED Requirements

### Requirement: Gradients

`channelGradient(color, channel, { direction })` SHALL return a CSS `linear-gradient(...)` string for a slider
track of that channel with the other channels fixed: hue as seven stops (0, 60, …, 360 degrees at full
saturation and full brightness, or lightness 50 in an `hsl` space, whatever the colour's own saturation and
brightness: the strip shows every hue on a dark or grey colour too), lightness as three stops, every other channel as its minimum and its
maximum, alpha from the colour at alpha 0 to alpha 1. `direction` SHALL be `to right`, `to left` (RTL) or
`to top` (vertical). `areaGradient(color, xChannel, yChannel, { rtl })` SHALL return the stacked gradients
(`background-image`) of an area for the third channel fixed, with x increasing along the inline axis (towards the
left under `rtl`) and y increasing upward. Both SHALL be pure, SHALL produce stops whose colours equal the model's
colours at the stop positions, SHALL never contain `NaN`, and SHALL work for every channel a colour component
accepts, whatever the colour's own space. The area's corner colours SHALL equal the model's colours at the four
corners within 4 of 255 per sRGB channel.

#### Scenario: RTL hue strip (zag#2666)

- **WHEN** a hue gradient is requested with `direction: "to left"`
- **THEN** the first stop (hue 0) is at the right edge, so the thumb offset and the gradient agree under `dir="rtl"`

#### Scenario: Corner colours

- **WHEN** `areaGradient` is computed for `hsb(200, 50, 50)` with x `saturation`, y `brightness`
- **THEN** the bottom-left corner is black, the top-left white, the top-right `hsb(200, 100, 100)` and the
  bottom-right black

#### Scenario: Any space, any channel

- **WHEN** `channelGradient` is asked for `hue` on an `rgb` colour
- **THEN** it returns a valid hue gradient (the colour is converted internally) and does not throw

#### Scenario: Hue strip on a dark colour

- **WHEN** `channelGradient` is asked for `hue` on `#242325`
- **THEN** its stops are `hsb(0, 100, 100)`, `hsb(60, 100, 100)`, …, `hsb(360, 100, 100)` in sRGB (red, yellow,
  green, cyan, blue, magenta, red), not the near-black of the colour's own brightness
