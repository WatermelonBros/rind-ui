## Purpose

Defines rind-ui's Checkbox Group: a labelled set of checkboxes sharing one array value,
an optional tri-state "select all" parent checkbox, and group-level disabled, read-only,
required, form submission and reset behaviour, built from the `checkbox`,
`hidden-form-input` and `control-label` capabilities of `add-checkbox`.

## ADDED Requirements

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
once any item is checked, none SHALL carry them unless the item is itself `required`.
An item's own `required` SHALL always keep its own constraint. `aria-required` SHALL NOT
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
