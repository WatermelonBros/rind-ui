# slider Specification

## Purpose
Defines rind-ui's Slider: single and multi-thumb selection of numbers in a range by
keyboard, pointer, track press and assistive-technology adjustment, with one native range
input per thumb, its values, commit semantics, ARIA, form participation, styling
attributes, contract and theme. Research: `docs/research/slider.md`.
## Requirements
### Requirement: Anatomy

A Slider SHALL consist of `Root` (a `div` with `role="group"`), `Label`, `ValueText`,
`Control` (the pointer surface), `Track`, `Indicator` (the filled range), one `Thumb` per
value, optional `MarkerGroup` and `Marker` parts and an optional `Description`. Each
`Thumb` SHALL render a `div` containing exactly one native `<input type="range">` (the
thumb input), which is the thumb's only focusable element and its only element with role
`slider`. No other element of the Slider SHALL be focusable, including with
`tabindex="-1"`. `MarkerGroup` and `Marker` SHALL be `aria-hidden`. A `Thumb` SHALL take
an `index` prop so its value is known during a server render. Every part SHALL accept the
`render` prop.

#### Scenario: One slider per thumb (Kobalte span + input)

- **WHEN** a two-thumb Slider labelled "Price" is rendered
- **THEN** exactly two elements have role `slider`, both are `input[type=range]`, and the
  document has no other focusable element inside the Slider

#### Scenario: No extra TalkBack targets (BU#2575, chromium 40875648)

- **WHEN** the Slider's markup is inspected
- **THEN** no element other than the thumb inputs carries a `tabindex` attribute

#### Scenario: Server render of a range slider (RX#615)

- **WHEN** a Slider with `defaultValue={[20, 80]}` is rendered on the server
- **THEN** each thumb input has its value, `aria-valuenow` and position in the HTML, and
  hydration produces no warning

### Requirement: Value

The Slider SHALL expose a controllable `value` with `defaultValue` (default `min`) and
`onValueChange(value, details)`, where the value is a `number` or an array of numbers
and the callbacks receive the same shape the consumer passed. `details` SHALL carry
`reason` (the machine event), the thumb `index` and `cancel()`. In uncontrolled mode the
thumb inputs and ARIA attributes SHALL already reflect the new value when
`onValueChange` runs. An array value SHALL never be reported unsorted.

#### Scenario: Shape preserved

- **WHEN** an uncontrolled Slider with `defaultValue={30}` is increased by one step
- **THEN** `onValueChange(31, details)` is called with a number, not an array

#### Scenario: Controlled refusal (ARK#3270)

- **WHEN** a controlled Slider is dragged and the parent does not apply the proposed
  value
- **THEN** the thumb, the input and `aria-valuenow` stay at the controlled value, and
  the next drag starts from it

#### Scenario: External change then drag (RA#5644)

- **WHEN** a parent sets a controlled value from 10 to 70 and the user then drags the
  thumb by one step to the right
- **THEN** the proposed value is 71

### Requirement: Range, Step And Rounding

`min` (default 0), `max` (default 100) and `step` (default 1) SHALL define the values the
Slider can take: `min + k × step` within `[min, max]`, which is the grid a native range
input accepts. Every value the Slider produces, from any input path, SHALL be snapped to
that grid and rounded to the number of decimals of `step` and `min` (counting exponent
notation such as `1e-7`), then clamped. `largeStep` SHALL default to one tenth of the
range snapped to the step and at least one step. A default or controlled value outside the
range, off the grid or unsorted SHALL be normalised for rendering, with a development
warning; `min ≥ max` SHALL be a development error and render every thumb at `min`.

#### Scenario: No float drift (BU#4547, BITS#1518)

- **WHEN** a Slider with `step={0.1}` and value `0.2` is increased by one step
- **THEN** the value is exactly `0.3`

#### Scenario: Tiny steps (RX#3852)

- **WHEN** a Slider has `step={1e-7}` and is dragged
- **THEN** the produced values are multiples of `1e-7` with no more than 7 decimals

#### Scenario: Large step clamped (ZG#2504)

- **WHEN** a Slider at 95 with `max={100}` and `largeStep={10}` receives Shift+ArrowRight
- **THEN** the value is 100

#### Scenario: Off-grid maximum

- **WHEN** a Slider has `min={0}`, `max={10}` and `step={3}` and End is pressed
- **THEN** the value is 9, matching the native input, and a development warning names the
  unreachable `max`

#### Scenario: Out-of-range value (RA#4978)

- **WHEN** a controlled Slider receives `value={150}` with `max={100}`
- **THEN** the thumb renders at the end of the track and `aria-valuenow` is 100

### Requirement: Multiple Thumbs

With an array value the Slider SHALL keep the values in non-decreasing order, at least
`minStepsBetweenThumbs × step` apart (default 0). Each thumb input's `min` and `max`
attributes and `aria-valuemin`/`aria-valuemax` SHALL be its neighbours' values (offset by
the minimum gap), or the Slider's `min`/`max` for the outer thumbs. The thumbs' tab order
SHALL follow their index and SHALL NOT change when values change. Defaults that violate
the gap SHALL be normalised once, at creation.

#### Scenario: Neighbour bounds

- **WHEN** a Slider has `value={[20, 60]}` and `minStepsBetweenThumbs={5}`
- **THEN** the first thumb has `aria-valuemax="55"` and the second `aria-valuemin="25"`

#### Scenario: Keyboard stops at the neighbour

- **WHEN** the first thumb of `[20, 21]` with gap 0 receives ArrowRight twice
- **THEN** the value is `[21, 21]` and focus stays on the first thumb

#### Scenario: Gap at creation (ZG#2488)

- **WHEN** a Slider is created with `defaultValue={[50, 52]}`, `step={1}` and
  `minStepsBetweenThumbs={5}`
- **THEN** the rendered values satisfy the gap and a development warning names the
  default

### Requirement: Thumb Collision While Dragging

`thumbCollision` SHALL decide what happens when a dragged thumb reaches a neighbour:
`stop` (default) keeps it at the neighbour bound; `push` moves the neighbours along,
keeping the gap, until they reach the range ends; `swap` lets the dragged value pass the
neighbour, keeps the array sorted and moves focus and the drag to the thumb that now holds
the dragged value. Keyboard and assistive-technology changes SHALL always stop at the
neighbour bounds, whatever the policy.

#### Scenario: Swap moves focus (RX#730, RX#2247)

- **WHEN** with `thumbCollision="swap"` the first thumb of `[20, 60]` is dragged to 70
- **THEN** the value is `[60, 70]`, the second thumb's input has focus, and further
  movement moves the second thumb

#### Scenario: Push

- **WHEN** with `thumbCollision="push"` and gap 0 the first thumb of `[20, 60]` is dragged
  to 70
- **THEN** the value is `[70, 70]`

### Requirement: ARIA Semantics

Each thumb input SHALL carry `aria-valuenow`, `aria-valuemin`, `aria-valuemax` and an
`aria-valuetext` on every render, `aria-orientation="vertical"` when vertical,
`aria-readonly="true"` when read-only, and the native `min`, `max`, `step`, `name`,
`form` and `disabled` attributes. Its `value` SHALL be written as a DOM property after
every step; its `value` content attribute SHALL be the current `defaultValue` prop and SHALL
never be written from the value (`hidden-form-input` "Form Reset"). The input SHALL be visually hidden with the input variant of
`hidden-content`, sized to its thumb so a screen reader's focus outline matches the
thumb, SHALL have `pointer-events: none`, and, when vertical, `writing-mode` set so the
native input's axis matches the orientation.

#### Scenario: Value text always present

- **WHEN** a Slider without `formatOptions` has the value 40
- **THEN** its thumb input has `aria-valuetext="40"` formatted for the component's locale

#### Scenario: Vertical

- **WHEN** a Slider has `orientation="vertical"`
- **THEN** its thumb inputs have `aria-orientation="vertical"`

### Requirement: Labelling

Root SHALL be labelled by the `Label` part through `aria-labelledby`. The `Label` SHALL
render a `<label>` without `for` (on iOS a `for` overrides the thumb's own labelling,
WebKit 172464), and a pointer press on it SHALL focus the first enabled thumb input with
pointer modality (no `data-focus-visible`), because Safari does not focus range inputs
from a label. Each thumb input SHALL be named by the Label followed by its thumb name:
`aria-labelledby` lists the Label's id and the input's own id, and the input's
`aria-label` is the thumb name from `messages.thumbLabel(index, count)` (default: none for
one thumb; "Minimum" and "Maximum" for two; "Value i of n" for more), unless the consumer
passes `aria-label` or `aria-labelledby` on the Thumb, which SHALL be used as given. The
`Description` part SHALL be wired to every thumb input as `control-label` specifies.

#### Scenario: Range thumb names

- **WHEN** a two-thumb Slider has a Label "Price"
- **THEN** the thumb inputs are named "Price Minimum" and "Price Maximum"

#### Scenario: Translated thumb names

- **WHEN** `messages={{ thumbLabel: (i, n) => (i === 0 ? "Minimo" : "Massimo") }}` is passed
- **THEN** the thumb inputs are named "Price Minimo" and "Price Massimo"

#### Scenario: Label press focuses without a ring

- **WHEN** the user clicks the Label with a mouse
- **THEN** the first enabled thumb input is focused, its Thumb has `data-focus` and not
  `data-focus-visible`, and the value is unchanged

### Requirement: Value Text

`aria-valuetext` and the default content of `ValueText` SHALL come from one formatter: the
component locale and `formatOptions` through the shared number formatting of
`i18n-messages`, then `messages.valueText({ value, formatted, index, count })` (default:
the formatted value). The `ValueText` part SHALL show the formatted value for one thumb,
a formatted range for two, and a locale list for more, and SHALL NOT be a live region.

#### Scenario: Currency (RA#6402)

- **WHEN** a Slider has `formatOptions={{ style: "currency", currency: "EUR" }}`, locale
  `de-DE` and value 20
- **THEN** the thumb input's `aria-valuetext` is "20,00 €" and `ValueText` shows the same
  text

#### Scenario: Custom value text per thumb

- **WHEN** `messages.valueText` returns `"${formatted} nights"` and the value is `[2, 5]`
- **THEN** the thumb inputs' `aria-valuetext` are "2 nights" and "5 nights"

#### Scenario: Not live

- **WHEN** the value changes while the Slider is rendered
- **THEN** no element of the Slider has `aria-live` or a live-region role

### Requirement: Keyboard Interaction

On a focused thumb input the Slider SHALL handle the logical keys of
`keyboard-interactions` for value controls: `INCREASE`/`DECREASE` change the value by one
`step`, or by `largeStep` with Shift; PageUp increases and PageDown decreases by
`largeStep`; Home and End set the thumb to its lower and upper bound. Each handled key
SHALL call `preventDefault` so neither the native input nor the page reacts. Key repeats
SHALL each produce a step. Keys SHALL do nothing while disabled or read-only, and Escape
SHALL do nothing outside a drag.

#### Scenario: PageUp increases (RX#715)

- **WHEN** PageUp is pressed on a thumb at 10 with `largeStep={10}`
- **THEN** the value is 20

#### Scenario: Home does not scroll (RX#1054, KB#293)

- **WHEN** Home is pressed on a thumb inside a scrolled page
- **THEN** the thumb goes to its lower bound and the page does not scroll

#### Scenario: Slider in RTL

- **WHEN** ArrowLeft is pressed on a horizontal Slider under `dir="rtl"`
- **THEN** the value increases by one step

#### Scenario: Vertical up

- **WHEN** ArrowUp is pressed on a vertical Slider
- **THEN** the value increases by one step

### Requirement: Value Attributes In The Same Step

After a keyboard, pointer or assistive-technology change, the thumb input's `value`
property, `aria-valuenow` and `aria-valuetext` SHALL reflect the new value within the same
task as the event that caused it. The Slider SHALL never blur and re-focus a thumb input
to change how focus is shown.

#### Scenario: No blur before the value (BU#5296, BU#5294)

- **WHEN** a thumb focused by a pointer press receives ArrowRight
- **THEN** no `blur` or `focus` event fires on the thumb input, and `aria-valuenow` equals
  the new value when the keydown task ends

### Requirement: Pointer Interaction

A primary-button or touch press on the Control outside any thumb SHALL move the nearest
enabled thumb to the value under the pointer (reason `POINTER.DOWN`) and start a drag; a
press on a thumb SHALL NOT change the value and SHALL keep the pointer's offset from the
thumb centre for the whole drag. When thumbs are stacked at one value, the press SHALL
pick the thumb that can move toward the press point; a drag starting on a stack SHALL be
given to the thumb that can move in the drag's first direction. Disabled thumbs SHALL be
neither picked nor moved. The pressed thumb's input SHALL receive focus with pointer
modality. During a drag every move SHALL produce the snapped value under the pointer,
using the same geometry that positions the thumb. A Control with zero size SHALL produce
no value.

#### Scenario: Track press

- **WHEN** a Slider from 0 to 100 at 10 is pressed at 75 % of its track
- **THEN** the value is 75 and the thumb input has focus without `data-focus-visible`

#### Scenario: Off-centre press on a thumb (ZG#541, RK#1557)

- **WHEN** a thumb is pressed 6 px right of its centre and released without moving
- **THEN** the value does not change

#### Scenario: Stacked thumbs at the maximum (BU#1602, RA#6408)

- **WHEN** a value `[100, 100]` is pressed at 100 and dragged left
- **THEN** the first thumb moves and the value becomes `[x, 100]`

#### Scenario: Disabled thumb skipped (RA#942)

- **WHEN** the first thumb of `[20, 80]` is disabled and the track is pressed at 10
- **THEN** the first thumb does not move and the second, the nearest enabled thumb, stops
  at its lower bound: the value is `[20, 20]`

#### Scenario: Hidden slider (BU#4303)

- **WHEN** a press reaches a Slider inside a `display: none` ancestor that just became
  visible before layout
- **THEN** no `NaN` value is proposed and no position style contains `NaN`

### Requirement: Drag Lifecycle

A drag SHALL end on `pointerup`, and SHALL be cancelled on `pointercancel`, on loss of
pointer capture before `pointerup`, when the Slider becomes disabled, and on Escape. A
cancelled drag SHALL restore the values from the start of the press (reason
`DRAG.CANCEL`) and SHALL NOT commit. While a drag is active, Escape SHALL stop propagating
so it does not also close a surrounding layer. Listeners outside the Slider SHALL exist
only while a drag is active.

#### Scenario: Escape cancels a drag

- **WHEN** a thumb at 20 is dragged to 60 and Escape is pressed before release, inside a
  Dialog
- **THEN** the value is 20 again, `onValueCommit` is not called, and the Dialog stays open

#### Scenario: Browser takes the touch for scrolling (BU#5637, RX#3010)

- **WHEN** a touch drag on a horizontal Slider turns into a vertical page scroll and the
  browser sends `pointercancel`
- **THEN** the value returns to its value at the press, nothing is committed, and a later
  tap elsewhere on the page commits nothing

#### Scenario: Release outside the frame (BU#1910)

- **WHEN** a drag is released outside the document, so no `pointerup` arrives and pointer
  capture is lost
- **THEN** `data-dragging` is removed

#### Scenario: No listeners when idle (BU#3311)

- **WHEN** a drag has ended and the user clicks elsewhere on the page
- **THEN** no Slider callback runs

### Requirement: Commit

`onValueCommit(value, details)` SHALL be called exactly once at the end of each
interaction that changed the value: each keyboard step, each assistive-technology
adjustment, and each pointer release whose values differ from the values at the press
(including a press with no move). It SHALL receive the latest value of the machine, never
a value from an earlier render, and `details.reason`. It SHALL NOT be called for a
cancelled drag, a refused change, a programmatic change or a form reset.

#### Scenario: Tap commits (BU#5772)

- **WHEN** the track is tapped at 40 with no move
- **THEN** `onValueChange` and `onValueCommit` are each called once with 40

#### Scenario: Range narrowed to one value (RX#3698, RX#1760)

- **WHEN** the first thumb of `[20, 60]` is dragged onto 60 and released
- **THEN** `onValueCommit([60, 60])` is called once

#### Scenario: Fast drag (RX#4154, ZG#2497)

- **WHEN** a thumb is dragged quickly and released in the same frame as its last move
- **THEN** the committed value equals the last value passed to `onValueChange`

#### Scenario: Keyboard commits per step (RX#3619, KB#352, BU#5595)

- **WHEN** ArrowRight is held and produces three steps
- **THEN** `onValueCommit` is called three times with `details.reason` naming the key
  event

#### Scenario: Exactly once (KB#322)

- **WHEN** a single-thumb and a two-thumb Slider are each dragged and released
- **THEN** each calls `onValueCommit` once

### Requirement: Assistive Technology Adjustment

A change to a thumb input's value that the Slider did not make (TalkBack's set-value
action, iOS VoiceOver's swipe, any native `input`/`change` without a handled key) SHALL be
adopted as the machine event `INPUT.CHANGE` for that thumb, snapped and bounded like a key
step, and SHALL call `onValueChange` and `onValueCommit`. When the machine rejects or
alters it (disabled, read-only, refused, snapped), the input SHALL be re-synced to the
Slider's value.

#### Scenario: TalkBack adjust (BU#2575, RX#2850)

- **WHEN** the value of the first thumb input is set to 35 and native `input` and
  `change` events are dispatched, with no key event
- **THEN** the Slider's value is 35 and `onValueCommit` is called once

#### Scenario: Read-only rejects

- **WHEN** a read-only Slider's thumb input receives a native change to 35
- **THEN** the input's value returns to the Slider's value within one frame and no
  callback runs

### Requirement: Orientation, Direction And Alignment

Thumb, Indicator and Marker positions SHALL be pure functions of the resolved values, the
orientation, the direction and `thumbAlignment`, and SHALL render correctly on the
server. Horizontal sliders SHALL grow from the inline start (right in RTL); vertical
sliders SHALL grow upward in both directions. With `thumbAlignment="center"` (default) a
thumb's centre SHALL sit at its value; with `contain` the thumb SHALL stay inside the
Control, computed in CSS from `--rind-slider-thumb-size` with no measurement, and pointer
mapping SHALL use the measured thumb size at press time. One function SHALL decide the
axis direction for pointer mapping, positions and keys.

#### Scenario: RTL pointer

- **WHEN** a horizontal Slider under `dir="rtl"` is pressed at 25 % from its right edge
- **THEN** the value is 25

#### Scenario: Contain on the server (Zag hidden-until-measured)

- **WHEN** a Slider with `thumbAlignment="contain"` is server-rendered
- **THEN** its thumbs are visible and positioned in the HTML, with no inline script

#### Scenario: Disabled keeps its position (RK#1691)

- **WHEN** a Slider with value 60 is mounted disabled
- **THEN** its thumb is at 60 %

### Requirement: Touch And Selection

The Control SHALL set `touch-action: pan-y pinch-zoom` when horizontal and `pan-x
pinch-zoom` when vertical, each Thumb `touch-action: none`, and the Control
`user-select: none`; during a touch drag the iOS text-selection handling of
`press-interactions` SHALL apply. The Slider SHALL NOT call `preventDefault` on touch or
wheel events.

#### Scenario: Page still scrolls (RX#570)

- **WHEN** a user swipes vertically across a horizontal Slider on a touch device
- **THEN** the page scrolls and the value does not change

#### Scenario: Long press on a thumb (BU#1295)

- **WHEN** a thumb is long-pressed on iOS
- **THEN** no text is selected and no callout opens

#### Scenario: Inside a modal on iOS (RA#9493)

- **WHEN** a Slider inside a modal Dialog with scroll lock is dragged on iOS Safari
- **THEN** the thumb follows the finger

### Requirement: Disabled And Read-Only

`disabled` on Root SHALL disable every thumb input natively and ignore every interaction;
`disabled` on a Thumb SHALL do so for that thumb only. `readOnly` SHALL keep thumbs
focusable and ignore every value change. Becoming disabled during a drag SHALL cancel it.

#### Scenario: Read-only focus

- **WHEN** a read-only Slider's thumb is focused and ArrowRight is pressed
- **THEN** the value is unchanged and the input has `aria-readonly="true"`

### Requirement: Form Participation

The thumb inputs SHALL be the Slider's form inputs, as `hidden-form-input` specifies for
accessible native inputs: each submits its value under `name` (or the Thumb's own `name`),
a disabled Slider submits nothing, user changes dispatch bubbling `input` and `change`
after the property is updated and programmatic changes dispatch none, and a form reset
returns the Slider to the current `defaultValue` prop (reason `RESET`) without a commit;
changing `defaultValue` never changes the current value, only what a reset restores.

#### Scenario: Range submission (RX#2454)

- **WHEN** a form containing a Slider `name="price"` with value `[20, 80]` is submitted
- **THEN** the form data contains `price=20` and `price=80`, in thumb order

#### Scenario: Enter submits the form (RX#2541)

- **WHEN** Enter is pressed on a focused thumb input in a form with a submit button
- **THEN** the form submits and the value is unchanged

#### Scenario: Reset

- **WHEN** an uncontrolled Slider created with `defaultValue={30}` is moved to 70 and its
  form is reset
- **THEN** the value is 30, `onValueChange(30, { reason: "RESET" })` is called, and
  `onValueCommit` is not

#### Scenario: Programmatic change is silent (RX#4096)

- **WHEN** a parent changes a controlled value
- **THEN** no `input` or `change` event is dispatched

### Requirement: Data Attributes

Root, Label, ValueText, Control, Track, Indicator and every Thumb SHALL carry
`data-orientation`, and when applicable `data-disabled`, `data-readonly`,
`data-dragging`, `data-focus` and `data-focus-visible` (focus of any thumb input).
Each Thumb SHALL also carry `data-index`, its own `data-disabled`, `data-dragging` while
it is the dragged thumb, `data-focus`/`data-focus-visible` for its own input, `data-active`
when it was the last thumb used (for stacking), and `--rind-slider-thumb-percent`. The
Indicator SHALL carry `--rind-slider-start` and `--rind-slider-end` (percent). Each
Marker SHALL carry `data-value` and `data-state="under-value | at-value | over-value"`.
`data-variant`, `data-size` and `data-tone` SHALL pass through untouched.

#### Scenario: Ring on the visible thumb

- **WHEN** a thumb input is focused with Tab
- **THEN** its Thumb has `data-focus-visible` and the other Thumbs do not

#### Scenario: Marker state

- **WHEN** a single-thumb Slider at 50 renders Markers at 25, 50 and 75
- **THEN** they carry `under-value`, `at-value` and `over-value`

### Requirement: Contract

The slider contract SHALL locate an instance by role `group` and the exact name of its
Label, and SHALL declare:

- actions `focusThumb(index)`; `step(index, "increase" | "decrease", { large? })`;
  `toEdge(index, "min" | "max")`; `setValue(index, value)` (keyboard: key presses;
  pointer: a drag of the thumb); `pressTrack(value)` (pointer; keyboard twin: focus the
  nearest thumb and step); `pointerDown(index)`, `pointerMove(value)`, `pointerUp()`
  (pointer and touch; keyboard declared `none` with the reason "dragging is pointer-only;
  `step` is the 2.5.7 alternative"); `cancelDrag()` (Escape); `adjustNative(index,
  value)` (sets the thumb input's value as assistive technology does); `resetForm()`;
- queries `values()`, `valueText(index)`, `bounds(index)`, `focusedThumb()`,
  `isDragging()`, `orientation()`, `formValues()`;
- traits `valued`, `directional` and `form-associated` (properties compared: each thumb
  input's `value`);
- observations: `idle` (no `data-dragging`) and `dragging`.

Pointer actions SHALL fail with a message saying they need layout when the environment
reports no geometry.

#### Scenario: Same driver in both environments

- **WHEN** `getSlider(screen, { name: "Volume" }).step(0, "increase")` runs in jsdom and
  the same call runs with `page` in Playwright
- **THEN** both resolve with `values()` equal to `[51]` from 50

#### Scenario: Pointer action without layout

- **WHEN** `pressTrack(30)` runs in jsdom
- **THEN** it rejects naming `pressTrack`, `pointer` and the missing layout

### Requirement: Slider Invariants

The contract SHALL ship invariants checked after every model step: values are sorted, on
the step grid, within range and at least the gap apart; each thumb input's `value`
property equals its `aria-valuenow`; each thumb input's `aria-valuemin`/`aria-valuemax`
equal its neighbour bounds; exactly one `slider` per Thumb and no other focusable element;
no `blur`/`focus` event fired on a thumb input during a keyboard step; no position style
contains `NaN`; and `onValueCommit` was called exactly as often as the oracle's committing
steps.

#### Scenario: Broken wrapper

- **WHEN** a consumer wrapper renders an extra focusable `span[role=slider]` around each
  thumb
- **THEN** the invariant fails naming the extra element

### Requirement: Theme

`slider.css` SHALL style the Slider on its data attributes and `--rind-slider-*` tokens
only: a thumb hit area of at least 24×24 CSS px through `--rind-hit-area`; a focus ring on
`[data-focus-visible]` thumbs; track and thumb edges that stay visible under
`forced-colors: active` (`CanvasText` borders, `Highlight` indicator); logical properties
for RTL; vertical layout from `data-orientation`; thumb transitions only for non-drag
changes and only through duration tokens; `--rind-slider-thumb-size` read for `contain`.
It SHALL style the shared `data-variant` and `data-size` values of its theme family.

#### Scenario: Forced colors (ARK#3421, RX#2993)

- **WHEN** a Slider is rendered under forced colors
- **THEN** the track, the indicator and each thumb remain visible and the focused thumb
  shows an outline

### Requirement: Field Control Binding

The Slider SHALL implement add-field's `field-control` binding. Its Root SHALL read the
nearest Field's binding and register the Slider with that Field exactly once as one control (non-labelable group
root, focus operation, the first thumb input as validity element, a reader for the value),
unregistering on unmount. Its thumbs SHALL NOT register separately.
The Field's ARIA SHALL be applied only to the registered control: the root and each
thumb input are named through the Field's Label as the Slider's own Label names them;
`aria-describedby` on each thumb input with the Field's Description and, while rendered,
ErrorMessage ids; `aria-invalid` (role `slider` allows it) while the Field displays
invalid; `required` only as `data-required`, because a range input always has a value.
Its `disabled`, `readOnly`, `required` and `invalid` SHALL be OR-merged with the Field's
and an enclosing Fieldset's (field-control "State Propagation"). It SHALL report each
accepted change and each commit (the Slider's own commit at drag end or key release) exactly once (field-control "Reporting Changes"), register a focus
target that focuses the first thumb input, declare the `field-associated` trait, and add the Field prop × control
matrix test.

#### Scenario: Slider in an invalid Field

- **WHEN** a two-thumb Slider is inside a Field that displays an error
- **THEN** both thumb inputs have `aria-invalid="true"` and an `aria-describedby` containing
  the ErrorMessage id, and the Root carries `data-invalid`

#### Scenario: One validation per drag

- **WHEN** a Slider inside a Field in `change` mode with a `validate` function is dragged
  across several steps and released
- **THEN** each accepted value change is reported once and the commit is reported once

### Requirement: Hosted Naming

A Slider rendered as another component's part (a Color Picker's) SHALL be able to take the host's `data-scope` and the host's
`data-part` name for each of its parts, through an optional naming input of its connect function; its behaviour and its other
attributes SHALL NOT change. Without that input it SHALL keep its own scope and part names.

#### Scenario: Hosted

- **WHEN** a Slider is rendered with the naming `{ scope: "color-picker", part: … }`
- **THEN** every part carries `data-scope="color-picker"` and the host's part name (for example `channel-slider-thumb`)

#### Scenario: Not hosted

- **WHEN** a Slider is rendered with no naming
- **THEN** its parts carry its own scope and part names, as before

