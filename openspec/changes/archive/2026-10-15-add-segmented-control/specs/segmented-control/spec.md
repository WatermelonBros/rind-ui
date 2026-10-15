## Purpose

Defines the Segmented Control component: a horizontal set of segments of which one is
selected, exposed and operated as a radio group, with a sliding indicator, form
participation, and a contract that lets drivers select and read segments in any test
environment.

## ADDED Requirements

### Requirement: Anatomy

Segmented Control SHALL consist of a `root` part, an optional `label` part, one `item`
part per segment and an optional `indicator` part rendered inside the root. Each item
SHALL be a button-like element (`add-button` `button-like-element`) with `role="radio"`,
named by its content, identified by a `value` key and registered as a static collection
item (`add-collections`). Each item SHALL render its hidden form input
(`add-checkbox` `hidden-form-input`, `type="radio"`) as a sibling of the item element,
never inside it. Every part SHALL accept the `render` prop.

#### Scenario: Segment is one element

- **WHEN** a segment "Week" is rendered
- **THEN** the element with `role="radio"` and name "Week" is the element the user clicks
  and focuses, and its hidden input is not its descendant

#### Scenario: Icon-only segment

- **WHEN** a segment renders only an icon and no `aria-label` in development
- **THEN** a warning names the item

### Requirement: Radio Semantics And Behaviour

Segmented Control SHALL behave as the `radio-group` capability (`add-radio-group`)
specifies for value, keyboard and activation, tab stop and focus, disabled, read-only,
required and invalid states, roles and names, form participation and announcements, with
the root as the `radiogroup`, the `label` part as its label and each item as both item
and item control. Arrow keys SHALL move and select; focus alone SHALL NOT select; a
pressed selected segment SHALL stay selected; Enter SHALL perform the form's implicit
submission. The default `orientation` SHALL be `horizontal` (affecting
`aria-orientation`, `data-orientation` and the indicator only; all four arrows work).

#### Scenario: Announced as one of N

- **WHEN** a control with segments "Day", "Week", "Month" and "Week" selected is inspected
  in the accessibility tree
- **THEN** the root is a `radiogroup` named by its label and each segment is a `radio`
  with `aria-checked`, "Week" being `"true"`

#### Scenario: Arrow selects

- **WHEN** "Week" is selected and focused and the user presses ArrowRight
- **THEN** "Month" is focused and selected in the same step

#### Scenario: Read-only is honoured (zag#829)

- **WHEN** a read-only control has "Week" selected and the user clicks "Month" and
  presses ArrowRight
- **THEN** focus may move, but the value stays "Week"

#### Scenario: Focus alone does not select

- **WHEN** focus moves to "Month" programmatically with no key or pointer event
- **THEN** the value stays "Week"

### Requirement: Indicator

The `indicator` part SHALL follow the `selection-indicator` capability (`add-tabs`),
measuring the selected segment relative to the root, and SHALL carry
`data-scope="segmented-control"`.

#### Scenario: Shown on a conditional mount (ark#3435, ark#3703)

- **WHEN** a control with `defaultValue="week"` is mounted after the page's first render
- **THEN** once laid out the indicator is visible with the box of "Week", without another
  interaction

#### Scenario: First change animates (ark#1129)

- **WHEN** the user selects "Month" for the first time after load
- **THEN** the indicator moves to "Month" without `data-resizing`, so the theme's
  transition runs

#### Scenario: Inside a scrolled container (zag#2810)

- **WHEN** the control sits in a horizontally scrolled container and "Month" is selected
- **THEN** the indicator's variables equal the box of "Month" relative to the root

#### Scenario: Nothing selected

- **WHEN** the value is `null`
- **THEN** the indicator carries `hidden`

### Requirement: Data Attributes

Every part SHALL carry `data-scope="segmented-control"` — never another component's
scope — and its `data-part` (`root`, `label`, `item`, `indicator`). The root SHALL carry
`data-orientation`, and `data-disabled`, `data-readonly`, `data-required` and
`data-invalid` when those states hold. Each item SHALL carry `data-key`,
`data-orientation`, `data-state="checked|unchecked"`, `data-highlighted` when it is the
roving focus target, `data-disabled`, `data-readonly` and `data-invalid` when those
states hold, and the `button-like-element` attributes `data-focus`, `data-focus-visible`,
`data-pressed` and `data-hover`. The indicator SHALL carry the `selection-indicator`
attributes. Every attribute SHALL change in the same step as the state.

#### Scenario: Own scope (ark#2629)

- **WHEN** a Segmented Control renders
- **THEN** no element it renders carries `data-scope="radio-group"`

#### Scenario: Selected segment

- **WHEN** "Week" is selected and focused by keyboard
- **THEN** it carries `data-key="week"`, `data-state="checked"`, `data-highlighted`,
  `data-focus` and `data-focus-visible`

### Requirement: Contract

Segmented Control SHALL ship a contract with scope `segmented-control`, anatomy `root`,
`label`, `item`, `indicator`, located by role `radiogroup` and exact accessible name.
Actions: `select(name)` — pointer and touch: press the segment named `name`; keyboard:
focus the control and press ArrowRight until that segment is selected; completes when
`selected()` equals `name`. Queries: `segments()` (accessible names in order),
`selected()` (name of the segment with `aria-checked="true"`, or null),
`focusedSegment()`, `isDisabled(name)` and `formValue()`. Traits: `composite-roving`,
`selectable` and `directional`. Focus SHALL change only the focus state and the
focused-segment query, never the value; the contract declares the item as committing on
focus for that reason, and the value is checked by the `selectable` and
`form-associated` invariants after every step. A
generated driver `getSegmentedControl(target, { name })` SHALL be exported from
`@rind-ui/testing`.

#### Scenario: Same test in both environments

- **WHEN** a test calls `getSegmentedControl(screen, { name: "Range" }).select("Month")`
  and then the same with a Playwright `page`
- **THEN** both resolve once "Month" is selected

#### Scenario: Model-based run

- **WHEN** `testMachine(segmentedControlContract, …)` runs with argument classes for no
  value, a disabled segment, read-only and both directions
- **THEN** every transition runs in the pointer, touch, keyboard and virtual modalities
  with every generic and trait invariant checked after each step

### Requirement: Theme

`@rind-ui/theme` SHALL style Segmented Control through data attributes only: a sliding
indicator sized and positioned from the `--rind-indicator-*` custom properties with a
transition from duration tokens, disabled under `prefers-reduced-motion: reduce` and while
the indicator carries `data-resizing`; a selected-segment cue that does not depend on the
indicator under `forced-colors: active` (border or `Highlight`); segments of at least
24×24 CSS px; and the shared focus ring on `data-focus-visible`.

#### Scenario: High contrast

- **WHEN** a control is rendered with forced colors emulated
- **THEN** the selected segment is distinguishable even though the indicator's background
  is not painted

#### Scenario: Reduced motion

- **WHEN** the selection changes with reduced motion emulated
- **THEN** the indicator moves without a transition
