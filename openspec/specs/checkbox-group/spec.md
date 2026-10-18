# checkbox-group Specification

## Purpose
Defines rind-ui's Checkbox Group: a labelled set of checkboxes sharing one array value,
an optional tri-state "select all" parent checkbox, and group-level disabled, read-only,
required, form submission and reset behaviour, built from the `checkbox`,
`hidden-form-input` and `control-label` capabilities of `add-checkbox`.
## Requirements
### Requirement: Group Value

A checkbox group SHALL own a controllable value `value: string[]` (props `value`,
`defaultValue`, `onValueChange(value, details)`), compared as a set. Every `Checkbox`
rendered inside the group with a `value` prop SHALL be an item whose checked state is
derived from the group value during render (identical on the server and the client) and
whose activation proposes the group value with that item added or removed. Items SHALL
NOT keep checked state of their own. Each user toggle SHALL call `onValueChange` exactly
once, with `details.reason` naming the event. An item rendered without a `value` SHALL be
a development error.

#### Scenario: Toggling an item

- **WHEN** the group value is `["a"]` and the user activates item `b`
- **THEN** `onValueChange` is called once with `["a", "b"]` and item `b` has
  `aria-checked="true"`

#### Scenario: One callback per change (Bits UI #1613)

- **WHEN** the user checks one item in an uncontrolled group
- **THEN** `onValueChange` is called exactly once

#### Scenario: Server render with a default value (Bits UI #1249)

- **WHEN** a group with `defaultValue={["b"]}` is rendered on the server and hydrated
- **THEN** item `b` is checked in the server HTML and no hydration warning occurs

#### Scenario: Controlled group refuses

- **WHEN** a controlled group's parent does not apply a proposed value
- **THEN** every item keeps its previous checked state

### Requirement: Group Semantics And Labelling

The group Root SHALL have `role="group"` and SHALL be named by its Label part through
`aria-labelledby`, set only while the Label is rendered; the Label SHALL NOT be a
`<label>` element and SHALL NOT point at any item. The Root's `aria-describedby` SHALL
list the Description and, while rendered, the ErrorMessage. When the consumer renders
Root as a `<fieldset>` and Label as its `<legend>`, connect SHALL emit neither `role` nor
`aria-labelledby` on Root. Every item SHALL keep its own unique ids and its own label
(`control-label`); the group SHALL add its Description and ErrorMessage ids to each item
Control's `aria-describedby`. The group SHALL render no live region.

#### Scenario: Group name

- **WHEN** a group with Label "Toppings" is rendered
- **THEN** the element with role `group` has the accessible name "Toppings"

#### Scenario: Items keep their own ids (Ark #2895, Base UI #4121)

- **WHEN** three items render inside a labelled group
- **THEN** every item Control has a distinct id, and clicking each item's label toggles
  only that item

#### Scenario: Group description reaches the focused item

- **WHEN** a group has a Description "Pick at least one" and an item receives focus
- **THEN** that item's accessible description contains "Pick at least one"

#### Scenario: Fieldset rendering

- **WHEN** Root is rendered as `<fieldset>` and Label as `<legend>`
- **THEN** Root has no `role` attribute and no `aria-labelledby`, and its accessible name
  is the legend text

### Requirement: Keyboard And Focus

Every enabled item and the Parent SHALL be its own Tab stop in DOM order; Space SHALL
toggle the focused checkbox (inherited from `checkbox`). The group SHALL NOT add arrow-key,
Home/End or typeahead navigation and SHALL NOT manage a roving tab index. Toggling the
Parent SHALL leave focus on the Parent.

#### Scenario: Tab through items (RA #5907)

- **WHEN** focus is on the first item and the user presses Tab
- **THEN** focus moves to the second item, and ArrowDown on an item changes neither focus
  nor value

#### Scenario: Space on the parent

- **WHEN** the Parent has focus and the user presses Space
- **THEN** the group value changes according to the parent cycle and focus stays on the
  Parent

### Requirement: Select-All Parent Checkbox

A group SHALL support one `Parent` part: a checkbox with the full Checkbox anatomy whose
state is derived from the group and the `allValues` prop (required to render `Parent`;
its absence is a development error). The Parent SHALL be `checked` when every value in
`allValues` is selected, `unchecked` when none is, and otherwise `indeterminate`
(`aria-checked="mixed"`). Its `aria-controls` SHALL list the ids of the currently
rendered items only. The Parent SHALL NOT be submitted with the form and SHALL NOT have a
value of its own: activating it only proposes a new group value.

#### Scenario: Mixed state

- **WHEN** `allValues` is `["a", "b", "c"]` and the value is `["a"]`
- **THEN** the Parent has `aria-checked="mixed"` and `data-state="indeterminate"`

#### Scenario: Only rendered ids in aria-controls (Base UI #2691)

- **WHEN** item `c` has a consumer id `custom-c` and item `b` is not rendered
- **THEN** the Parent's `aria-controls` contains the ids of `a` and `custom-c` and no id
  for `b`

#### Scenario: The parent proposes only an array (Base UI #4896)

- **WHEN** the user activates the Parent
- **THEN** `onValueChange` receives a `string[]` and no callback receives a boolean for
  the Parent

#### Scenario: Parent not submitted

- **WHEN** a form containing the group with a Parent is submitted
- **THEN** the form data contains entries only for checked items

### Requirement: Parent Cycle

Activating the Parent SHALL follow the APG tri-state cycle. Selectable-all SHALL mean every
enabled value in `allValues` plus every disabled value already selected; selectable-none
SHALL mean only the disabled values already selected. When the value is a partial
selection (neither selectable-all nor selectable-none), activation SHALL remember it and select all; the next activation SHALL select
none; the next SHALL restore the remembered partial selection. When the value is already
selectable-all, activation SHALL select none; when it is anything else with no remembered
partial selection, activation SHALL select all. Any item toggle SHALL end the cycle and
make the resulting value the new remembered selection. This SHALL hold identically for
controlled and uncontrolled groups; a refused proposal SHALL end the cycle.

#### Scenario: Full cycle

- **WHEN** `allValues` is `["a", "b", "c"]`, the value is `["a"]` and the user activates the
  Parent three times
- **THEN** the value becomes `["a", "b", "c"]`, then `[]`, then `["a"]`

#### Scenario: Controlled cycle (Base UI #4552)

- **WHEN** the same three activations, plus a fourth, are made on a controlled group whose
  parent applies every proposal
- **THEN** the values are `["a","b","c"]`, `[]`, `["a"]`, `["a","b","c"]`

#### Scenario: Disabled items are never changed (Base UI #729)

- **WHEN** item `c` is disabled and unchecked, item `b` is disabled and checked, the value
  is `["b"]` and the user activates the Parent twice
- **THEN** the value becomes `["a", "b"]` (c untouched, Parent still mixed), then `["b"]`

#### Scenario: Item toggle resets the memory

- **WHEN** the Parent selected all and the user then unchecks item `b`
- **THEN** the next Parent activation selects all again, and the one after selects none

### Requirement: Disabled And Read-Only Propagation

A disabled group SHALL make every item and the Parent disabled; a read-only group SHALL
make them read-only. An item's own `disabled` or `readOnly` SHALL apply in addition
(`group OR item`): an item SHALL NOT be re-enabled by passing `false` inside a disabled
group, and an item SHALL be disableable on its own inside an enabled group. Disabled and
read-only items SHALL ignore activation; their value membership SHALL be unchanged by
the Parent.

#### Scenario: Group disabled wins (Base UI #1043)

- **WHEN** a group is disabled and one item passes `disabled={false}`
- **THEN** that item is disabled

#### Scenario: Item disabled inside a group (Ark #3759)

- **WHEN** an enabled group contains an item with `disabled`
- **THEN** only that item is disabled and the others stay operable

#### Scenario: Read-only group

- **WHEN** the user presses Space on an item of a read-only group
- **THEN** the value does not change and the item keeps focus and `aria-readonly="true"`

### Requirement: Required Group

A group with `required` SHALL be valid when at least one item is checked. While the value
is empty, every enabled item SHALL carry `aria-required="true"` on its Control and
`required` on its hidden input, so native validation fails and focuses the first item;
once any item is checked, no item SHALL carry a GROUP-DERIVED `aria-required` or
`required`; an individually required item keeps its own (checked or not). An item's own
`required` SHALL always keep its own constraint. This rule is checked by DOM tests, not by a
per-contract invariant: the DOM cannot tell a group-derived `aria-required` from an item's own. `aria-required` SHALL NOT
be set on the group element. Native validation SHALL focus the first invalid item's
Control (`hidden-form-input`), not the first item.

#### Scenario: Empty required group blocks submission (Reka #1777, #2013, Base UI #1426)

- **WHEN** a form with a required, empty group is submitted
- **THEN** submission is blocked and focus moves to the first enabled item's Control

#### Scenario: One checked is enough (not all — Bits UI)

- **WHEN** one item of a required group is checked and the form is submitted
- **THEN** the group passes validation and no item carries `aria-required`

#### Scenario: Item-level required (Base UI #4952)

- **WHEN** items `a` and `b` are individually required and only `a` is checked
- **THEN** validation fails on `b`

#### Scenario: Focus goes to the failing item (Base UI #5200)

- **WHEN** item `a` is checked, item `b` is individually required and unchecked, and the
  form is submitted
- **THEN** focus moves to item `b`'s Control

#### Scenario: Validity recomputed on change (RA #6173, #5693)

- **WHEN** a required group failed validation and the user then checks an item
- **THEN** no item's hidden input is invalid in the same step

### Requirement: Invalid State

A group SHALL accept an `invalid` prop: Root SHALL carry `data-invalid`, and every item
Control SHALL carry `aria-invalid="true"` and the ErrorMessage id in `aria-describedby`
while the ErrorMessage is rendered. The ErrorMessage SHALL NOT be a live region.

#### Scenario: Error reaches the items

- **WHEN** a group is `invalid` and renders an ErrorMessage "Pick one"
- **THEN** each item has `aria-invalid="true"` and its accessible description contains
  "Pick one"

### Requirement: Form Submission And Reset

Each item SHALL submit through its own hidden input (`hidden-form-input`) under the
group's `name` (an item's own `name` is ignored inside a group) and `form`, with the
item's `value`, so form data equals native checkboxes sharing a name: only enabled,
rendered, checked items are submitted. A form `reset` SHALL be handled once by the
group: it SHALL send one `RESET` event that proposes `defaultValue` (uncontrolled: applies
it), and items inside a group SHALL NOT reset themselves.

#### Scenario: Native submission

- **WHEN** the group `name` is `toppings`, items `a` and `c` are checked and item `c` is
  disabled
- **THEN** the submitted form data contains `toppings=a` only

#### Scenario: Reset unchecks every box at once (RA #7749, #10643)

- **WHEN** the user checks items `a`, `b` and `c` of a group with no default value and the
  form is reset
- **THEN** after the reset all three items are unchecked and `onValueChange` was called
  once with `[]` and reason `RESET`

### Requirement: Data Attributes

Root SHALL carry `data-scope="checkbox-group"`, `data-part="root"` and, when applicable,
`data-disabled`, `data-readonly`, `data-required` and `data-invalid`. Label, Description
and ErrorMessage SHALL carry `data-part` `label`, `description` and `error-message` and
the Root's `data-disabled` / `data-invalid`. The Parent SHALL carry every `data-*`
attribute of a checkbox plus `data-parent`; every item Root and Control SHALL carry the
checkbox attributes plus `data-value` with the item's value.

#### Scenario: Styling hooks

- **WHEN** a disabled group with a Parent and an item `a` is rendered
- **THEN** Root has `data-disabled`, the Parent's Control has `data-parent` and
  `data-disabled`, and item `a`'s Control has `data-value="a"`

### Requirement: Contract

The Checkbox Group contract SHALL locate an instance by role `group` and exact accessible
name and SHALL declare: action `toggle(label)` (pointer: click the item Control named
`label`; keyboard: focus it and press Space), action `toggleParent()` (pointer: click the
Parent Control; keyboard: focus it and press Space), each waiting for the value to change;
queries `value()` (the `data-value` of every item with `aria-checked="true"`, in DOM
order), `parentState()` (`"checked" | "unchecked" | "mixed"` from the Parent's
`aria-checked`), `isDisabled()`, `isRequired()` and `isInvalid()`; the event map
`ITEM.TOGGLE → toggle` (first enabled item) and `PARENT.TOGGLE → toggleParent`; and the
trait `form-associated`. Every pointer action SHALL therefore also run in the `virtual`
modality.

#### Scenario: Driver in two environments

- **WHEN** a test runs `getCheckboxGroup(screen, { name: "Toppings" }).toggle("Olives")`
  and the same call with a Playwright `page`
- **THEN** both resolve after "Olives" is checked and `value()` includes its value

#### Scenario: Virtual activation toggles once

- **WHEN** `toggleParent()` runs in the `virtual` modality on a mixed Parent
- **THEN** the value is selectable-all after exactly one change

### Requirement: Field Control Binding

The Checkbox Group SHALL implement add-field's `field-control` binding. Its Root SHALL read the
nearest Field's binding and register the group with that Field exactly once as one control (non-labelable group
root, focus operation, a validity element, a reader for the value list), unregistering on
unmount. Its item Checkboxes SHALL NOT register.
The Field's ARIA SHALL be applied only to the registered group: the root is named by
the Field's Label through `aria-labelledby` and its `aria-describedby` lists the Field's
Description and, while rendered, ErrorMessage ids; `aria-invalid` goes where the group puts
it for its own `invalid` prop (each item Control, role `checkbox`); required from the
Field. The group's own ErrorMessage part SHALL remain usable outside a Field and SHALL
defer to the Field's ErrorMessage inside one.
Its `disabled`, `readOnly`, `required` and `invalid` SHALL be OR-merged with the Field's
and an enclosing Fieldset's (field-control "State Propagation"). It SHALL report each
accepted change exactly once (field-control "Reporting Changes"), register a focus
target that moves focus to the first invalid item, or else the first enabled item (base-ui#5200), declare the `field-associated` trait, and add the Field prop × control
matrix test.

#### Scenario: Group in an invalid Field

- **WHEN** a Checkbox Group with three items is inside a Field that displays the error
  "Pick one"
- **THEN** only the group registers, the group is named by the Field's Label, each item
  Control has `aria-invalid="true"`, and the group's accessible description contains
  "Pick one"

#### Scenario: Disabled Fieldset

- **WHEN** a Checkbox Group is inside a Field inside a disabled Fieldset
- **THEN** every item is disabled exactly as the group's own `disabled` prop makes it

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

