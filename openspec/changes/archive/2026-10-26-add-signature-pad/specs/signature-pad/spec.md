## ADDED Requirements

### Requirement: Signature Pad Anatomy

A Signature Pad SHALL consist of `Root`, `Control` and `Segment`, with optional `Label`,
`Guide`, `Status`, `ClearTrigger` and `UndoTrigger`, and a hidden form input rendered by
`Root`. `Segment` SHALL be an `<svg>` and `aria-hidden="true"`; `Guide` SHALL be
`aria-hidden="true"`. The triggers SHALL be native `<button type="button">`. No part SHALL
reference the id of a part that is not rendered. Every part SHALL accept the framework's
element-substitution prop.

#### Scenario: Inside a form

- **WHEN** the ClearTrigger of a Signature Pad inside a `<form>` is pressed
- **THEN** the form is not submitted

### Requirement: Signature Pad Value

The value SHALL be `{ width, height, strokes }`, each stroke a list of points
`{ x, y, pressure, t }` in the stroke space (the Control's CSS box when the first stroke of an
empty pad began). The value SHALL be controllable (`value`, `defaultValue`,
`onValueChange`) and SHALL change only when a stroke ends, on clear, on undo and on form reset,
never while a stroke is drawn. A new value SHALL be a new object; a given value SHALL never be
mutated.

#### Scenario: The stroke in progress is not the value (regression: Zag 156940f)

- **WHEN** a pointer goes down and moves over the Control
- **THEN** `onValueChange` has not been called, and it is called once when the pointer goes up

#### Scenario: Caller's array untouched (regression: react-signature-canvas#56)

- **WHEN** a frozen `defaultValue` is given and a stroke is drawn
- **THEN** no error is thrown and the given object is unchanged

### Requirement: Signature Pad Drawing Input

A stroke SHALL start on `pointerdown` on the Control (not while disabled or read-only) and
belong to that `pointerId`; events of other pointers SHALL be ignored until it ends. Moves SHALL
read coalesced events when the browser provides them, and points closer than `minDistance`
(default 1 px) to the previous SHALL be dropped. The stroke SHALL end on `pointerup`,
`pointercancel` or `lostpointercapture` of its pointer, or a move with no button pressed;
an ended stroke SHALL be kept. Client coordinates SHALL be mapped through the Control's current
rect, its CSS scale and `zoom`, into the stroke space. The Control SHALL have
`touch-action: none`, `overscroll-behavior: contain` and no text selection or touch callout.

#### Scenario: Two fingers (regression: signature_pad#787)

- **WHEN** pointer 1 draws a stroke while pointer 2 goes down and moves elsewhere
- **THEN** the value has one stroke, and none of its points come from pointer 2

#### Scenario: A lost pointerup (regression: signature_pad#702)

- **WHEN** a stroke's pointer moves with `buttons === 0`
- **THEN** the stroke ends and is committed

#### Scenario: Scaled surface (regression: signature_pad#713)

- **WHEN** the Control is rendered at `transform: scale(0.5)` and the pointer moves to its
  visual centre
- **THEN** the point is at the centre of the stroke space

### Requirement: Signature Pad Rendering

Each stroke SHALL be one SVG path in the Segment, a smooth curve through its points, painted
with `currentColor`, round caps and joins; a one-point stroke SHALL render as a dot; no path
SHALL contain `NaN`. The Segment's `viewBox` SHALL be the stroke space, scaled uniformly to the
Control; a resize SHALL rescale the drawing and never clear it.

#### Scenario: Resize keeps the drawing (regression: signature_pad#161)

- **WHEN** a signed pad's Control is resized to half its width
- **THEN** the value is unchanged and the paths are still rendered

#### Scenario: A dot

- **WHEN** a pointer goes down and up without moving
- **THEN** the stroke has one point and its path is a visible dot

### Requirement: Signature Pad Clear And Undo

`ClearTrigger` SHALL remove every stroke and `UndoTrigger` the last one; both SHALL be ignored
while a stroke is being drawn. When the pad is empty both SHALL be `aria-disabled="true"` and
stay rendered and focusable; core SHALL never hide them. Each SHALL announce its result
politely (`messages.cleared`, `messages.undone`). Their names SHALL be `messages.clear` /
`messages.undo` followed by the Label's text.

#### Scenario: Focus stays on Clear (regression: Zag hides it)

- **WHEN** the keyboard focus is on the ClearTrigger of a signed pad and Enter is pressed
- **THEN** the pad is empty, the focus is still on the ClearTrigger, it is
  `aria-disabled="true"`, and "Signature cleared" is announced

### Requirement: Signature Pad Form

`Root` SHALL render a hidden input with `name`, `required` and `disabled`, never `readonly`.
Its value SHALL be computed synchronously from the strokes: an SVG data URL with the ink
colour inlined (`formValue="svg"`, default) or the stroke model as JSON (`formValue="json"`),
and `""` when empty. A required empty pad SHALL block submission, and the failed submit SHALL
focus the Control. A form reset SHALL restore `defaultValue`.

#### Scenario: Required validates (regression: Zag's readonly input)

- **WHEN** a form with a required, empty Signature Pad is submitted
- **THEN** the submission is blocked and the Control has the focus

#### Scenario: Submitted value

- **WHEN** a signed pad with `name="sig"` is submitted
- **THEN** the form data's `sig` starts with `data:image/svg+xml`

### Requirement: Signature Pad Export

`toBlob({ type, scale, background })` SHALL rasterise the strokes at the stroke space times
`scale` (default 2), never at the layout size; `image/jpeg` and `image/webp` SHALL paint
`background` (default white). It SHALL reject with `EmptySignatureError` when the pad is empty
and with the decode error when the image cannot be decoded. `download(fileName, options)`
SHALL save the same image.

#### Scenario: JPEG is not black (regression: signature_pad#858)

- **WHEN** a signed pad exports `image/jpeg`
- **THEN** a pixel far from the strokes is white

#### Scenario: Size from data (regression: signature_pad#885)

- **WHEN** a pad with a 400 × 200 stroke space exports at `scale` 2 on a DPR 3 screen
- **THEN** the image is 800 × 400

### Requirement: Signature Pad Accessibility

The Control SHALL have `role="img"`, be named by the Label (or the consumer's `aria-label`),
be described by the Status, and have `tabIndex="-1"` (not a Tab stop). The Status SHALL be
visually hidden text: `messages.empty` ("Not signed") or `messages.signed` ("Signed").
Drawing SHALL announce nothing. A click without pointer movement from assistive technology
SHALL draw nothing and SHALL NOT throw.

#### Scenario: Name and state

- **WHEN** an empty pad labelled "Signature" is rendered
- **THEN** an image named "Signature" is described as "Not signed", and Tab does not stop on
  it

### Requirement: Signature Pad Data Attributes

Every part SHALL carry `data-scope="signature-pad"`, `data-part`, `data-instance`,
`data-state` (`idle`, `drawing`), and when they apply `data-empty`, `data-disabled`,
`data-readonly`, `data-required`, `data-invalid`; the triggers SHALL carry `data-focus` and
`data-focus-visible`.

#### Scenario: Drawing state

- **WHEN** a pointer is down on the Control
- **THEN** every part has `data-state="drawing"`

### Requirement: Signature Pad Messages

The strings SHALL come from `messages`: `empty`, `signed`, `clear`, `undo`, `cleared`,
`undone`, with English defaults, each replaceable.

#### Scenario: Localised clear

- **WHEN** `messages.cleared` is "Firma cancellata" and the pad is cleared
- **THEN** "Firma cancellata" is announced

### Requirement: Signature Pad Contract

The contract SHALL locate the pad by its Label's text, else as the only pad in the target;
provide the actions `draw`, `tap`, `drawWithTwoPointers`, `cancelStroke`, `clear`, `undo` and
the queries `isEmpty`, `strokeCount`, `formValue`, `name`, `statusText`, `clearDisabled`,
`undoDisabled`; and check the invariants: no trigger hidden, and the Status text matching
emptiness. The contract Env SHALL provide `Part.drawPointers(events)` in the DOM and
Playwright adapters.

#### Scenario: Driver round trip

- **WHEN** a test calls `draw` with three points, then `undo`
- **THEN** `strokeCount` is 1 after the draw and 0 after the undo

### Requirement: Signature Pad Theme

`@rind-ui/theme` SHALL style the Control in the `field` family, the ink with the text colour,
the Guide as a dashed baseline, and the triggers as ghost icon buttons of at least 24 × 24 CSS
px outside the drawing area; under forced colors the ink SHALL be `CanvasText` and the guide
`GrayText`.

#### Scenario: Forced colors

- **WHEN** a signed pad is rendered with `forced-colors: active`
- **THEN** its paths are painted with `CanvasText`
