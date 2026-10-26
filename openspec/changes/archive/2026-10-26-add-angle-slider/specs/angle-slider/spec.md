## ADDED Requirements

### Requirement: Angle Slider Anatomy

An Angle Slider SHALL consist of `Root`, `Control`, `Thumb` and `Input` (a native
`<input type="range">`), with optional `Label`, `Value` (`<output>`), `MarkerGroup` and `Marker`.
The Input SHALL be the only focusable element and SHALL be named by the Label or `aria-label`.

#### Scenario: One slider

- **WHEN** an Angle Slider labelled "Direction" is rendered
- **THEN** exactly one element with role `slider` named "Direction" exists

### Requirement: Angle Slider Value Space

The value SHALL be a number of degrees in `[0, 360)`, normalised and snapped to the nearest
`step` (default 1); 360 SHALL become 0. The announced maximum SHALL be the largest reachable
value (359 with step 1).

#### Scenario: Snap to nearest (regression: Zag snaps up)

- **WHEN** `step` is 15 and a press lands at 37°
- **THEN** the value is 30

#### Scenario: Reachable max

- **WHEN** `step` is 1
- **THEN** the input's `max` and `aria-valuemax` are 359

### Requirement: Angle Slider Pointer

A press on the Control off the Thumb SHALL set the value to the angle of the press around the
Control's centre, clockwise from the top, and start a drag; a press on the Thumb SHALL keep the
value and drag with the grab offset. A drag SHALL end on release and SHALL restore the value at
the press on cancel (pointercancel, lost capture, hidden document, Escape). A press at the exact
centre SHALL NOT change the value. The geometry SHALL NOT be mirrored in RTL.

#### Scenario: Press at the right

- **WHEN** the Control is pressed at its right edge, vertically centred
- **THEN** the value is 90

#### Scenario: Escape cancels

- **WHEN** a drag moves from 0 to 120 and Escape is pressed
- **THEN** the value is 0

### Requirement: Angle Slider Keyboard

On the Input, ArrowRight and ArrowUp SHALL add `step`, ArrowLeft and ArrowDown SHALL subtract it;
Shift+Arrow, PageUp and PageDown SHALL use `largeStep` (default 15); Home SHALL go to 0 and End to
the maximum. With `wrap` (default true) a step past an end SHALL wrap around; without it, it
SHALL clamp.

#### Scenario: Up increases (regression: Zag decrements)

- **WHEN** the value is 10 and ArrowUp is pressed
- **THEN** the value is 11

#### Scenario: Wrap

- **WHEN** the value is 359 and ArrowRight is pressed
- **THEN** the value is 0

### Requirement: Angle Slider Commit

`onValueChange` SHALL report every change with its reason; `onValueCommit` SHALL run once per
interaction: on release after a drag that changed the value, and on each key or native input
change. A cancelled drag SHALL NOT commit.

#### Scenario: One commit per drag

- **WHEN** a drag passes 10°, 20°, 30° and is released
- **THEN** `onValueCommit` ran once with 30

### Requirement: Angle Slider Form

The Input SHALL carry `name` and `form` and submit the value; a form reset SHALL restore
`defaultValue`. Disabled SHALL NOT submit; read-only SHALL submit and SHALL NOT change.

#### Scenario: Submits the angle

- **WHEN** the value is 45 and the form is submitted with `name="angle"`
- **THEN** the form data has `angle=45`

### Requirement: Angle Slider Data Attributes

Every part SHALL carry `data-scope="angle-slider"`, `data-part`, `data-instance`, and when they
apply `data-dragging`, `data-disabled`, `data-readonly`, `data-invalid`; the Thumb SHALL carry
the focus attributes; a Marker SHALL carry `data-value` and `data-state` (`under-value`,
`at-value`, `over-value`). The Root SHALL set `--rind-angle-slider-angle` (`<n>deg`) and
`--rind-angle-slider-fraction` (0 to 1).

#### Scenario: Rotation variable

- **WHEN** the value is 90
- **THEN** the Root's `--rind-angle-slider-angle` is `90deg`

### Requirement: Angle Slider Messages

`aria-valuetext` SHALL come from `messages.valueText(value)`, by default the locale's number
followed by "degrees".

#### Scenario: Value text

- **WHEN** the value is 90
- **THEN** `aria-valuetext` is "90 degrees"

### Requirement: Angle Slider Contract

The contract SHALL locate by the Label or the only Angle Slider, with actions `setAngle`,
`step`, `toEdge` and queries `value`, `valueText`, `isDragging`.

#### Scenario: Driver

- **WHEN** a test calls `step(1)` from 0
- **THEN** `value()` is 1

### Requirement: Angle Slider Theme

`@rind-ui/theme` SHALL style the Angle Slider in the `field` family: a round Control with a
visible track ring, a Thumb on the ring rotated by `--rind-angle-slider-angle`, a focus ring on
the Thumb while the Input has keyboard focus, and forced-colors support.

#### Scenario: Forced colors

- **WHEN** forced colors are active
- **THEN** the ring and the Thumb remain visible
