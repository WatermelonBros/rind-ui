# rating Specification

## Purpose
TBD - created by archiving change add-rating. Update Purpose after archive.
## Requirements
### Requirement: Anatomy

A Rating SHALL consist of `Root`, `Label`, `Control` and one `Item` per star. `Control`
SHALL render, after its children, exactly one visually hidden native
`<input type="range">` (the range input) and one hidden form input. The range input SHALL be
the Rating's only focusable element and its only element with role `slider`. Every `Item`
SHALL be `aria-hidden="true"` and take an `index` prop (1 to `count`) so its state is known
during a server render. Every part SHALL accept the `render` prop.

#### Scenario: One slider, decorative stars

- **WHEN** a Rating labelled "Score" with five Items is rendered
- **THEN** exactly one element has role `slider`, it is an `input[type=range]` named
  "Score", every Item is `aria-hidden`, and the form input has `tabindex="-1"` and
  `aria-hidden="true"`

#### Scenario: Server render

- **WHEN** a Rating with `defaultValue={3.5}` and `allowHalf` is rendered on the server
- **THEN** the range input has value and `aria-valuenow` 3.5, the Items' `data-state` are
  full, full, full, half, empty, and hydration produces no warning

### Requirement: Value And Grid

The Rating SHALL expose a controllable `value` (default `defaultValue`, default 0) with
`onValueChange(value, details)`, `details` carrying `reason`, `event` and `cancel()`. 0
SHALL mean "no rating". Every value SHALL lie in `[0, count]` (`count` default 5) on a grid
of 1, or 0.5 with `allowHalf`; any given or adjusted value SHALL be rounded to the grid and
clamped. A user change SHALL never go below one step unless `allowClear` is set.

#### Scenario: Controlled refusal

- **WHEN** a controlled Rating at 2 is increased and the parent does not apply 3
- **THEN** the value, `aria-valuenow` and the range input stay at 2

#### Scenario: Shape of the grid

- **WHEN** a Rating without `allowHalf` is given `defaultValue={3.6}`
- **THEN** its value is 4

### Requirement: Keyboard

On the range input, ArrowRight and ArrowUp SHALL increase by one step and ArrowLeft and
ArrowDown decrease; in right-to-left ArrowLeft and ArrowRight SHALL swap, ArrowUp and
ArrowDown SHALL not. PageUp and PageDown SHALL move by one whole star. Home SHALL go to the
lowest value a user may reach (0 with `allowClear`, else one step) and End to `count`.
Values SHALL never wrap. Handled keys SHALL be prevented, so neither the native input nor
the page reacts; Enter and keys with Alt, Control or Meta SHALL not be handled.

#### Scenario: Half steps and bounds

- **WHEN** a Rating with `allowHalf` at 2 receives ArrowRight, then End, then Home
- **THEN** its value is 2.5, then 5, then 0.5

#### Scenario: No clearing without allowClear

- **WHEN** a Rating at 1 without `allowClear` receives ArrowLeft
- **THEN** its value stays 1; with `allowClear` it becomes 0

#### Scenario: Right to left (KB reverses values)

- **WHEN** a Rating at 2 with `dir="rtl"` receives ArrowLeft
- **THEN** its value is 3

### Requirement: Pointer And Preview

A press SHALL be activated on release (`pointerup` of the primary button) on a star, at the
release position: with `allowHalf` the first half of a star in reading order SHALL be half a
star. Pressing the star of the current value SHALL clear it (0) when `allowClear` is set and
change nothing otherwise. A press SHALL move focus to the range input without a focus ring
and SHALL not blur it first. A bare click with no release before it (assistive technology)
SHALL set the whole star. While a mouse or pen hovers a star the Rating SHALL be in state
`previewing`: the Items SHALL draw the hovered value, and `aria-valuenow`, `aria-valuetext`,
the form value and the tab stop SHALL not change. Leaving the Control, any key, an
assistive-technology change, a form reset, or the Rating becoming disabled or read-only
SHALL end the preview. A touch SHALL never preview.

#### Scenario: Hover does not leak into the value (ZG#3456)

- **WHEN** a pointer hovers star 4 of a Rating at 1
- **THEN** four Items are `full` and carry `data-previewed`, while `aria-valuenow` is 1 and
  the form value is "1"; leaving the stars draws one full star again

#### Scenario: The press commits its own position (MUI#22827, ZG#252)

- **WHEN** a pointer hovers the first half of star 4, then presses the second half of star 2
- **THEN** the value is 2

#### Scenario: Half star in right to left (MUI#20954)

- **WHEN** a Rating with `allowHalf` and `dir="rtl"` is pressed on the right half of star 4
- **THEN** the value is 3.5

#### Scenario: Clearing (MUI#25533)

- **WHEN** a Rating at 3 with `allowClear` is pressed on star 3
- **THEN** its value is 0 and `aria-valuetext` is "No rating"

### Requirement: Assistive Technology Adjustment

A change of the range input's value that the Rating did not make (TalkBack, iOS VoiceOver)
SHALL be adopted when the Rating accepts changes, rounded to the grid; a value below the
lowest a user may reach SHALL be refused, and the range input SHALL show the Rating's value
again.

#### Scenario: Refused clear

- **WHEN** assistive technology sets the range input of a Rating at 4 without `allowClear`
  to 0
- **THEN** the value stays 4 and the range input shows 4

### Requirement: ARIA

The range input SHALL carry `aria-valuenow` (the value), `aria-valuemin="0"`,
`aria-valuemax` (`count`), `aria-valuetext` from `messages.valueText` (default
"N of COUNT stars" with N formatted for the locale, "No rating" for 0), `aria-labelledby`
(the Field's Label, else the Rating's Label), `aria-describedby` from the Field,
`aria-readonly="true"` while read-only and `aria-invalid="true"` while invalid. The Label
SHALL not use `for`; pressing it SHALL focus the range input. `aria-required` SHALL not be
set (not allowed on `slider`).

#### Scenario: Translated value text

- **WHEN** a Rating at 3.5 renders with locale `it` and `messages.valueText` returning
  "`formatted` stelle"
- **THEN** `aria-valuetext` is "3,5 stelle"

### Requirement: Read-Only And Disabled

`readOnly` SHALL keep the range input focusable and ignore keys, presses, previews and
assistive-technology changes (a press still focuses). `disabled` SHALL disable the range
input and the form input (out of the tab order, not submitted) and ignore all input; a
disabled fieldset SHALL disable the Rating.

#### Scenario: Read-only ignores changes

- **WHEN** a read-only Rating at 2 receives ArrowRight and a press on star 5
- **THEN** its value stays 2

### Requirement: Form Participation

The form input SHALL carry `name` and submit the value as a string, `""` while unrated.
With `required` the form SHALL be invalid while unrated with the browser's own
`valueMissing` message, and focusing the form input (validation) SHALL focus the range
input. A form reset SHALL restore the current `defaultValue` prop and dispatch no `change`.
A user change SHALL dispatch `input` and `change` on the form input; a parent's change or a
reset SHALL not. Inside a Field the Rating SHALL register as one control.

#### Scenario: Reset restores the current default

- **WHEN** `defaultValue` changes from 2 to 4, the user rates 5 and the form is reset
- **THEN** the value is 4 and the form submits "4"

#### Scenario: Required

- **WHEN** a required Rating is unrated
- **THEN** its form input reports `valueMissing`; after rating 1 it is valid

### Requirement: Data Attributes

Every part SHALL carry `data-scope="rating"`, `data-part`, `data-instance`, and
`data-disabled`, `data-readonly`, `data-required`, `data-invalid` and `data-previewing`
while they apply. The Root SHALL carry `data-value`. The Control and the range input SHALL
carry `data-focus` and `data-focus-visible`. Each Item SHALL carry `data-index`,
`data-state` (`full`, `half` or `empty` for the previewed value while previewing, else the
value) and `data-previewed` while inside the preview.

#### Scenario: Ring on the Control only

- **WHEN** the range input is focused by the keyboard
- **THEN** the Control and the range input carry `data-focus-visible` and no Item does

### Requirement: Contract

The Rating SHALL ship `ratingContract`, located by role `slider` and accessible name, with
actions `focus`, `rate`, `pressStar`, `step`, `toEdge`, `hover`, `leave`, `adjustNative` and
`resetForm`, queries `value`, `valueText`, `stars`, `isPreviewing`, `isDisabled`,
`isReadOnly` and `formValue`, traits `valued`, `directional`, `form-associated` and
`field-associated`, and a `getRating` driver. Pointer actions that need a position (half
stars, hover) SHALL fail with a "needs layout" error in an environment without layout; a
press there SHALL be a whole star.

#### Scenario: Same driver test in jsdom and a browser

- **WHEN** `getRating(screen, { name: "Score" }).rate(3)` runs in jsdom and in Chromium
- **THEN** both report value 3 and `valueText` "3 of 5 stars"

### Requirement: Rating Invariants

After every model step the value SHALL be on the grid within `[0, count]`; the range input's
value SHALL equal `aria-valuenow`; the form input SHALL carry the value (`""` for 0); and,
outside the preview, each Item's `data-state` SHALL match the value.

#### Scenario: Model walk

- **WHEN** `testMachine(ratingContract, …)` walks every transition in every modality and
  direction
- **THEN** every invariant holds after every step

### Requirement: Theme

`@rind-ui/theme` SHALL ship `rating.css` in `@layer rind.components` with `:where()`
selectors, family `range` (`solid`, `soft`; sizes `sm`, `md`, `lg`), drawing each star from
the Item: an outline always shown (the `border-strong` role) and a fill for `full` and, from
the reading start, for `half`. Every star SHALL be at least 24 × 24 CSS px. Under forced
colors the outline and fill SHALL use system colours with `forced-color-adjust: none`;
transitions SHALL be off under reduced motion. The sheet SHALL use logical directions only.

#### Scenario: Empty reads by shape

- **WHEN** a Rating at 2.5 is styled by `rating.css`
- **THEN** every star draws its outline, stars 1 and 2 a full fill, star 3 a half fill from
  the reading start, and stars 4 and 5 no fill

