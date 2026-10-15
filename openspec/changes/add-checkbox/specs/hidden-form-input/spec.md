## Purpose

Defines how a rind-ui control whose accessible element is not a native form field (Checkbox,
Switch, Checkbox Group items, and later Radio Group, Select, Slider and others) takes part in
HTML forms through one hidden native input: submission, native constraint validation, form
reset and implicit submission. The input never becomes a second accessible control, never
moves the layout, and never fires events a native control would not fire. Shared by every
form-associated component; introduced by `add-checkbox`.

## ADDED Requirements

### Requirement: One Hidden Native Input Per Control

A form-associated component SHALL render exactly one hidden native input of the type its
native counterpart has (for Checkbox and Switch, `<input type="checkbox">`), unless the
component declares another input element (Select declares a text `<input>` instead of a
`<select>`). A component whose value is a list MAY additionally render one
`<input type="hidden">` value carrier per value, next to the constraint input; carriers
carry the `name` and are never focusable. For a `required` list-valued component the
constraint input SHALL act as a validity proxy: it is invalid (`valueMissing`) exactly
when the list is empty, so native constraint validation and the invalid-focus rule work
for multiple selection. The list carriers do not cover a value of exactly two typed parts
(a range's start and end, each with its own name and a native type such as `date`): a component
whose value has two parts MAY render a second hidden input of the same declared type as the
first, named `endName` (the first takes `name`), mirrored like the first (`value`, `form`,
`required`, `disabled`, `min`/`max`/`step` when the component declares them) and following the
same sync, reset and event rules. The first input SHALL remain the control's validity element and
the one reported to a Field; the second SHALL be never focusable, never exposed to a Field and
never carry the control's custom validity. The component's
root part SHALL render it automatically as its last child, after the visible control, in the
server render too, whether or not the component has a `name` or is inside a form. The input
SHALL carry `aria-hidden="true"`, `tabIndex=-1`, a generated id, and
`data-part="hidden-input"`. It SHALL use the input variant of the visually hidden style
(`hidden-content`) placed at its static position (absolute positioning with no offsets, 1×1
CSS px, clipped), so it changes neither the layout nor the scroll size of any ancestor, and
it SHALL never receive pointer input. It SHALL NOT be exposed to assistive technology or
matched by role queries.

#### Scenario: No duplicated role (testing.md, Reado hidden select)

- **WHEN** a test locates the checkbox by role `checkbox` and its exact accessible name
- **THEN** exactly one element matches, and it is the visible control

#### Scenario: No scroll overflow (radix#3588, radix#2402, radix#4041)

- **WHEN** a control is rendered inside a form, inside a scroll container with a fixed
  height, in a flex row, in both `ltr` and `rtl`
- **THEN** the container's and the document's scroll width and height equal those of the
  same layout without the control's hidden input

#### Scenario: Two-part value submits two names

- **WHEN** a range control with `name="from"` and `endName="to"` holds 10 and 14 October 2026
  inside a form that is submitted
- **THEN** the form data contains `from=2026-10-10` and `to=2026-10-14`, both inputs are
  `aria-hidden` with `tabIndex=-1`, and a Field registers only the first as the validity element

#### Scenario: Second input follows form reset

- **WHEN** a two-part control's form is reset
- **THEN** both inputs are re-synced from the component's value within one frame

#### Scenario: Unnamed input warning (base-ui#2114)

- **WHEN** a control without `name` is rendered
- **THEN** its hidden input has an id, so the browser reports no unidentified form field

#### Scenario: Server render

- **WHEN** a control with `name="terms"` and `defaultChecked` is rendered on the server
- **THEN** the HTML contains the hidden input with `name="terms"` and the `checked`
  attribute, and a form submitted before hydration sends `terms=on`

### Requirement: Value Mirrored As Properties

After every commit the hidden input SHALL reflect the component's current value through DOM
properties (`checked`, `indeterminate`, `value`), including on the first client render (the
`indeterminate` property has no attribute and SHALL be set from the start), and its `name`,
`value`, `form`, `required` and `disabled` SHALL mirror the component's props. The `checked`
content attribute (the input's default, which a form reset restores) SHALL be the
component's current `default*` prop (as a native React input updates `defaultChecked` /
`defaultValue` when the prop changes) and SHALL never be written from the value.
Whenever something other than the component changes the input (a form reset, a framework
resetting uncontrolled fields after a form action, the browser restoring form state), the
input SHALL be re-synced from the component's state no later than the next animation frame.
For an uncontrolled change, the input SHALL already reflect the new value when the
component's change callback runs.

#### Scenario: Initially indeterminate (zag#3402)

- **WHEN** a Checkbox is rendered with `defaultChecked="indeterminate"`
- **THEN** before any interaction its hidden input has `indeterminate === true` and
  `checked === false`

#### Scenario: Default attribute never follows the value (radix#2133)

- **WHEN** a Checkbox created with `defaultChecked={false}` is checked by the user
- **THEN** its hidden input has `checked === true` and `defaultChecked === false`

#### Scenario: Framework resets the input behind the component (radix#3444)

- **WHEN** a form action resets the form's uncontrolled fields after submission while a
  controlled Checkbox stays checked
- **THEN** within one frame the hidden input is checked again, and the next submission
  contains the checkbox's value

#### Scenario: Submitting from the change callback (headlessui#3760)

- **WHEN** an uncontrolled Checkbox's `onCheckedChange` calls `form.requestSubmit()`
- **THEN** the submitted form data reflects the new value

### Requirement: Events For User Changes Only

When the user changes the value (any press, key or assistive-technology activation that the
component turns into a value change), the hidden input SHALL, after its properties reflect
the new value and in the same task, dispatch a bubbling `input` event followed by a bubbling
`change` event, as a native control does. This SHALL also hold when a controlled parent
applies the user's change later. A value change that did not come from the user (the initial
value, a controlled prop changed by the parent, a form reset) SHALL dispatch no event. The
hidden input SHALL NOT dispatch a synthetic `click`. Ancestors SHALL observe exactly the
pointer and keyboard events the user produced on the visible control, so a consumer's
`stopPropagation()` on the control stops them.

#### Scenario: Native listeners see user changes (reka-ui#1209)

- **WHEN** a form has native `input` and `change` listeners and the user toggles a Checkbox
  inside it
- **THEN** each listener runs once, with the hidden input as the target and its `checked`
  property already updated

#### Scenario: Programmatic change is silent (radix#4102, radix#2419)

- **WHEN** a parent changes a controlled Checkbox's `checked` prop, or a form renders one
  with `defaultChecked`
- **THEN** no `input`, `change` or `click` event is dispatched from the hidden input

#### Scenario: Controlled change applied later

- **WHEN** the user toggles a controlled Checkbox and the parent applies the proposal on its
  next render
- **THEN** one `input` and one `change` event are dispatched, after the hidden input is
  updated

#### Scenario: Refused change is silent

- **WHEN** the user toggles a controlled Checkbox and the parent refuses the proposal
- **THEN** no event is dispatched, and a later programmatic change by the parent dispatches
  none either

#### Scenario: Clickable row (radix#3265, radix#2704, radix#667, zag#633, base-ui#5175)

- **WHEN** a Checkbox inside a clickable table row is clicked once, and when a "select all"
  control changes its controlled value
- **THEN** the row's click handler runs once for the click and not at all for the
  programmatic change, and a `stopPropagation()` in the Control's `onClick` keeps the row's
  handler from running

### Requirement: Accessible Native Input

A component MAY declare that its native input is itself the accessible control (Slider
thumbs, later Angle Slider). Such an input SHALL be exempt from being `aria-hidden`,
`tabIndex=-1`, never focused and focus-forwarded; it SHALL keep property mirroring with
the current `default*` prop as content attribute, `input`/`change` for user changes only, form
reset, native-input adoption and the `form-associated` trait (without the
aria-hidden/tabIndex checks). A component MAY render several such inputs, each with its
own `name`.

#### Scenario: Slider thumb is the focusable control

- **WHEN** a range slider renders two thumbs
- **THEN** each thumb's `<input type="range">` is focusable, exposed to assistive
  technology, carries its own `name`, and is the only focusable element of its thumb

### Requirement: Adopting Native Input

A component MAY opt in to receive native `input`/`change` events on its hidden input
that it did not dispatch itself (browser autofill, password managers) as a machine
event carrying the new native value. When it opts in, the input SHALL be re-synced from
the component only if the machine rejects that event; otherwise the component's value
follows the native one and `data-autofill` is set on the root until the next user change.

#### Scenario: Autofill adopted

- **WHEN** the browser autofills a Select's hidden input with a value that matches an
  option
- **THEN** the Select's value becomes that option, `onValueChange` reports it, and the
  input is not reverted

#### Scenario: Autofill rejected

- **WHEN** the autofilled value matches no option
- **THEN** the machine rejects it and the input is re-synced to the component's value

### Requirement: Form Reset

A form-associated component SHALL listen for the `reset` event of the form its hidden input
belongs to (including a form named by the `form` prop) and SHALL turn it into a `RESET`
machine event that restores the CURRENT `default*` prop value (the latest `defaultChecked` /
`defaultValue` the component was rendered with, not the one captured at creation), for
parity with native React inputs and React 19 action resets (react-spectrum#6830,
radix#4155): an uncontrolled component returns to that value; a controlled one proposes it
with reason `RESET`. Changing a `default*` prop SHALL still never change the component's
current value or state (machine-runtime rule); it only changes what a reset restores. If the value after the reset
differs from what the browser restored into the input (a controlled parent refused), the
input SHALL be re-synced. A component whose reset is handled by a group it belongs to SHALL
NOT also handle the reset itself.

#### Scenario: Reset unchecks (radix#983)

- **WHEN** an uncontrolled Checkbox with `defaultChecked={false}` is checked and its form is
  reset
- **THEN** it is unchecked, its control has `aria-checked="false"`, and
  `onCheckedChange(false, details)` was called with `details.reason === "RESET"`

#### Scenario: Controlled parent refuses the reset

- **WHEN** a controlled Checkbox is checked, its form is reset, and the parent keeps
  `checked={true}`
- **THEN** the control stays checked and its hidden input is checked again within one frame

#### Scenario: Reset restores the current default (react-spectrum#6830, radix#4155)

- **WHEN** an uncontrolled Checkbox is created with `defaultChecked={false}`, the parent
  re-renders it with `defaultChecked={true}`, the user checks and then unchecks it, and its
  form is reset
- **THEN** the `defaultChecked` change itself left the Checkbox unchecked, and after the
  reset it is checked and `onCheckedChange(true, details)` was called with
  `details.reason === "RESET"`

#### Scenario: Form named by the form prop

- **WHEN** a Checkbox rendered outside a form has `form="settings"` and the form with id
  `settings` is reset
- **THEN** the Checkbox returns to its default value

### Requirement: Native Constraint Validation

`required` SHALL set the native `required` constraint on the hidden input, so the form's
native validation (submission, `checkValidity`, `reportValidity`) fails while the value does
not satisfy it and the browser shows its validation message. When validation, script or a
label moves focus to the hidden input, focus SHALL move to the visible control, which SHALL
then carry `data-focus-visible` so the user sees which field failed. The hidden input SHALL
never keep focus, and scrolling it into view SHALL bring the visible control into view.

#### Scenario: Required checkbox blocks submission (radix#649, reka-ui#1383, bits-ui#444, react-spectrum#7317)

- **WHEN** a form with a required, unchecked Checkbox is submitted
- **THEN** submission is cancelled, no "not focusable" error is logged, focus is on the
  Checkbox's control with `data-focus-visible`, and the hidden input reports
  `validity.valueMissing`

#### Scenario: Validation in a scroll area (ark#3705, kobalte#452)

- **WHEN** a required, unchecked Checkbox far down a scrollable container fails validation
- **THEN** the container scrolls so the control is visible and the document's own scroll
  position does not change

### Requirement: Unchecked Value

An unchecked control SHALL submit nothing, as a native checkbox does, unless `uncheckedValue`
is set. In that case, while unchecked and enabled, the component SHALL submit
`name=uncheckedValue` through an additional `<input type="hidden">`. A disabled control
SHALL submit nothing.

#### Scenario: Native submission (base-ui#3239)

- **WHEN** a form contains a checked Checkbox `name="a" value="42"` and an unchecked one
  `name="a" value="69"`
- **THEN** the form data is exactly `[["a", "42"]]`

#### Scenario: Explicit unchecked value

- **WHEN** an unchecked Checkbox has `name="news"` and `uncheckedValue="no"`
- **THEN** the form data contains `news=no`, and after checking it, only `news=on`

### Requirement: Implicit Submission

When Enter is pressed on the visible control of a component whose native counterpart
submits its form on Enter (checkbox, switch, radio), and the control belongs to a form, the
form's implicit submission SHALL happen as HTML defines it for that form: its default button
is activated if it has one and that button is enabled. The value SHALL NOT change. A
consumer that calls `preventDefault()` on the Enter `keydown` SHALL prevent the submission.

#### Scenario: Enter submits (headlessui#2958, base-ui#4677, radix#1595)

- **WHEN** a focused Checkbox in a form with a submit button receives Enter
- **THEN** the form's `submit` event fires once and the Checkbox's value is unchanged

#### Scenario: Outside a form

- **WHEN** a focused Checkbox that belongs to no form receives Enter
- **THEN** nothing happens

### Requirement: Form-Associated Trait

Contracts SHALL be able to declare the `form-associated` trait, and SHALL be able to
declare which input properties the runner compares (default: `checked`, `indeterminate`,
`value`; Select: the `value` of every hidden input, in order). For such contracts the
model-based runner SHALL check after every step that:

- the declared properties of the hidden input(s) equal the oracle's value;
- it carries `aria-hidden="true"` and `tabIndex=-1`, does not have focus, and is the only
  input the component renders for that value (plus the `uncheckedValue` input when
  applicable);
- the number of `change` events dispatched by the hidden input since the path started
  equals the number of steps whose action changed the value;
- the number of `click` events an ancestor of the component received equals the number of
  clicks the driver produced.

Both test adapters SHALL let contracts read a native input's checkedness and indeterminate
state as DOM properties.

#### Scenario: Event parity fails on a synthetic click

- **WHEN** a broken variant dispatches a `click` from its hidden input on every change
- **THEN** the first step that changes the value fails, naming the ancestor click count

#### Scenario: Programmatic change dispatching change

- **WHEN** a broken variant dispatches `change` when the parent sets a controlled value
- **THEN** the `$sync` step fails, naming the `change` count

#### Scenario: Reading checkedness

- **WHEN** a contract query reads the hidden input's checkedness through the Playwright
  adapter and through the DOM adapter
- **THEN** both return the `checked` property, not the `checked` attribute

### Requirement: Validity Element For Field

The hidden input that carries the native constraint SHALL be exposed to `field-control`
registration (`add-field`) as the control's validity element, so an enclosing Field can
read its `validity`, call `setCustomValidity()` on it and listen for its `invalid` event. A
custom validity message set on it by the Field SHALL survive every re-sync of the input
from the component (`sync()` after a commit, a reset re-sync, the post-commit hook): a
re-sync SHALL never call `setCustomValidity` and SHALL never clear an error the Field set.
Only the Field clears the custom validity it set.

A control MAY own a validity message of its own on its validity element (for example Date
Field's `badInput`), set and cleared by the control through one helper that composes with the
Field's message: while the Field's message is set it is the one shown, and when the Field clears
its own the control's message remains. A re-sync SHALL never clear a control-owned message and
MAY call `setCustomValidity` to keep it.

#### Scenario: Field error survives a toggle

- **WHEN** a Field sets the custom validity "Accept the terms" on a Checkbox's validity
  element and the Checkbox then re-syncs its hidden input after a re-render
- **THEN** the hidden input's `validationMessage` is still "Accept the terms" and
  `validity.customError` is `true`

#### Scenario: Control-owned message composes with the Field's

- **WHEN** a control sets its own validity message, a Field then sets and later clears its
  custom validity on the same element, and the control re-syncs in between
- **THEN** the Field's message is shown while it is set, the control's message is shown again
  after the Field clears its own, and the re-sync never cleared it

#### Scenario: Field reads the validity element

- **WHEN** a required, unchecked Checkbox is registered with a Field and the form is
  submitted
- **THEN** the Field receives the hidden input's `invalid` event and reads
  `validity.valueMissing` from it
