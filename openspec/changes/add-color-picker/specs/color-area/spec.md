## Purpose

Defines rind-ui's Color Area: a two-dimensional picker for two channels of a colour (for example saturation
and brightness at a fixed hue) over a gradient, operated by pointer, keyboard, assistive-technology adjustment and,
inside the Color Picker, bound to the picker's colour. It is the 2D counterpart of Slider and is built from two
native range inputs. Research: `docs/research/color-picker.md`.

## ADDED Requirements

### Requirement: Anatomy

A Color Area SHALL consist of `Root` (a `div` with `role="group"` and the pointer surface), `Background` (a
decorative element showing the gradient) and `Thumb` (the positioned handle). `Thumb` SHALL render exactly two
native `<input type="range">` elements, the **x input** and the **y input**, in that DOM order; they are the only
elements with role `slider`. Neither `Root`, `Background` nor `Thumb` SHALL be focusable. `Background` SHALL be
`aria-hidden`. Every part SHALL accept the `render` prop and forward its element's attributes (reka-ui#2545).
`Thumb` SHALL be positioned from the value in the server render (no measuring).

#### Scenario: Two sliders, nothing else

- **WHEN** a Color Area is rendered
- **THEN** exactly two elements have role `slider`, both `input[type=range]`, and no other element inside the
  Area is focusable

#### Scenario: Server render

- **WHEN** a Color Area with `defaultValue="#336699"` is rendered on the server
- **THEN** the Thumb's position styles, both input values, `aria-valuenow` and the Background's gradient are in
  the HTML and hydration produces no warning

#### Scenario: Attributes forwarded

- **WHEN** `data-testid="area"` and a class are passed to `Root`
- **THEN** they appear on the rendered element

### Requirement: Value And Channels

The Area SHALL follow `color-model`'s "Controlled Colour Value": `value`, `defaultValue` (`string | Color`, default `hsb(0, 0, 100)`), `onValueChange(color, details)`, `onValueCommit(color,
details)`, `colorSpace` (`rgb`, `hsl` or `hsb`: the space of the axes, default the space of the first colour given, else `hsb`; the
emission space follows the colour the consumer passed), `xChannel` and `yChannel`. Defaults: `hsb` → x `saturation`, y `brightness`; `hsl` → x
`saturation`, y `lightness`; `rgb` → x `red`, y `green`. The remaining channel is the **z channel**, held constant by the
Area (and shown by the Background). `xChannel` and `yChannel` SHALL be different channels of `colorSpace`; otherwise
the Area SHALL log a development error and use the defaults. A colour given in another space SHALL be converted with
hue memory. `alpha` SHALL be kept unchanged by every Area edit and is never an axis.

#### Scenario: Defaults (HSB)

- **WHEN** an Area has no channel props and `defaultValue="hsb(200, 50, 80)"`
- **THEN** x is saturation (50), y is brightness (80), z is hue (200) and the inputs have `min`/`max` 0 and 100

#### Scenario: Hue as an axis

- **WHEN** `xChannel="hue"` and `yChannel="saturation"` are set
- **THEN** x spans 0–360, y 0–100, and the Background is drawn for the current brightness

#### Scenario: Same channel twice

- **WHEN** `xChannel="saturation"` and `yChannel="saturation"` are set
- **THEN** a development error names both props and the defaults are used

#### Scenario: Alpha untouched

- **WHEN** an Area on `hsb(10, 50, 50)` with alpha 0.3 is dragged
- **THEN** every emitted colour has alpha 0.3

#### Scenario: Controlled echo keeps hue (react-spectrum#9509)

- **WHEN** a controlled Area echoes its emitted colour back as a freshly parsed `rgb` colour while brightness is
  dragged to 0 and back up
- **THEN** the hue and saturation are as they were before the drag

### Requirement: Pointer Interaction

A primary-button mouse press, or a pen or touch press, on `Root` SHALL set both channels to the pressed position in
one write, focus the x input with pointer modality (no `data-focus-visible`) and start a drag. A press that lands on
the `Thumb` SHALL NOT move the value on press: the offset between the pointer and the thumb centre is kept for the whole
drag. Position SHALL be reported by `pointer-drag` as fractions in both axes (2D mode): x from the inline start
(mirrored under `dir="rtl"`), y from the bottom, measured on `Root` excluding padding and border; the Thumb centre
may reach every edge. Values SHALL be snapped to each channel's pointer **resolution** (`hue`, `saturation`,
`lightness`, `brightness` 0.1; `red`, `green`, `blue` 1; `alpha` not applicable), finer than the keyboard `step`.
Every move SHALL produce one write that updates both channels together. Pressing with a modifier or a non-primary
button SHALL do nothing.

#### Scenario: Press jumps (React Aria parity)

- **WHEN** the Root of a 200×100 px Area (saturation × brightness) is pressed at its top-right corner
- **THEN** saturation is 100 and brightness 100, in one `onValueChange`

#### Scenario: Grab the thumb

- **WHEN** the thumb is pressed 6 px right of its centre and dragged 10 px right
- **THEN** the thumb centre moved by exactly 10 px and no value change happened on press

#### Scenario: No jitter on a large area (react-spectrum#7553)

- **WHEN** a 360 px wide Area (saturation) is dragged one pixel at a time
- **THEN** saturation changes by about 0.28 per pixel and the thumb moves one pixel per move, not in steps of 3.6 px

#### Scenario: One write for two axes (kobalte#592)

- **WHEN** the Root is pressed at a point where both channels change
- **THEN** `onValueChange` is called exactly once

#### Scenario: RTL

- **WHEN** an Area under `dir="rtl"` is pressed 30 px from its right edge (width 300)
- **THEN** the x channel is at 10 % of its range

### Requirement: Drag Lifecycle

A drag SHALL capture the pointer on `Root`, SHALL keep working when the pointer leaves `Root` and the viewport, and SHALL
end on `pointerup`, `pointercancel`, lost capture or a release outside the document, all handled by `pointer-drag`;
a move with no buttons pressed SHALL end the drag as a release. A drag SHALL end without requiring a move (a tap or
double tap leaves no stuck state). Escape SHALL be handled only while dragging: it cancels the drag, restores both
channels to their values at the press, calls no commit, and calls `preventDefault` (the layer stack ignores a handled Escape); outside a drag Escape SHALL be left
unhandled so an enclosing Dialog or Popover closes. While dragging, text selection SHALL be disabled.

#### Scenario: Escape while dragging, in a Dialog (react-spectrum#2252)

- **WHEN** an Area inside a Dialog is dragged and Escape is pressed, then Escape is pressed again
- **THEN** the first Escape restores the colour at the press and the Dialog stays open; the second closes the Dialog

#### Scenario: Release outside the window

- **WHEN** the pointer is released outside the browser window after a drag
- **THEN** the drag ended and a commit was reported once

#### Scenario: Double tap leaves no stuck state (react-spectrum#2814)

- **WHEN** the Thumb is tapped twice without moving on a touch device
- **THEN** `data-dragging` is absent after each tap and the next press works

#### Scenario: Drag ends outside a popover (react-spectrum#3994)

- **WHEN** an Area inside a Popover is dragged and released outside the popover
- **THEN** the popover stays open

### Requirement: Keyboard Interaction

On either input the Area SHALL handle, through the logical keys of `keyboard-interactions`: Left/Right (mirrored under
`dir="rtl"`) change the x channel by one `step` (the model's channel step) and Up/Down the y channel (Up
increases); with Shift the change is the channel's `pageStep`; PageUp and PageDown change the y channel by its
`pageStep`; Home and End set the x channel to its minimum and maximum (value keys, not mirrored, as Slider). Each
handled key SHALL call `preventDefault` and each step SHALL be one write. When the channel that changed is the other
axis's, focus SHALL move to that axis's input (keyboard modality) in the same task, so assistive technology reads the
changed value; a step on the focused axis SHALL NOT blur or re-focus anything. Key repeat SHALL produce a step each.
Keys SHALL do nothing when disabled or read-only. Tab SHALL leave the Area: the Area is **one tab stop**, the input that was
focused last (the x input initially) having no `tabindex` and the other `tabindex="-1"`.

#### Scenario: Arrows (RTL)

- **WHEN** ArrowRight is pressed on the x input under `dir="rtl"`
- **THEN** the x channel decreases by one step

#### Scenario: Vertical key moves focus to the y input

- **WHEN** ArrowUp is pressed while the x input is focused
- **THEN** brightness increases by one step, the y input is focused and the x input has `tabindex="-1"`

#### Scenario: Same-axis steps do not blur (BU#5296 class)

- **WHEN** ArrowRight is pressed three times on the focused x input
- **THEN** no `blur` or `focus` event was dispatched on either input

#### Scenario: Shift and PageUp

- **WHEN** Shift+ArrowRight is pressed on a saturation x axis, and PageUp on the y input
- **THEN** saturation changes by 10 and brightness by 10

#### Scenario: Shift+Tab from the y input leaves the Area

- **WHEN** the y input is focused and Shift+Tab is pressed
- **THEN** focus leaves the Area to the previous tab stop, not to the x input

#### Scenario: Home and End

- **WHEN** Home and then End are pressed on a hue x axis
- **THEN** hue becomes 0 then 360

### Requirement: ARIA Semantics And Names

`Root` SHALL be named by the consumer's `aria-label` or `aria-labelledby`, else by `messages.areaLabel` (default "Color
area"). Each input SHALL be named `messages.inputLabel({ group, channel })` (default: the group name followed by the
channel name, "Fill Saturation"; just the channel name when the group name is the default), unless the consumer gives
the input its own label. Each input SHALL have `aria-valuenow`, `aria-valuemin`, `aria-valuemax` (its channel's range),
`aria-valuetext` (below), `aria-orientation` (`horizontal` for x, `vertical` for y), `aria-roledescription`
from `messages.roleDescription` (default "2D slider"), `aria-readonly` when read-only, and the consumer's
`aria-describedby`. The inputs SHALL NOT be `aria-hidden`.

#### Scenario: Names

- **WHEN** a Color Area has `aria-label="Fill"` and x saturation, y brightness
- **THEN** the inputs are named "Fill Saturation" and "Fill Brightness" and are `horizontal` and `vertical`

#### Scenario: Translated

- **WHEN** `messages` replaces `areaLabel`, `inputLabel`, `roleDescription` and the colour names
- **THEN** no accessible name, role description or value text contains an English word

### Requirement: Value Text

`aria-valuetext` of each input SHALL be built from `messages.valueText({ channels, colorName })`: when the Area has just
received focus and nothing was changed since (by keyboard, native adjustment or pointer), `channels` lists the focused
input's channel, the other axis and the z channel, with locale-formatted values (`hue` in degrees, saturation,
lightness, brightness and alpha in percent, `red`, `green` and `blue` as integers), followed by the colour name; after a
change it lists only the changed channel and the colour name. The default is "Saturation 92%, vibrant blue" style text
joined by commas. The text SHALL NOT be a live region. The colour name SHALL be computed with `colorName` (the
`color-model` rules, the component's `locale`, `messages` and optional `colorName` prop) of the opaque colour.

#### Scenario: First announcement lists the colour (react-spectrum#4110)

- **WHEN** the x input receives focus on `hsb(220, 80, 60)`
- **THEN** its `aria-valuetext` names saturation 80%, brightness 60%, hue 220° and the colour name

#### Scenario: Then only the change

- **WHEN** ArrowRight changes saturation from 80% to 81%
- **THEN** the x input's `aria-valuetext` names saturation 81% and the colour name, not the other channels

#### Scenario: Not live

- **WHEN** the value changes
- **THEN** no element of the Area has `aria-live` or a live-region role

### Requirement: Commit

`onValueCommit(color, details)` SHALL be called exactly once at the end of each interaction that changed the emitted
colour: each keyboard step, each assistive-technology adjustment, and each pointer release whose emitted colour differs
from the one at the press (including a tap with no move). It SHALL receive the latest colour and `details.reason`, and
SHALL NOT be called for a cancelled drag, a refused change, a programmatic or controlled change, a form reset, or a
change that did not alter the emitted colour.

#### Scenario: Tap commits once (react-spectrum#2247, #2250)

- **WHEN** the Root is tapped in StrictMode and in a controlled parent that formats the value as a string
- **THEN** `onValueChange` and `onValueCommit` are each called once

#### Scenario: Cancelled drag

- **WHEN** a drag is cancelled with Escape
- **THEN** `onValueCommit` is not called and the colour equals the one at the press

### Requirement: Assistive Technology Adjustment

A change event on an input that no key or pointer step of ours caused (VoiceOver, TalkBack, NVDA adjusting a range input,
form autofill) SHALL be applied to that axis's channel (clamped, snapped to `step`) as a keyboard-equivalent change with a
commit. A value the Area refuses (read-only, disabled, cancelled) SHALL be re-synchronised into the input within the same
task. The inputs follow the accessible-native-input rule of `hidden-form-input`.

#### Scenario: Native adjust

- **WHEN** the x input's value is set to 70 with `input` and `change` events and no key events
- **THEN** the x channel is 70, `onValueChange` and `onValueCommit` are called once, and `aria-valuenow` is 70

#### Scenario: Read-only refuses

- **WHEN** the same happens on a read-only Area
- **THEN** the input value returns to its previous value and no callback runs

### Requirement: Direction, Touch And Forced Colors

`Root` SHALL set `touch-action: none` and `user-select: none`, and the Thumb `touch-action: none`, so a touch drag does not
scroll the page. `Background` and `Thumb` SHALL set `forced-color-adjust: none` (the gradient is the content). The x axis
SHALL mirror under `dir="rtl"` (x increases towards the left): the gradient, the thumb position and the pointer
fractions SHALL agree (zag#2666). Auto-scrolling while dragging is not provided.

#### Scenario: Touch drag does not scroll

- **WHEN** a touch drag starts on the Root inside a scrollable page
- **THEN** the page does not scroll and the value follows the finger

#### Scenario: Gradient and thumb agree in RTL

- **WHEN** the x channel is at its maximum under `dir="rtl"`
- **THEN** the thumb is at the left edge and the corner colour of the Background there is the maximum-x colour

### Requirement: Disabled And Read-Only

When `disabled` the inputs SHALL be `disabled`, the Root SHALL ignore presses and every part carry `data-disabled`. When
`readOnly` the Area SHALL stay focusable and presses SHALL focus the x input but change nothing; keys and native
adjustments SHALL do nothing; the inputs SHALL carry `aria-readonly="true"`. Disabling mid-drag SHALL cancel the drag as
`pointercancel` does.

#### Scenario: Disabled mid-drag

- **WHEN** `disabled` becomes true during a drag
- **THEN** the colour returns to the value at the press and no commit is reported

### Requirement: Form Participation

The inputs SHALL carry `name` from `xName` and `yName`, `form` from the `form` prop, and `disabled`; with no names they
SHALL submit nothing. Their `value` property SHALL mirror the channel values (`hidden-form-input`: property sync, creation
default as content attribute, user-change-only `input` and `change`). A form reset SHALL restore the current `defaultValue`
without a commit. The channel values submitted are the numbers of the Area's `colorSpace` channels.

#### Scenario: Channel values submitted

- **WHEN** a form has `xName="s"` and `yName="b"` on an Area at saturation 50 and brightness 80
- **THEN** the form data contains `s=50` and `b=80`

#### Scenario: Reset

- **WHEN** the user drags the Area and the form is reset
- **THEN** the colour is the `defaultValue`, the inputs and thumb follow, and no callback runs

### Requirement: Data Attributes And Variables

`Root`, `Background` and `Thumb` SHALL carry `data-disabled`, `data-readonly` and `data-dragging` while applicable; `Root` and `Thumb`
`data-focus` and `data-focus-visible` for focus of either input. `Root` SHALL carry the CSS variable `--rind-color` (the current
colour, CSS string) and `--rind-color-opaque`; `Background` the inline `background-image` from the model's `areaGradient`
(also as `--rind-color-area-gradient`); `Thumb` the variables `--rind-color-area-x` and `--rind-color-area-y` (percent from the
left/right and from the bottom, mirrored under RTL) and `--rind-color` (the opaque colour under it). The values SHALL be finite. `data-variant`,
`data-size` and `data-tone` SHALL pass through untouched.

#### Scenario: Variables

- **WHEN** saturation is 50 and brightness 25
- **THEN** the Thumb has `--rind-color-area-x: 50` and `--rind-color-area-y: 25` (LTR)

### Requirement: Contract

The Color Area contract SHALL locate an instance by role `group` and its name, and SHALL declare:

- actions `focusAxis("x" | "y")`; `step(axis, "increase" | "decrease", { large? })`; `toEdge(axis, "min" | "max")`;
  `setChannels({ x?, y? })` (keyboard: key presses; pointer: a drag of the thumb); `pressAt({ x, y })` as fractions of
  the surface (pointer; keyboard twin: steps); `pointerDown`, `pointerMove`, `pointerUp` (pointer and touch; keyboard `none`
  with the reason "dragging is pointer-only; `step` is the 2.5.7 alternative"); `cancelDrag()` (Escape);
  `adjustNative(axis, value)`; `resetForm()`;
- queries `channels()` (`{ x: { channel, value }, y: …, z: … }`), `color(format?)`, `valueText(axis)`, `colorName()`,
  `focusedAxis()`, `isDragging()`, `formValues()`;
- traits `directional` and `form-associated` (properties compared: each input's `value`);
- observations `idle` and `dragging`.

Pointer actions SHALL fail with a message saying they need layout when the environment reports no geometry.

#### Scenario: Same driver in both environments

- **WHEN** `getColorArea(screen, { name: "Fill" }).step("x", "increase")` runs in jsdom and with `page` in Playwright
- **THEN** both resolve with `channels().x.value` increased by one step

#### Scenario: Pointer without layout

- **WHEN** `pressAt({ x: 0.5, y: 0.5 })` runs in jsdom
- **THEN** it rejects naming `pressAt`, `pointer` and the missing layout

### Requirement: Color Area Invariants

The contract SHALL ship invariants checked after every model step: each input's `value` property equals its `aria-valuenow`
and the oracle's channel value; the `min`/`max` of each input equal its channel range; exactly two `slider` elements, one
focusable by Tab; the Thumb's position variables equal the channels' fractions; no inline style or variable contains `NaN`;
`aria-valuetext` of the focused input contains the colour name; no `blur`/`focus` event on an input during a same-axis key
step; and `onValueChange`/`onValueCommit` were called exactly as often as the oracle's changing and committing steps.

#### Scenario: Broken wrapper

- **WHEN** a consumer wrapper adds `tabindex="0"` to the y input
- **THEN** the invariant fails naming the extra tab stop

### Requirement: Theme

`color-area.css` SHALL follow the theme convention (`@layer rind.components`, `:where()` selectors, `--rind-color-area-*` tier-3
tokens read with fallbacks and never declared): size (`--rind-color-area-size`, default `12rem` square, resizable), radius, the
thumb (`--rind-color-area-thumb-size` ≥ 24 px hit area through a pseudo-element, a 2 px `Canvas` ring and a 1 px `CanvasText` outer
ring so it reads on any gradient at 3:1), focus ring from the base, `[data-dragging]` without transitions, forced-colors rules
(thumb rings in system colours, gradient untouched), `data-variant` `solid` (bordered) / `soft`, `data-size`, `data-tone="danger"`
(border only). Family `range`.

#### Scenario: Thumb contrast

- **WHEN** the Area is rendered on a white corner and on a black corner of the gradient
- **THEN** the thumb's rings keep 3:1 against the gradient at both points

#### Scenario: Forced colors

- **WHEN** the Area is rendered with `forced-colors: active`
- **THEN** the gradient keeps its colours and the thumb is outlined in `CanvasText` and `Canvas`
