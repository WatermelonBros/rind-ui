# color-slider Specification

## Purpose
Defines rind-ui's Color Slider: one channel of a colour (hue, saturation, brightness, lightness, red, green, blue or
alpha) edited with a Slider whose track is the channel's gradient. The Color Slider is the `slider` capability
(`add-slider`) bound to a colour: every keyboard, pointer, drag, commit, native-input, form and ARIA rule of the Slider
applies unchanged and is not repeated here. This capability specifies the binding. Research:
`docs/research/color-picker.md`.
## Requirements
### Requirement: Anatomy

The Color Slider is a part of the Color Picker (`ColorPicker.ChannelSlider` and its `ChannelSlider*` parts, `TransparencyGrid`), not a standalone component: no package SHALL export it on its own, and it SHALL be rendered only inside a `ColorPicker.Root`. The requirements of this capability describe that part.

A Color Slider SHALL consist of `Root`, `Label`, `ValueText`, `Control`, `Track`, `Thumb` and an optional `Description`,
each rendering the Slider part of the same name (a single `Thumb`, its native `<input type="range">` inside) with the
binding below; `Control` is optional: without it `Root` is the pointer surface (a request to `add-slider`, design.md); the Slider's `Indicator` and markers are not exposed. A `TransparencyGrid` part (decorative,
`aria-hidden`, `pointer-events: none`, filling its parent) SHALL be available to draw a checkerboard under a gradient
that has transparency. Every part SHALL accept the `render` prop. The Slider's anatomy and attribute rules apply.

#### Scenario: One slider

- **WHEN** a Color Slider for `hue` is rendered with Root, Control, Track and Thumb
- **THEN** exactly one element has role `slider` and it is an `input[type=range]`

### Requirement: Channel Binding

The Color Slider SHALL take a required `channel` (`red`, `green`, `blue`, `hue`, `saturation`, `lightness`, `brightness`,
`alpha`) and follow `color-model`'s "Controlled Colour Value" (`value`, `defaultValue`, `onValueChange(color, details)`,
`onValueCommit(color, details)`, `colorSpace`). Its working space SHALL be the `colorSpace` prop, else the
space of the first colour given when that space has the channel, else `hsb` for `hue`, `saturation` and `brightness`,
`hsl` for `lightness`, `rgb` for `red`, `green` and `blue`; the emission space follows the colour the consumer passed. It SHALL drive a Slider with `min`, `max`, `step` from the
channel's range, `largeStep` its `pageStep`, `orientation`, `disabled`, `readOnly`, `name`, `form`, `dir` and `locale`,
the value being the channel value, and SHALL turn each Slider `onValueChange` into `withChannel(color, channel, value)`
and each `onValueCommit` into a colour commit. The other channels and the alpha SHALL be kept (the alpha slider keeps the colour).
The default colour (no `value`, no `defaultValue`) is `hsb(0, 100, 100)`.

#### Scenario: A channel the value lacks (zag#2389, ark#1649, react-spectrum#4561)

- **WHEN** a hue Color Slider receives `value="rgb(255, 0, 0)"` and the thumb is moved with ArrowRight
- **THEN** nothing throws, the working space is `hsb`, hue becomes 1, and `onValueChange` receives the colour as `rgb` (the space the consumer passed)

#### Scenario: Hue to the right edge stays (zag#2503)

- **WHEN** a controlled hue slider is dragged beyond the right edge while the parent re-feeds a freshly parsed sRGB
  colour each render
- **THEN** the thumb stays at the right edge (hue 360) and does not jump to the left

#### Scenario: Hue at black (react-spectrum#9509)

- **WHEN** the colour is `#000000` and the hue slider is moved to 200
- **THEN** the thumb is at 200, the track shows hue 200 as the context, and `onValueChange` is not called (the emitted
  colour is unchanged)

#### Scenario: Alpha keeps the colour (zag#884)

- **WHEN** the alpha slider of `rgb(12, 34, 56)` is moved to 0.5
- **THEN** the emitted colour is `rgb(12, 34, 56)` with alpha 0.5

#### Scenario: Step and page step

- **WHEN** PageUp is pressed on a hue slider at 100 and ArrowRight on an alpha slider at 0.5
- **THEN** hue becomes 115 and alpha 0.51

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

### Requirement: Names And Value Text

When no `Label` part is rendered and the consumer gives no name, the thumb input SHALL be named by the channel name
(`messages.channelName`). The thumb's `aria-valuetext` and the default content of `ValueText` SHALL be the Slider's value
text with the colour included through `messages.valueText`: "{channel} {value}, {colour name}" where the formatted value
is the locale format of the channel (`hue` in degrees, `saturation`/`lightness`/`brightness`/`alpha` percent, `red`,
`green`, `blue` integers); for `hue` the second part is the **hue name** only ("blue"), and for `alpha` it is omitted.
It SHALL be recomputed in the same task as the value and SHALL NOT be a live region.

#### Scenario: Unlabelled hue slider (Reado)

- **WHEN** a hue Color Slider has no Label part
- **THEN** its input is named "Hue" and `aria-valuetext` reads like "Hue 240°, blue"

#### Scenario: Saturation names the colour

- **WHEN** a saturation slider is at 90 on hue 210
- **THEN** `aria-valuetext` contains "90%" and the colour name (for example "vibrant blue")

#### Scenario: Translated

- **WHEN** `messages` replaces the channel names and colour strings
- **THEN** no accessible name or value text contains an English word

### Requirement: Slider Behaviour Is Reused

Keyboard (including RTL and vertical), pointer, track press, thumb grab, drag with capture, Escape, commit semantics,
native input adjustment, disabled and read-only, touch handling, form participation and the `data-*` attributes of the
Color Slider's parts SHALL be those of the `slider` capability. The Color Slider SHALL add `data-channel` and
`data-space` to every part and SHALL NOT change any Slider requirement. Inside a Color Picker the Color Slider SHALL be
embedded (it registers no Field control).

#### Scenario: Commit once

- **WHEN** a hue slider is dragged and released
- **THEN** `onValueChange` was called for each distinct emitted colour and `onValueCommit` exactly once

#### Scenario: Escape in a Popover

- **WHEN** a hue slider inside a Popover is dragged and Escape is pressed
- **THEN** the drag is cancelled and the Popover stays open

### Requirement: Contract

`getColorSlider` SHALL extend `getSlider` with queries `channel()`, `color(format?)`, `colorName()`, `gradient()` (the Track's
`background-image`), and actions `setChannel(value)` (as `setValue(0, value)`); traits `valued`, `directional`,
`form-associated` are the Slider's. Its invariants SHALL be the Slider's plus: the Track gradient and `--rind-color-slider-gradient`
are equal, contain no `NaN`, and equal the model's gradient for the oracle colour; `aria-valuetext` contains the channel name's
text; the thumb's `--rind-color` equals the oracle colour at the thumb.

#### Scenario: Same driver in both environments

- **WHEN** `getColorSlider(screen, { name: "Hue" }).step(0, "increase")` runs in jsdom and with `page` in Playwright
- **THEN** both resolve with `values()` equal to the oracle's

### Requirement: Theme

`color-slider.css` SHALL follow the theme convention with `--rind-color-slider-*` tokens: track height and radius, a thumb with the
same double ring as the Color Area's, a checkerboard under the track drawn from `--rind-color-checker-*` tokens shared with Color
Swatch, hit area ≥ 24 px, forced-colors rules, vertical and RTL, no transitions while dragging. Family `range`.

#### Scenario: Alpha track checkerboard

- **WHEN** an alpha Color Slider is themed
- **THEN** the checkerboard is visible through the transparent end of the gradient

