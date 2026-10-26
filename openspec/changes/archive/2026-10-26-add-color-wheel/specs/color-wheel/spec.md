## ADDED Requirements

### Requirement: Color Wheel Anatomy

A Color Wheel SHALL consist of `Root` (`role="group"`), `Track`, `Thumb` and `Input` (a native
`<input type="range">`, the only focusable element), with optional `Label` and `Value`. The
Input SHALL be named by the Label, `aria-label`, or the default "Hue".

#### Scenario: One slider

- **WHEN** a Color Wheel is rendered without a Label
- **THEN** exactly one element with role `slider` named "Hue" exists

### Requirement: Color Wheel Binding

The Color Wheel SHALL drive the colour's hue with the Angle Slider machine: the hue is the
angle (0 at the top, clockwise), snapped to `step`, wrapping at 360. A change SHALL produce the
colour with that hue in the working space, keeping its other channels and its memory.

#### Scenario: Hue only

- **WHEN** the value is `hsl(0 80% 40%)` and the hue is set to 120
- **THEN** the value is `hsl(120 80% 40%)`

#### Scenario: A grey keeps its hue

- **WHEN** the value is a grey and the hue is set to 200
- **THEN** the thumb shows hue 200 and the Input's value is 200

### Requirement: Color Wheel Ring Hit Test

A press SHALL start a drag only between the inner radius (outer radius minus
`--rind-color-wheel-thickness`) and the outer radius of the Track; a press in the centre SHALL
do nothing. During a drag the angle SHALL follow the pointer wherever it is.

#### Scenario: Centre press ignored

- **WHEN** the centre of the Track is pressed
- **THEN** the value does not change and no drag starts

### Requirement: Color Wheel Keyboard

The keys SHALL be the Angle Slider's: arrows by `step` (default 1), Shift and Page keys by
`largeStep` (default 15), Home and End, wrapping at the ends, Escape cancelling a drag.

#### Scenario: Wrap

- **WHEN** the hue is 359 and ArrowRight is pressed
- **THEN** the hue is 0

### Requirement: Color Wheel Value Text

`aria-valuetext` SHALL be Color Slider's for the hue channel: the channel name, the formatted
hue and the hue's name.

#### Scenario: Value text

- **WHEN** the hue is 240
- **THEN** `aria-valuetext` is "Hue 240°, blue"

### Requirement: Color Wheel Form

With `name`, a hidden input SHALL submit the colour as a hex string; a form reset SHALL restore
`defaultValue`.

#### Scenario: Submits the colour

- **WHEN** the value is `#ff0000` and the form is submitted with `name="accent"`
- **THEN** the form data has `accent=#FF0000`

### Requirement: Color Wheel Data Attributes

Every part SHALL carry `data-scope="color-wheel"`, `data-part`, `data-instance`, `data-space`,
and when they apply `data-dragging`, `data-disabled`, `data-readonly`, `data-invalid`; the Thumb
and the Input SHALL carry the focus attributes. The Track SHALL set
`--rind-color-wheel-gradient`; the Root SHALL set `--rind-color-wheel-angle` and
`--rind-color-wheel-thumb-color`.

#### Scenario: Gradient

- **WHEN** a Color Wheel renders
- **THEN** the Track's `--rind-color-wheel-gradient` is a `conic-gradient` of 7 or more stops

### Requirement: Color Wheel Contract

The contract SHALL locate by the Label or the only one, with actions `setHue`, `step`,
`toEdge` and queries `hue`, `value`, `valueText`, `isDragging`.

#### Scenario: Driver

- **WHEN** a test calls `step(10)` from hue 0
- **THEN** `hue()` is 10

### Requirement: Color Wheel Theme

`@rind-ui/theme` SHALL style the Color Wheel in the `field` family: the Track a ring painted
with the gradient and masked to `--rind-color-wheel-thickness`, the Thumb on the ring filled
with the thumb colour and outlined for contrast on any hue, a focus ring under keyboard focus,
and a visible ring and thumb under forced colors.

#### Scenario: Forced colors

- **WHEN** forced colors are active
- **THEN** the ring outline and the Thumb remain visible
