## ADDED Requirements

### Requirement: Item Alone Or In A Group

CheckboxGroup SHALL be the only component for this control. Its `Item` part SHALL have two shapes: inside `CheckboxGroup.Root` it SHALL be one item of the group (the group's value, semantics and keyboard rules apply); outside any Root it SHALL be a single control with its own state, rendering no group wrapper and joining no roving tab order, exactly as the former `Checkbox.Root`. `CheckboxGroup.ItemControl`, `ItemIndicator`, `ItemLabel` and `ItemDescription` SHALL be the item's own control, indicator, label and description in both shapes (`Label` and `Description` stay the group's). The item machine, contract and driver SHALL stay those of the single control (data-scope `checkbox`).

#### Scenario: A lone item

- **WHEN** a page renders one `CheckboxGroup.Item` with no `CheckboxGroup.Root`
- **THEN** there is no element with `role="group"` around it, and it behaves as the former single control

#### Scenario: An item in a group

- **WHEN** two `CheckboxGroup.Item` parts are rendered inside `CheckboxGroup.Root`
- **THEN** both belong to the group's value and follow the group's rules

### Requirement: Item Anatomy

These rules apply to `CheckboxGroup.Item` (with `CheckboxGroup.ItemIndicator`), alone or in a group (formerly the `checkbox` capability).

A Checkbox SHALL consist of these parts:

- `Root`: a `div` that provides the machine and renders the hidden form input
  (`hidden-form-input`) as its last child.
- `Control`: a button-like part (`button-like-element`) rendered by default as
  `<button type="button" role="checkbox">`.
- `Indicator`: a `span` with `aria-hidden="true"` that stays mounted in every state.
- `Label` and `Description`: from `control-label`.

The consumer SHALL NOT need to render the hidden input. Every part SHALL accept the props of
the element it renders and a `render` prop.

#### Scenario: Item — Minimal checkbox

- **WHEN** a consumer renders `Root` containing `Control` with an `Indicator` and a `Label`
- **THEN** the page has one element with role `checkbox` named by the Label, and one hidden
  `<input type="checkbox">` after the Control

#### Scenario: Item — Indicator in every state

- **WHEN** a Checkbox changes from checked to unchecked
- **THEN** its Indicator element stays in the DOM and its `data-state` becomes `unchecked`

### Requirement: Item Checked Value

These rules apply to `CheckboxGroup.Item` (with `CheckboxGroup.ItemIndicator`), alone or in a group (formerly the `checkbox` capability).

The Checkbox SHALL hold a controllable value `checked` of type `boolean | "indeterminate"`,
with props `checked`, `defaultChecked` (default `false`) and
`onCheckedChange(checked, details)`. A user activation SHALL change it from `false` to
`true`, from `true` to `false`, and from `"indeterminate"` to `true`, so a user action never
produces `"indeterminate"`. `details.reason` SHALL be the machine event (`TOGGLE` or
`RESET`) and SHALL carry `cancel()`. In controlled mode an activation SHALL propose the next
value without changing the rendered state until the parent applies it. Every activation
SHALL propose again, also after the parent changed the value externally or refused an
earlier proposal. `defaultChecked` SHALL be read when the Checkbox is created; changing it
later SHALL NOT change the current value or state, and SHALL only change the value a form
reset restores (`hidden-form-input` "Form Reset").

#### Scenario: Item — Uncontrolled toggle

- **WHEN** an uncontrolled Checkbox is clicked
- **THEN** it becomes checked and `onCheckedChange(true, details)` is called once with
  `details.reason === "TOGGLE"`

#### Scenario: Item — Controlled after an external change (ark#2608, zag#3018)

- **WHEN** a controlled Checkbox starts unchecked, the parent checks it from a separate
  button, and the user then clicks the Checkbox
- **THEN** `onCheckedChange(false, details)` is called on that first click

#### Scenario: Item — Refused proposal

- **WHEN** the parent of a controlled Checkbox ignores `onCheckedChange`
- **THEN** the Checkbox keeps `aria-checked="false"` and its hidden input stays unchecked

#### Scenario: Item — Cancelled change

- **WHEN** an uncontrolled Checkbox's `onCheckedChange` calls `details.cancel()`
- **THEN** the value does not change and no `change` event is dispatched

### Requirement: Item Indeterminate State

These rules apply to `CheckboxGroup.Item` (with `CheckboxGroup.ItemIndicator`), alone or in a group (formerly the `checkbox` capability).

A Checkbox whose value is `"indeterminate"` SHALL expose `aria-checked="mixed"`, carry
`data-state="indeterminate"`, and keep its hidden input `indeterminate` with `checked`
`false` (so it submits nothing). Activating it SHALL make it checked in every framework
adapter.

#### Scenario: Item — Mixed to checked (ark#3174)

- **WHEN** a Checkbox with `defaultChecked="indeterminate"` is activated by pointer, by
  Space and by a bare `click`
- **THEN** each time it becomes checked, and its hidden input has `indeterminate === false`
  and `checked === true`

#### Scenario: Item — Screen reader reads mixed (react-spectrum#4004)

- **WHEN** an indeterminate Checkbox is reached with a screen reader
- **THEN** the exposed element is the Control with `aria-checked="mixed"`, not a native input
  whose `indeterminate` property is mapped by the browser

### Requirement: Item ARIA Semantics

These rules apply to `CheckboxGroup.Item` (with `CheckboxGroup.ItemIndicator`), alone or in a group (formerly the `checkbox` capability).

The Control SHALL carry `role="checkbox"` on whatever element it renders, and `aria-checked` set to `"true"`, `"false"` or `"mixed"`, never absent. It SHALL carry
`aria-required="true"` when `required`, `aria-invalid="true"` when `invalid`,
`aria-readonly="true"` when `readOnly`, and the Description through `aria-describedby`
(`control-label`). Disabled semantics SHALL follow `button-like-element`. The Control's
accessible name SHALL stay the same in every state. Only the Control SHALL be exposed with
role `checkbox`; the Indicator and the hidden input SHALL be hidden from assistive
technology.

#### Scenario: Item — Required and invalid

- **WHEN** a Checkbox has `required` and `invalid`
- **THEN** its Control has `aria-required="true"` and `aria-invalid="true"`, and its hidden
  input has `required`

#### Scenario: Item — Exposed element matches what is seen (react-spectrum#9687, react-spectrum#8755)

- **WHEN** the Checkbox is located by role `checkbox` and clicked by a test tool at the
  element's centre
- **THEN** the click lands on the visible Control and toggles it, and the element's bounding
  box is the Control's

### Requirement: Item Keyboard Interaction

These rules apply to `CheckboxGroup.Item` (with `CheckboxGroup.ItemIndicator`), alone or in a group (formerly the `checkbox` capability).

The Control SHALL be one Tab stop. Space SHALL toggle it on key release (press
interactions), once per press, including when the key is held. Enter SHALL never change the
value; inside a form it SHALL perform implicit submission (`hidden-form-input`). Keys
pressed during an IME composition SHALL NOT toggle.

#### Scenario: Item — Space toggles

- **WHEN** the focused Control receives Space
- **THEN** the value changes once, on keyup

#### Scenario: Item — Enter does not toggle (react-spectrum#6398)

- **WHEN** the focused Control receives Enter outside a form
- **THEN** the value does not change

#### Scenario: Item — Enter submits the form (headlessui#2958, base-ui#4677, base-ui#2117, radix#1595)

- **WHEN** the focused Control inside a form with a submit button receives Enter
- **THEN** the form is submitted once and the value does not change

#### Scenario: Item — Held Space (ariakit#368)

- **WHEN** the user holds Space on the Control until the key repeats, in Firefox, Chromium
  and WebKit
- **THEN** the value changes exactly once

### Requirement: Item Pointer, Touch And Assistive Technology Activation

These rules apply to `CheckboxGroup.Item` (with `CheckboxGroup.ItemIndicator`), alone or in a group (formerly the `checkbox` capability).

A pointer click, a touch tap, a click forwarded by a label (`control-label`) and a bare
`click` from assistive technology SHALL each toggle the Checkbox exactly once, through press
interactions, which deliver activation on release. A press that leaves the Control before
release SHALL NOT toggle. A pointer press SHALL focus the Control in every engine (including
Safari, which does not focus buttons on click) without `data-focus-visible`. Focus reaching
the Control without activation, such as the screen-reader cursor, SHALL NOT toggle it.

#### Scenario: Item — One toggle per click (bits-ui#1670)

- **WHEN** the user clicks the Control once with a mouse
- **THEN** the value changes once and stays changed

#### Scenario: Item — Screen-reader activation

- **WHEN** the Control receives a bare `click` (`detail: 0`, no pointer or key events)
- **THEN** the value changes once

#### Scenario: Item — Focus in Safari (kobalte#230, kobalte#50)

- **WHEN** the user clicks the Control in WebKit
- **THEN** the Control has focus and `data-focus`, and a following Space toggles it

#### Scenario: Item — Virtual cursor focus

- **WHEN** the Control receives focus with no preceding key or pointer event
- **THEN** the value does not change

### Requirement: Item Disabled And Read-Only

These rules apply to `CheckboxGroup.Item` (with `CheckboxGroup.ItemIndicator`), alone or in a group (formerly the `checkbox` capability).

A disabled Checkbox SHALL ignore every activation, its hidden input SHALL be `disabled` (so
it submits nothing), and its disabled semantics SHALL follow `button-like-element`: native
`disabled` and out of the tab order by default, or `aria-disabled="true"` and focusable with
`focusableWhenDisabled`. A read-only Checkbox SHALL stay focusable, carry
`aria-readonly="true"`, ignore every activation (pointer, touch, Space, label, bare
`click`), and still submit its value. A form reset SHALL apply to both.

#### Scenario: Item — Disabled is not tabbable (headlessui#3212)

- **WHEN** the user tabs through a form that contains a disabled Checkbox without
  `focusableWhenDisabled`
- **THEN** focus skips it

#### Scenario: Item — Read-only ignores every input

- **WHEN** a read-only Checkbox is clicked, tapped, pressed with Space, activated through
  its Label and given a bare `click`
- **THEN** the value never changes and no `onCheckedChange` is called

#### Scenario: Item — Read-only still submits

- **WHEN** a checked, read-only Checkbox with `name="tos"` is in a submitted form
- **THEN** the form data contains `tos=on`

### Requirement: Item Form Participation

These rules apply to `CheckboxGroup.Item` (with `CheckboxGroup.ItemIndicator`), alone or in a group (formerly the `checkbox` capability).

The Checkbox SHALL take part in forms through `hidden-form-input`, with `name`, `value`
(default `"on"`), `form`, `required` and `uncheckedValue`. A checked Checkbox SHALL submit
`name=value`; an unchecked or indeterminate one SHALL submit nothing unless `uncheckedValue`
is set. `name` SHALL be set only on the hidden input, never on the Control.

#### Scenario: Item — Submitted value

- **WHEN** a checked Checkbox with `name="tos"` and `value="yes"` is in a submitted form
- **THEN** the form data has exactly one `tos` entry with the value `yes`

#### Scenario: Item — Reset returns to the default (radix#983)

- **WHEN** an uncontrolled Checkbox with `defaultChecked` is unchecked and its form is reset
- **THEN** it is checked again and `onCheckedChange(true, details)` is called with
  `details.reason === "RESET"`

#### Scenario: Item — Form attribute (base-ui#4334)

- **WHEN** a Checkbox outside any form has `form="prefs"` and `name="dark"` and is checked
- **THEN** submitting the form with id `prefs` sends `dark=on`

### Requirement: Item Data Attributes

These rules apply to `CheckboxGroup.Item` (with `CheckboxGroup.ItemIndicator`), alone or in a group (formerly the `checkbox` capability).

Every part SHALL carry `data-scope="checkbox"`, its `data-part` (`root`, `control`,
`indicator`, `label`, `description`, `hidden-input`) and `data-instance`. The Root, Control,
Indicator, Label and Description SHALL carry `data-state` (`checked`, `unchecked` or
`indeterminate`) and, when they apply, `data-disabled`, `data-readonly`, `data-required` and
`data-invalid`. The Control SHALL carry `data-focus`, `data-focus-visible`, `data-pressed`
(a press in progress) and `data-hover` as defined by the interaction modules, and the Root
SHALL mirror `data-focus` and `data-focus-visible`.

#### Scenario: Item — Styling the row

- **WHEN** a Checkbox is checked and focused with the keyboard
- **THEN** its Root carries `data-state="checked"` and `data-focus-visible`, and its
  Indicator carries `data-state="checked"`

#### Scenario: Item — Pressed means press in progress

- **WHEN** the pointer is held down on a checked Control
- **THEN** the Control carries `data-pressed` and `data-state="checked"`, and after release
  `data-pressed` is gone and `data-state` is `unchecked`

### Requirement: Item Contract

These rules apply to `CheckboxGroup.Item` (with `CheckboxGroup.ItemIndicator`), alone or in a group (formerly the `checkbox` capability).

The Checkbox SHALL ship a contract with scope `checkbox`, anatomy `root`, `control`,
`indicator`, `label`, `description` and `hidden-input`, located by role `checkbox` and exact
accessible name, with:

- actions:
  - `toggle`: pointer click on the Control; touch tap; keyboard Space on the Control.
    Postcondition: `checkedState` differs from its value before the action, unless the
    Checkbox is disabled or read-only.
  - `check` and `uncheck`: toggle when needed. Postcondition: `isChecked` is `true` or
    `false` respectively.
  - `clickLabel`: pointer click on the Label. Keyboard declared as none, with the reason "a
    label has no keyboard interaction; keyboard users toggle the Control with Space".
  - `resetForm`: pointer click on the form's reset button; keyboard Enter on it.
    Postcondition: `checkedState` equals the default.
- queries: `checkedState` (`true`, `false` or `"indeterminate"`, read from `aria-checked`),
  `isChecked`, `isIndeterminate`, `isDisabled`, `isReadOnly`, `isRequired`, `isInvalid`,
  `name` (the accessible name), `description` (the accessible description) and `formValue`
  (the value the hidden input would submit, or `null`; read from DOM properties);
- states: `unchecked` (`checkedState: false`), `checked` (`checkedState: true`),
  `indeterminate` (`checkedState: "indeterminate"`);
- events: `TOGGLE` → `toggle`, `RESET` → `resetForm`;
- traits: `form-associated`.

The virtual modality SHALL be derived from the pointer implementations.

#### Scenario: Item — Same test in both environments

- **WHEN** a test runs `getCheckbox(screen, { name: "Accept terms" }).check()`, and the same
  code with a Playwright `page`
- **THEN** both resolve once `isChecked()` is `true`

#### Scenario: Item — Keyboard twin

- **WHEN** a test runs `checkbox.via("keyboard").toggle()`
- **THEN** the Control receives Space and the value changes

#### Scenario: Item — Form value

- **WHEN** a test checks a Checkbox with `name="tos"` and reads `formValue()`
- **THEN** it returns `"on"`, and after `uncheck()` it returns `null`

### Requirement: Item Checkbox Invariants

These rules apply to `CheckboxGroup.Item` (with `CheckboxGroup.ItemIndicator`), alone or in a group (formerly the `checkbox` capability).

The Checkbox contract SHALL ship invariants, always on, that hold after every model-based
test step:

- the Control's `aria-checked` corresponds to the oracle's state (`mixed` exactly in
  `indeterminate`);
- the component renders exactly one element with role `checkbox`;
- when a Label is rendered, the Control's accessible name equals the Label's text, and it is
  the same in every state.

`@rind-ui/testing` SHALL export, as a consumer invariant usable with
`testMachine(checkboxContract, { invariants })` (`checkboxStepInvariants()`), the
invariant that needs the keys a step pressed, which the shared invariant API does not
carry: an Enter key on the Control never changes the value.

#### Scenario: Item — Broken variant toggles on Enter

- **WHEN** a variant of the Checkbox toggles on Enter and is run through the model-based
  tests
- **THEN** a step that presses Enter on the Control fails `checkbox-enter-never-changes`

### Requirement: Item Theme

These rules apply to `CheckboxGroup.Item` (with `CheckboxGroup.ItemIndicator`), alone or in a group (formerly the `checkbox` capability).

`@rind-ui/theme` SHALL style the Checkbox through its `data-*` attributes only:

- the checkmark and the dash are glyphs drawn with `currentColor`, visible and
  distinguishable in forced colors, with checked and mixed using system colours;
- the control's border stays visible in forced colors;
- the pressable target is at least 24×24 CSS px (control plus label, or the hit-area
  property);
- the focus ring follows `theme-accessibility`;
- every transition uses duration tokens that become zero under reduced motion.

#### Scenario: Item — Forced colors (react-spectrum#4029)

- **WHEN** an unchecked, a checked and an indeterminate Checkbox are rendered with forced
  colors emulated
- **THEN** all three are visible and each state looks different from the others

### Requirement: Item Field Control Binding

These rules apply to `CheckboxGroup.Item` (with `CheckboxGroup.ItemIndicator`), alone or in a group (formerly the `checkbox` capability).

The Checkbox SHALL implement `field-control` (`add-field`). Its Root SHALL read the
nearest Field's binding and register the Checkbox with that Field exactly once (id,
labelable Control, focus operation on the Control, the hidden input as validity element,
a reader for `checked`), unregistering on unmount. A Checkbox that is an item of a
Checkbox Group SHALL NOT register; the group does. The Field's ARIA SHALL be applied only
to the registered Control: `aria-describedby` with the Field's Description and, while
rendered, ErrorMessage ids; `aria-invalid` (role `checkbox` allows it) while the Field
displays invalid; `aria-required` from the Field's `required`. Its `disabled`, `readOnly`,
`required` and `invalid` SHALL be OR-merged with the Field's and an enclosing Fieldset's
(field-control "State Propagation"). It SHALL report each accepted toggle and reset once,
declare the `field-associated` trait, and add the Field prop × control matrix test.

#### Scenario: Item — Checkbox in an invalid, required Field

- **WHEN** a Checkbox with no props of its own is inside a Field with `required` that
  displays an error
- **THEN** its Control has `aria-required="true"` and `aria-invalid="true"`, its
  `aria-describedby` contains the ErrorMessage id, its hidden input is `required`, and its
  Root carries `data-required` and `data-invalid`

#### Scenario: Item — Fieldset disables the Checkbox

- **WHEN** a Checkbox is inside a Field inside a disabled Fieldset
- **THEN** the Checkbox is disabled exactly as its own `disabled` prop makes it

