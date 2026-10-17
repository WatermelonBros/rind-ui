# color-picker Specification

## Purpose
Defines rind-ui's Color Picker: a trigger and a popover (or an inline panel) holding a colour area, channel sliders, channel and
hex inputs, swatches, an eye dropper and a format switch, all bound to one colour value. The picker owns the colour, the display
format and the open state and drives the Popover, Color Area, Color Slider, Color Field, Color Channel Field and Color Swatch Picker as bound
children. It reuses their behaviour and does not repeat it. Research: `docs/research/color-picker.md`.
## Requirements
### Requirement: Anatomy

A Color Picker SHALL consist of `Root` (a Field host: not inside a Field it acts as one; inside one it registers as the control),
`Label`, `Control` (`role="group"`, the Popover's anchor), `Trigger` (a button), `Portal`, `Positioner`, `Content`, `Area`,
`AreaBackground`, `AreaThumb`, `ChannelSlider` (with `ChannelSliderLabel`, `ChannelSliderValueText`, `ChannelSliderTrack`,
`ChannelSliderThumb`), `ChannelInput`, `EyeDropperTrigger`, `SwatchGroup`, `SwatchTrigger`, `SwatchIndicator`, `Swatch`, `ValueSwatch`,
`FormatSelect`, `FormatTrigger`, `View`, `ValueText`, `HiddenInput`, `TransparencyGrid`, and optional `Description` and `ErrorMessage`.
`Area*` are the Color Area's parts, `ChannelSlider*` the Color Slider's (the `ChannelSlider` is the slider's `Root`, the pointer surface), `ChannelInput` the Color Field or
Color Channel Field chosen by its `channel`, `SwatchGroup`, `SwatchTrigger` and `SwatchIndicator` the Color Swatch Picker's `Root`, `Item` and
`Indicator`, `Swatch` and `ValueSwatch` the Color Swatch, `Portal`, `Positioner`, `Content` the Popover's. Every part SHALL accept the `render` prop
(ark#1922) and forward its element's attributes. Children bound to the picker SHALL NOT take their own `value`.

#### Scenario: Reado's anatomy

- **WHEN** a picker is rendered with `Content`, `ValueText`, `Area` (`AreaBackground`, `AreaThumb`) and two `ChannelSlider`s (`hue`, `alpha`), each with `ChannelSliderTrack` and
  `ChannelSliderThumb`
- **THEN** it renders without a Trigger, shows the area, both sliders and the value text, and every slider is operable

#### Scenario: `render` on every part

- **WHEN** each part is rendered with `render={<span />}` or another element
- **THEN** it behaves the same and no part throws (ark#1922)

### Requirement: Value, Format And Emission

The picker SHALL take `value` and `defaultValue` (`string | Color`, default `#000000`), `onValueChange(color, details)` and `onValueCommit(color, details)`,
following `color-model`'s "Controlled Colour Value". `details` SHALL carry `reason` (`AREA`, `SLIDER`, `INPUT`, `SWATCH`, `EYEDROPPER`, `RESET`, `ADOPT`), `valueAsString`
(the colour in the current `format`), `channel` when one input or slider changed it, and `cancel()`. The display and emission **format**
SHALL be controllable (`format`, `defaultFormat`, `onFormatChange(format)`) and one of `hex`, `rgb`, `hsl`, `hsb`; the default follows the first colour given
(a hex string gives `hex`, an `rgb`/`hsl`/`hsb` colour or string its space) and is `hex` when none is given. The emission space SHALL be the space of
`format` (`hex` and `rgb` emit `rgb`), whatever the colour the consumer passed; the picker SHALL keep its internal colour in the space of the last edit with
hue and saturation memory. `ValueText` SHALL show `formatColor(color, format)`. A format change SHALL NOT call `onValueChange`; the next change is emitted in the new space,
and `ValueText`, `ChannelInput`s' formats and `View` update in the same task. The value is never `null`.

#### Scenario: Value in any space, format independent (zag#2894, ark#1649)

- **WHEN** a controlled picker receives `value="hsl(210, 60%, 40%)"` with `format="rgb"` and the red channel input is committed
- **THEN** nothing throws, the area, sliders and every input show the colour, and `onValueChange` receives an `rgb` colour

#### Scenario: Echo of a fresh sRGB object (Reado, zag#2503)

- **WHEN** a controlled picker with `format="rgb"` is re-rendered after each change with `value={parseColor("rgba(…)")}` of the emitted colour (a new
  object each time) while the hue slider is dragged to the right edge and the area is dragged to black and back
- **THEN** hue, saturation and thumb positions stay continuous and `onValueChange` runs once per distinct emitted colour

#### Scenario: Format change does not emit

- **WHEN** the format is switched from `hex` to `hsl`
- **THEN** `onFormatChange("hsl")` ran, `ValueText` shows an `hsl(...)` string, and `onValueChange` was not called

#### Scenario: One change per gesture (kobalte#592, react-spectrum#2247)

- **WHEN** the area is pressed once
- **THEN** `onValueChange` and `onValueCommit` each ran once for the picker (not once per axis or per child)

### Requirement: Commit Path

A change from the area, a slider, a channel or hex input, a swatch, the eye dropper, a form reset or autofill adoption SHALL pass through one commit
path in the picker; every child SHALL be controlled by it (their own `onValueChange` is an event to the picker). A `cancel()` from the consumer
SHALL keep the previous colour in every child. A controlled change SHALL update all children and call no callback. `onValueCommit(color, details)` SHALL be
called once at the end of each interaction (drag release, key step, committed input, swatch pick, eye-dropper result) that changed the emitted colour.

#### Scenario: Cancel keeps all views

- **WHEN** `onValueChange` cancels a swatch pick
- **THEN** area, sliders, inputs, hidden input and `ValueText` keep the previous colour

#### Scenario: Slider reaches the area and back

- **WHEN** the hue slider moves and then the hex input commits `#00FF00`
- **THEN** the area background and thumb follow each change and the hue slider shows the green hue

### Requirement: Open State, Popover And Reasons

Unless `inline`, the picker SHALL use the Popover (`add-popover`) as a controlled child, re-scoped to `color-picker`: `open`, `defaultOpen`,
`onOpenChange(open, details)` with the Popover's close reasons plus `"select"` (a swatch pick with `closeOnSelect`), `modal`, `positioning`, `initialFocus`,
`persistentElements`, `disabled`. It SHALL be non-modal by default; Trigger press, Enter and Space open it; Escape, an outside press and outside focus close it through the layer
stack, each vetoable; focus enters the content after the first placement and returns to the Trigger on every close path; a press that follows a drag which began inside
the content SHALL NOT dismiss it. A controlled `open` refused by the parent leaves the content unrendered. A programmatic `open` change calls no callback.

#### Scenario: In a Dialog, repeatedly (zag#3043, zag#3067, ark#3414)

- **WHEN** a picker inside a Dialog is opened, dismissed with an outside press, opened and dismissed again, then opened and the empty space of the content is clicked
- **THEN** the picker closes on each outside press, stays open for the click inside, and the Dialog stays open throughout

#### Scenario: Drag released outside (react-spectrum#3994)

- **WHEN** the hue slider is dragged and released outside the content
- **THEN** the picker stays open

#### Scenario: Close on select

- **WHEN** `closeOnSelect` is set and a swatch is picked
- **THEN** `onValueChange` ran once, `onOpenChange(false, { reason: "select" })` once, and focus is on the Trigger

#### Scenario: Controlled refusal

- **WHEN** a controlled `open={false}` picker's Trigger is pressed and the parent does not set `open`
- **THEN** `onOpenChange(true, …)` ran once and the Content is not rendered

### Requirement: Inline Mode

With `inline` the picker SHALL render `Content` in place, always, with no Popover, no layer, no positioning, no focus management, no `role="dialog"`, no
outside-press or Escape handling and no `aria-haspopup`; `Trigger`, `Portal`, `Positioner` and `open` SHALL be ignored (a Trigger renders nothing, with a development
warning). Escape and outside presses SHALL be left to the host (they are not handled and not default-prevented, except by a child that has its own
Escape rule: a drag, a dirty draft). `Content` SHALL carry `role="group"` named like the Control, so the picker has one named group.
Inline mode SHALL install no document listeners while no drag is active.

#### Scenario: Reado's panel

- **WHEN** a picker with `inline` is rendered in a host that closes itself on Escape and outside mousedown
- **THEN** the Content is visible immediately, no layer is pushed, no inert or scroll lock is applied, and Escape reaches the host's listener

#### Scenario: Nothing installed while idle

- **WHEN** an inline picker is idle
- **THEN** no listener is registered on `document` or `window` by the picker

### Requirement: Trigger, Control And Labelling

`Control` SHALL be `role="group"` labelled by the `Label`. `Trigger` SHALL be a button-like element with `aria-haspopup="dialog"`, `aria-expanded`,
`aria-controls` while the content is mounted, and the accessible name `aria-labelledby="<self> <label>"` with `aria-label` from `messages.trigger({ colorName })`
(default "Choose color, vibrant blue"); a `ValueSwatch` inside the Trigger SHALL be decorative (`aria-hidden`) since the name carries the colour; a pointer press on `Label` SHALL focus the Trigger (the hex
`ChannelInput` when inline) with pointer modality. `Content` SHALL be named by a consumer name, else `aria-labelledby="<trigger> <label>"`, with the Popover's modal rules
(a modal picker without a name source logs a development error). `Description` and `ErrorMessage` SHALL be wired as `control-label` and `field-control` specify.

#### Scenario: Trigger name

- **WHEN** a picker with a Label "Background" and colour `#FF0000` is rendered
- **THEN** the Trigger's accessible name contains "Choose color", "vibrant red" and "Background", and the dialog is named by the same sources

#### Scenario: Label press

- **WHEN** the Label is pressed with a mouse
- **THEN** the Trigger is focused without `data-focus-visible`

#### Scenario: Translated

- **WHEN** `messages` replaces `trigger`, the colour strings and the channel names
- **THEN** no accessible name, `aria-valuetext` or role description inside the picker contains an English default

### Requirement: Flush Before Close

When the picker closes (outside press, outside focus, `api`, `select`), every `ChannelInput` and hex field in its Content SHALL flush its draft first: a valid pending draft
commits (so `onValueChange` runs before `onOpenChange(false)`), an invalid or empty one is discarded. An Escape with a dirty draft SHALL revert the text and leave the picker open (`color-field`); the next
Escape closes it. Focus restore SHALL happen after the flush.

#### Scenario: Typed hex survives an outside press (react-spectrum#9748)

- **WHEN** the user types `111111` into the hex input and presses outside the popover
- **THEN** `onValueChange` ran with `#111111` before `onOpenChange(false)`, and the Trigger's colour is `#111111`

#### Scenario: Emptied input does not make the colour transparent (react-spectrum#6363)

- **WHEN** the hex input is cleared and the picker is closed
- **THEN** the colour is unchanged and opaque

#### Scenario: Escape layers

- **WHEN** the hex input has an uncommitted edit and Escape is pressed twice
- **THEN** the first restores the text and keeps the picker open, the second closes it

### Requirement: Channel Inputs

`ChannelInput` SHALL take `channel` (a colour channel, `hex` or `css`). `hex` and `css` render a Color Field (`format` `hex` or `css`; `alpha` when the picker's colour has alpha below 1 or an `alpha` prop is set);
a colour channel renders a Color Channel Field. The inputs SHALL be embedded (no Field registration, no Label of their own: the consumer labels each with `aria-label` or a `Label` part; the
default name is the channel name from `messages`). A channel the picker's colour lacks SHALL resolve through conversion in any format; every input SHALL clamp from the model's range.
Committing a hex input with 6 digits SHALL keep the alpha (zag#884). Inputs SHALL commit on Enter and blur and SHALL emit through the commit path with `details.channel`.

#### Scenario: Any channel in any format (zag#1567, ark#1649)

- **WHEN** a `format="rgb"` picker has `hue`, `saturation`, `brightness` and `red` inputs and `999` is committed in each
- **THEN** each clamps to its range, none throws, and the others update

#### Scenario: Alpha survives (zag#884)

- **WHEN** the alpha is 0.5 and the hex input commits `00FF00` and then blurs
- **THEN** the alpha is still 0.5

### Requirement: Eye Dropper

`EyeDropperTrigger` SHALL be a button named by `messages.eyeDropper` (default "Pick a color from the screen") that, when `window.EyeDropper` exists, opens it on press, and sets the picked
colour (opaque, alpha 1; zag#2782) through the commit path with reason `EYEDROPPER`, then announces `messages.picked({ colorName })` politely. A dismissed dropper (`AbortError`) or an error SHALL change
nothing and report nothing. Where `window.EyeDropper` is absent the part SHALL render with `hidden` (server and first client render alike, so hydration matches) and SHALL stay
hidden; where present it SHALL be un-hidden after mount. It SHALL be disabled with the picker, and never a dead control (ark#2764). The test environment SHALL be able to inject a fake `EyeDropper`.

#### Scenario: Unsupported browser (ark#2764)

- **WHEN** the picker is rendered in a browser without `EyeDropper`
- **THEN** the EyeDropperTrigger is `hidden` and not reachable by Tab or by assistive technology

#### Scenario: Picked colour is opaque (zag#2782)

- **WHEN** a fake dropper resolves `#336699` while the colour has alpha 0.4
- **THEN** the colour becomes `#336699` with alpha 1 and a polite announcement names it

#### Scenario: Dismissed

- **WHEN** the fake dropper rejects with `AbortError`
- **THEN** the colour is unchanged and no callback ran

### Requirement: Format Controls And View

`FormatSelect` SHALL render a native `<select>` named `messages.format` (default "Color format") with the options `hex`, `rgb`, `hsl`, `hsb` labelled from `messages`, bound to `format`;
a change SHALL set the format. `FormatTrigger` SHALL be a button that cycles `hex → rgb → hsl → hsb`, named `messages.formatTrigger({ current, next })`, and SHALL announce the new format politely.
`View` SHALL render its children only while the picker's `format` equals its `format` prop and SHALL carry `data-format`; it SHALL render the same on the server and the client.

#### Scenario: Select

- **WHEN** the user picks "HSL" in the FormatSelect
- **THEN** `format` is `hsl`, only the `View format="hsl"` children render, and the select shows HSL

#### Scenario: Cycle and announce

- **WHEN** the FormatTrigger is pressed at `hsb`
- **THEN** the format is `hex` and a polite announcement says so

### Requirement: Swatches

`SwatchGroup`, `SwatchTrigger` and `SwatchIndicator` SHALL be the Color Swatch Picker's, bound to the picker's colour (checked when the colour matches, no item checked when nothing matches,
arrow keys move and check, pressing sets the colour with reason `SWATCH`). `Swatch` SHALL be the Color Swatch; `ValueSwatch` the Color Swatch bound to the current colour. A swatch pick SHALL keep the alpha of
the current colour unless the swatch has alpha below 1. `closeOnSelect` (default false) closes the Popover after a pick.

#### Scenario: Pick keeps alpha

- **WHEN** the colour has alpha 0.5 and an opaque swatch is picked
- **THEN** the colour becomes the swatch's colour with alpha 0.5 and `SwatchGroup` shows it checked

#### Scenario: No match

- **WHEN** the colour matches no swatch
- **THEN** no swatch is checked and the first enabled swatch is the tab stop

### Requirement: Form Participation

The Root SHALL render a hidden input automatically (`HiddenInput` positions it, replacing the automatic one) following `hidden-form-input`, carrying `name`, `form`, `disabled`, the `required`
flag as `data-required` only, and mirroring the colour as its `value` in the canonical form `#RRGGBB` (`#RRGGBBAA` when alpha is below 1), independent of the display `format`, unless `formFormat`
(`hex`, `rgb`, `hsl`, `hsb`, `css`) says otherwise. It SHALL be the Field's validity element. A form reset SHALL restore the current `defaultValue` with reason `RESET` and no commit. A native change not made by the picker
(autofill) SHALL be adopted when it parses. The hidden input SHALL never receive focus.

#### Scenario: Stable submission

- **WHEN** the format is switched to `hsl` and the form is submitted
- **THEN** the form data still contains `fill=#3366FF` (canonical hex)

#### Scenario: Reset

- **WHEN** the user changes the colour and the form is reset
- **THEN** the picker shows `defaultValue` in every child and no callback ran

### Requirement: Field Control Binding

The Root SHALL register once with an enclosing Field as one control (the Trigger, or the first `ChannelInput` hex field when inline, as focus target and labelable element; the hidden input as validity
element), the Field's ARIA going on that element. Every child of the picker (area, sliders, inputs, swatches) SHALL be embedded and SHALL NOT register or receive Field wiring.
Disabled, read-only and invalid flags SHALL be OR-merged with the Field's and an enclosing Fieldset's and passed to every child.

#### Scenario: One control

- **WHEN** a picker with area, two sliders, two inputs and swatches is inside a Field
- **THEN** no development warning about a second control is logged and only the Trigger carries the Field's `aria-describedby`

### Requirement: Disabled, Read-Only

`disabled` SHALL disable the Trigger, the eye dropper, the format controls and every child and close the Popover. `readOnly` SHALL keep the Trigger focusable with `aria-disabled="true"` and not open the Popover;
inline, every child is read-only (focusable, no change).

#### Scenario: Disabled while open

- **WHEN** `disabled` becomes true while the content is open
- **THEN** the content closes with reason `api` and focus returns to the Trigger

### Requirement: Announcements

Value changes by pointer, keyboard, typing, swatch or format SHALL NOT be announced by the picker (native sliders and fields speak for themselves; value text is not a live region). The eye-dropper result and a
format switch through `FormatTrigger` SHALL be announced politely through the announcer, once, with `messages`.

#### Scenario: No live regions

- **WHEN** the colour changes by area drag
- **THEN** no element of the picker has `aria-live` and the announcer received nothing

### Requirement: Data Attributes

`Root`, `Control`, `Trigger`, `Content` SHALL carry `data-disabled`, `data-readonly`, `data-invalid` and `data-focus`/`data-focus-visible` as applicable; `Root` `data-dragging` while any child
drags, `data-inline` in inline mode, `data-format`, and the variables `--rind-color` (the colour as a CSS string) and `--rind-color-opaque`; `Trigger` and `Content` the Popover's `data-state`
(`open`, `closed`), `data-side`, `data-align` and positioning variables; `View` `data-format`. Parts of children carry their own attributes. `data-variant`, `data-size` and `data-tone` SHALL pass through untouched.

#### Scenario: Colour variable

- **WHEN** the colour is `#336699`
- **THEN** `Root` has `--rind-color` equal to a CSS string of that colour

### Requirement: Messages

The picker SHALL export typed `messages` with English defaults for: `trigger`, `dialogLabel` (default "Choose a color"), `eyeDropper`, `picked`, `format`, `formatOptions`, `formatTrigger`, and re-export the
children's (`areaLabel`, `inputLabel`, `roleDescription`, `valueText`, `channelName`, `swatch`, `transparent`, `swatchPickerLabel`, `invalid`) and the colour-name strings, overridable per component or provider.

#### Scenario: Pseudo-locale

- **WHEN** every message is replaced by a pseudo-localised value
- **THEN** no accessible name, description, role description, value text or announcement contains an English default

### Requirement: Contract

The Color Picker contract SHALL locate an instance by role `group` (the Control, or the Content when inline) and its name, and SHALL declare:

- actions `open()` (pointer: press the Trigger; keyboard: Tab to it, Enter), `close()` (Escape), `pressOutside()`, `tab()`, `shiftTab()`; `area()`, `slider(channel)`, `input(channel)`, `swatches()` returning the children's drivers
  scoped to the picker; `pickSwatch(key | name | index)`; `setFormat(format)`; `eyeDropper(result | "abort")` (injects a fake `EyeDropper`); `resetForm()`;
- queries `color(format?)`, `format()`, `valueText()`, `colorName()`, `isOpen()`, `isModal()`, `isInline()`, `closeReason()`, `formValue()`, `focusedPart()`, `isEyeDropperAvailable()`;
- traits `form-associated`, `field-associated`, and (not inline) `layer`, `restores-focus`, `presence`, `anchored`, plus `modal` by prop.

#### Scenario: Same driver in both environments

- **WHEN** `getColorPicker(screen, { name: "Fill" }).open()` then `.input("hex").fill("3366ff")` run in jsdom and with `page` in Playwright
- **THEN** both resolve with `color("hex")` equal to `#3366FF`

#### Scenario: Pointer needs layout

- **WHEN** `area().pressAt({ x: 0.5, y: 0.5 })` runs in jsdom
- **THEN** it rejects naming the missing layout; `area().step(…)` works

### Requirement: Color Picker Invariants

The contract SHALL ship invariants checked after every model step, in addition to the children's: every child (area inputs, slider inputs, channel inputs, swatch check, `ValueText`, `ValueSwatch`) agrees with the oracle colour; the hidden input equals the canonical string of the
oracle colour; `FormatSelect`'s value and `View`'s rendered children match `format`; `aria-expanded` equals the open state; in inline mode no layer, inert, scroll lock or document listener exists while idle; the picker's
`onValueChange` count equals the oracle's changing steps; and no `NaN` in any style or variable.

#### Scenario: Broken wrapper

- **WHEN** a wrapper renders a second `ColorPicker.Area` with its own `value`
- **THEN** the invariant (or the development error for a bound child with its own `value`) fails naming it

### Requirement: Theme

`color-picker.css` SHALL follow the theme convention with `--rind-color-picker-*` tokens: the Control and Trigger from the `field` family (outline and soft) with a leading `ValueSwatch` slot, the Content from the
`panel` family (width `--rind-color-picker-width`, default 15rem; padding; spacing between controls from `--rind-space-*`), `@starting-style` entry and `[data-state=closed]` exit, small-screen max-height
from `--rind-available-height`, hex/channel inputs laid out as a row, the eye-dropper and format controls as ghost action buttons, forced-colors rules, `data-tone="danger"`. Colour surfaces (`Area`, tracks, swatches) are
styled by their own stylesheets.

#### Scenario: Content as panel

- **WHEN** the Content is themed
- **THEN** it uses the panel family's surface, border and shadow tokens and fits within the available height

