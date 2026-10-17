# toggle-group Specification

## Purpose
Defines the Toggle Group component: a named group of toggle buttons with single or
multiple selection, toolbar-style keyboard navigation in which arrow keys only move focus,
one tab stop, and a contract that lets drivers press items and read the pressed set in any
test environment.
## Requirements
### Requirement: Anatomy

Toggle Group SHALL consist of a `root` part and one `item` part per toggle. Each item
SHALL be a Toggle as specified by the `toggle` capability (`add-toggle`) whose pressed
state is owned by the group, identified by a `value` key and registered as a static
collection item (`add-collections`). Every part SHALL accept the `render` prop.

#### Scenario: Items keep Toggle behaviour

- **WHEN** an item is rendered as a `<span>` through `render`
- **THEN** it has `role="button"`, `aria-pressed`, a roving `tabIndex`, and pressing it
  with Space toggles it

#### Scenario: Group disabled reaches every item (react-spectrum#7798)

- **WHEN** the root is `disabled`
- **THEN** every item is disabled, receives no hover or press attributes, and cannot be
  pressed

### Requirement: Semantics

The root SHALL have role `group` and SHALL NOT carry `aria-orientation`. Each item SHALL
be a button with `aria-pressed` set explicitly to `"true"` or `"false"` in both selection
modes; items SHALL NOT use `role="radio"` or `aria-checked`, and the root SHALL NOT use
`role="radiogroup"`. The root SHALL be named by `aria-label` or `aria-labelledby`;
without either, a development warning SHALL name the root.

#### Scenario: Single mode is still toggle buttons (radix#4119, base-ui#3525)

- **WHEN** a single-selection group renders "Left", "Center", "Right" with "Left" pressed
- **THEN** the root has role `group`, every item has role `button`, "Left" has
  `aria-pressed="true"` and the others `aria-pressed="false"`, and no element has role
  `radio`

#### Scenario: Unnamed group (radix#754)

- **WHEN** a group renders without `aria-label` or `aria-labelledby` in development
- **THEN** a warning names the root part

#### Scenario: No aria-orientation on group (radix#964)

- **WHEN** a vertical group renders
- **THEN** the root has `data-orientation="vertical"` and no `aria-orientation`

### Requirement: Value And Selection Modes

Toggle Group SHALL have a controllable value `value: string[]` (`value`, `defaultValue`,
`onValueChange(value, details)`), defaulting to `[]`, and `selectionMode: "single" |
"multiple"` defaulting to `single`. Pressing an unpressed item SHALL add it (single mode:
replace the selection with it); pressing a pressed item SHALL remove it, unless
`disallowEmptySelection` is true and it is the only pressed item. The empty array SHALL
represent "none" in both modes. `details.reason` SHALL be `PRESS` and `details.cancel()`
SHALL veto the change. Disabled items SHALL never be added by a user action.

#### Scenario: Deselect in controlled single mode (radix#721, radix#2254)

- **WHEN** a controlled single group with `value={["bold"]}` has its pressed item clicked
  once and the parent applies the proposed value
- **THEN** `onValueChange([])` was called once and no item is pressed after that one click

#### Scenario: Single replaces

- **WHEN** "Left" is pressed in single mode and the user presses "Right"
- **THEN** the value is `["right"]`

#### Scenario: Multiple adds and removes

- **WHEN** in multiple mode the user presses "Bold", then "Italic", then "Bold"
- **THEN** the value is `["italic"]`

#### Scenario: At least one (zag#2412)

- **WHEN** `disallowEmptySelection` is set and the only pressed item is pressed again
- **THEN** it stays pressed and `onValueChange` is not called

#### Scenario: Pressing the pressed item in single mode (reka-ui#992)

- **WHEN** an uncontrolled single group with no `defaultValue` has "Left" pressed and
  "Left" is pressed again
- **THEN** no error occurs and the value is `[]`

### Requirement: Keyboard And Activation

Arrow keys SHALL move focus between enabled items and SHALL NOT change the value: with
`orientation: "horizontal"` (default) ArrowRight and ArrowLeft move to the next and
previous item and ArrowUp/ArrowDown do nothing; with `orientation: "vertical"` ArrowDown
and ArrowRight move to the next item and ArrowUp and ArrowLeft to the previous one. Home
and End SHALL move to the first and last enabled item. Horizontal arrows SHALL be
mirrored under `dir="rtl"`. Moves SHALL wrap when `loop` is true (default). An item SHALL
be pressed only by a `PRESS` from the toggle capability — pointer or touch release, Enter,
Space, or an assistive-technology `click` — exactly once per activation. Focus alone SHALL
NOT press an item. Arrow keys with Alt, Control or Meta, and composing events, SHALL do
nothing.

#### Scenario: Arrows only move

- **WHEN** "Left" is pressed and focused and the user presses ArrowRight
- **THEN** "Center" is focused and the value is still `["left"]`

#### Scenario: Home and End (base-ui#3970)

- **WHEN** focus is on the second of four items and the user presses End, then Home
- **THEN** focus moves to the fourth item, then to the first

#### Scenario: Enter presses (reka-ui#638)

- **WHEN** a focused unpressed item receives Enter
- **THEN** it becomes pressed

#### Scenario: Vertical accepts both pairs

- **WHEN** ArrowRight is pressed on an item of a vertical group
- **THEN** the next item is focused

#### Scenario: RTL

- **WHEN** ArrowLeft is pressed on the first item of a horizontal group under `dir="rtl"`
- **THEN** the second item is focused

#### Scenario: Virtual focus does not press

- **WHEN** focus moves to an unpressed item programmatically with no key or pointer event
- **THEN** the value does not change

### Requirement: Tab Stop And Focus

The group SHALL be exactly one Tab stop on an item, following `add-collections`: the
focused item; else the first pressed navigable item; else the first navigable item; else
the root. The root SHALL never be the tab stop while an item is navigable, and SHALL NOT
redirect focus. Before items register (server render), the first item whose value is in
the selected value SHALL have `tabIndex=0`, else the first item rendered. Pressing an item
with a pointer SHALL focus it, including in Safari, which does not focus buttons on click.

#### Scenario: Dialog initial focus (radix#3077)

- **WHEN** a dialog whose first focusable content is a Toggle Group opens
- **THEN** the dialog's initial focus lands on the group's tab-stop item

#### Scenario: Safari click focus (radix#703)

- **WHEN** the user clicks the third item in Safari
- **THEN** the third item is focused and becomes the tab stop

#### Scenario: Focus attributes cleared on blur (zag#2190)

- **WHEN** focus leaves the group
- **THEN** no item and not the root carries `data-focus`

### Requirement: Disabled Items

A disabled item SHALL follow the toggle capability (native `disabled`, or `aria-disabled`
with `focusableWhenDisabled`), SHALL be skipped by arrow keys unless the root sets
`focusableWhenDisabled`, and SHALL never be pressed. Every search for the next navigable
item SHALL stop after one pass.

#### Scenario: Disabled item skipped

- **WHEN** the second of three items is disabled and the user presses ArrowRight on the
  first
- **THEN** the third item is focused

#### Scenario: Focusable when disabled (base-ui#5834)

- **WHEN** `focusableWhenDisabled` is set and the second item is disabled
- **THEN** ArrowRight from the first item focuses the second, which has
  `aria-disabled="true"` and does not toggle on Space

### Requirement: Announcements

Toggle Group SHALL NOT announce through the Announcer or render a live region: state is
conveyed by `aria-pressed` on the focused item.

#### Scenario: Pressing an item

- **WHEN** the user presses Space on a focused item
- **THEN** no Announcer message is recorded

### Requirement: Data Attributes

The root SHALL carry `data-scope="toggle-group"`, `data-part="root"`, `data-orientation`,
`data-selection-mode` (`single` or `multiple`), `data-focus` while an item has focus and
`data-disabled` when disabled. Each item SHALL carry `data-scope="toggle-group"`,
`data-part="item"`, `data-key`, `data-orientation`, `data-highlighted` when it is the
roving focus target, and the toggle capability's attributes (`data-state="on|off"`,
`data-disabled`, `data-focus`, `data-focus-visible`, `data-pressed` for a press in
progress, `data-hover`). Every attribute SHALL change in the same step as the state.

#### Scenario: Pressed versus being pressed

- **WHEN** "Bold" is pressed (on) and idle, and the pointer is then held down on "Italic"
- **THEN** "Bold" has `data-state="on"` and no `data-pressed`; "Italic" has `data-pressed`
  and `data-state="off"` until release

### Requirement: Contract

Toggle Group SHALL ship a contract with scope `toggle-group`, anatomy `root` and `item`,
located by role `group` and exact accessible name. Actions: `toggle(name)` — pointer and
touch: press the item named `name`; keyboard: arrow keys until that item is focused, then
Space; completes when the item's `aria-pressed` has flipped. Queries: `items()`
(accessible names in order), `pressed()` (names with `aria-pressed="true"`, in order),
`focusedItem()` and `isDisabled(name)`. Traits: `composite-roving` and `directional`. The
contract SHALL ship a per-component invariant: every item carries `aria-pressed` set
explicitly to `"true"` or `"false"`, the pressed set equals the oracle's selection, and in
single mode at most one item is pressed. Focus SHALL change only the focus state and the focused-item query,
never the value; the contract declares the item as committing on focus for that reason, and
the value is checked by the `aria-pressed` invariant after every step.
A generated driver `getToggleGroup(target, { name })` SHALL be exported from
`@rind-ui/testing`.

#### Scenario: Same test in both environments

- **WHEN** a test calls `getToggleGroup(screen, { name: "Text style" }).toggle("Bold")`
  and then the same with a Playwright `page`
- **THEN** both resolve once "Bold" is pressed and `pressed()` returns `["Bold"]`

#### Scenario: Model-based run

- **WHEN** `testMachine(toggleGroupContract, …)` runs with argument classes for single,
  multiple, `disallowEmptySelection`, vertical, all disabled and both directions
- **THEN** every transition runs in the pointer, touch, keyboard and virtual modalities
  with every generic, trait and per-component invariant checked after each step

### Requirement: Theme

`@rind-ui/theme` SHALL style Toggle Group through data attributes only, reusing the toggle
stylesheet's pressed cue (not colour alone, system colours under forced colors), items of
at least 24×24 CSS px, joined item borders for adjacent items, and the shared focus ring on
`data-focus-visible`.

#### Scenario: High contrast

- **WHEN** a group with one pressed item is rendered with forced colors emulated
- **THEN** the pressed item is distinguishable from the others

### Requirement: Hosted By A Toolbar

When a `CompositeHost` (add-toolbar's `composite-host` capability) is present, the Toggle
Group SHALL run in hosted mode instead of its own keyboard and tab-stop rules: its items
SHALL register with the host and join the host's roving focus in document order; the
group SHALL render no tab stop of its own, SHALL handle no arrow, Home or End keys and
SHALL not wrap at its own ends (the "tab stop is always an item" rule is the host's);
the host's `disabled` and `focusableWhenDisabled` SHALL apply to its items. It SHALL keep
role `group`, `aria-pressed` on its items, its name, its value and its change callbacks,
and Enter, Space and presses SHALL still press items. A toggle group inside a popup or
portal opened from a host control SHALL be standalone.

#### Scenario: Toggle group stays toggle buttons in a toolbar (regression: radix-ui/primitives#4119)

- **WHEN** a single-mode toggle group (Bold, Italic) sits between "Undo" and "Link" in a
  toolbar and focus is on "Undo"
- **THEN** ArrowRight three times focuses Bold, Italic, then Link; the items keep
  `aria-pressed` and the root keeps role `group`

#### Scenario: No callback from hosting (regression: huntabyte/bits-ui#446)

- **WHEN** a toolbar with a controlled multiple toggle group mounts and the user presses
  one item
- **THEN** `onValueChange` is called exactly once and exactly one control of the toolbar
  has `tabIndex=0`

### Requirement: Item Alone Or In A Group

ToggleGroup SHALL be the only component for this control. Its `Item` part SHALL have two shapes: inside `ToggleGroup.Root` it SHALL be one item of the group (the group's value, semantics and keyboard rules apply); outside any Root it SHALL be a single control with its own state, rendering no group wrapper and joining no roving tab order, exactly as the former `Toggle.Root`. `ToggleGroup.ItemIndicator` SHALL render the item's indicator in both shapes. The item machine, contract and driver SHALL stay those of the single control (data-scope `toggle`).

#### Scenario: A lone item

- **WHEN** a page renders one `ToggleGroup.Item` with no `ToggleGroup.Root`
- **THEN** there is no element with `role="group"` or a roving tab stop around it, and it behaves as the former single control

#### Scenario: An item in a group

- **WHEN** two `ToggleGroup.Item` parts are rendered inside `ToggleGroup.Root`
- **THEN** both belong to the group's value and follow the group's rules

### Requirement: Item Anatomy

These rules apply to `ToggleGroup.Item` (with `ToggleGroup.ItemIndicator`), alone or in a group (formerly the `toggle` capability).

Toggle SHALL consist of a `root` part and an optional `indicator` part. The root SHALL
be a button-like element as defined by the `button-like-element` capability
(`add-button`): a native `<button type="button">` by default, substitutable through
`render` without changing behaviour, disabled natively or, with
`focusableWhenDisabled`, through `aria-disabled`. The indicator SHALL be decorative
(`aria-hidden="true"`) and SHALL render its content while the toggle is on and its
fallback content, if any, while it is off.

#### Scenario: Item — Default element

- **WHEN** a Toggle is rendered with no `render` prop
- **THEN** the root is a `<button type="button">` and pressing it inside a form does
  not submit the form

#### Scenario: Item — Icon swap without a name change

- **WHEN** an icon-only Toggle named "Mute" renders a muted icon in its indicator when
  on and an unmuted icon as fallback when off
- **THEN** the icon changes with the state and the accessible name stays "Mute"

### Requirement: Item Pressed State

These rules apply to `ToggleGroup.Item` (with `ToggleGroup.ItemIndicator`), alone or in a group (formerly the `toggle` capability).

Toggle SHALL have a controllable boolean value `pressed` (`pressed`, `defaultPressed`,
`onPressedChange(pressed, details)`), defaulting to `false`. Each activation SHALL
propose the opposite value; `details.reason` SHALL be the activating event and
`details.cancel()` SHALL veto the change. In controlled mode the state SHALL change
only when the parent passes the new value. A Toggle created controlled SHALL stay
controlled: passing `pressed={undefined}` later SHALL produce a development warning and
SHALL NOT turn it uncontrolled.

#### Scenario: Item — Uncontrolled activation

- **WHEN** an uncontrolled Toggle that is off is clicked
- **THEN** it is on, and `onPressedChange(true, details)` was called once during the
  same activation

#### Scenario: Item — Controlled refusal

- **WHEN** a controlled Toggle with `pressed={false}` is clicked and the parent keeps
  passing `false`
- **THEN** `onPressedChange(true, …)` was called and the Toggle stays off

#### Scenario: Item — Un-pressing with undefined (radix#721, radix#2254)

- **WHEN** a controlled Toggle's parent maps "not pressed" to `undefined` and passes it
  after a click
- **THEN** a development warning names the `pressed` prop, the Toggle stays
  controlled, and the next click proposes a value again (no click is swallowed)

#### Scenario: Item — Cancelled change

- **WHEN** the consumer calls `details.cancel()` inside `onPressedChange`
- **THEN** the Toggle's state does not change

### Requirement: Item ARIA Semantics

These rules apply to `ToggleGroup.Item` (with `ToggleGroup.ItemIndicator`), alone or in a group (formerly the `toggle` capability).

The root SHALL expose the button role (natively or, when substituted by a non-button
element, through `role="button"`) and SHALL always carry `aria-pressed` set
explicitly to `"true"` or `"false"`, matching the state. `aria-pressed` SHALL be an
accessibility-critical attribute: a consumer prop overriding it SHALL produce a
development warning, and composing the root with another component's part on the same
element SHALL NOT remove or rewrite it.

#### Scenario: Item — Off is explicit

- **WHEN** a Toggle is off
- **THEN** its root has `aria-pressed="false"`, not a missing attribute

#### Scenario: Item — Composed with another trigger (radix#602, reka#1407)

- **WHEN** a Toggle root is rendered as the trigger of another component that writes
  its own `data-state` on the same element
- **THEN** `aria-pressed` still matches the Toggle's state and the driver's
  `isPressed()` reports it correctly

### Requirement: Item Stable Accessible Name

These rules apply to `ToggleGroup.Item` (with `ToggleGroup.ItemIndicator`), alone or in a group (formerly the `toggle` capability).

The accessible name SHALL NOT depend on the pressed state (APG Button pattern). In
development, when the computed name after a state change differs from the name
before it, Toggle SHALL emit a warning naming both values. Because the contract
locates the Toggle by its exact name, a model-based run SHALL fail when the name
changes with the state.

#### Scenario: Item — Label switched with the state

- **WHEN** a consumer renders "Mute" while off and "Unmute" while on and the Toggle is
  activated in development
- **THEN** a warning names "Mute" and "Unmute", and `testMachine` fails at that step
  because no element matches the anchor "Mute"

### Requirement: Item Activation

These rules apply to `ToggleGroup.Item` (with `ToggleGroup.ItemIndicator`), alone or in a group (formerly the `toggle` capability).

Toggle SHALL change state only on a `PRESS` event from the press interactions of
`add-a11y-foundations`: pointer and touch release over the root, Enter, Space (on
keyup, ignoring key repeat), and an assistive-technology `click` with no preceding
pointer or key events. Each activation SHALL toggle exactly once. Focus alone, hover,
and a press released outside the root SHALL NOT toggle. A disabled Toggle SHALL NOT
toggle by any input; with `focusableWhenDisabled` it SHALL stay in the tab order.

#### Scenario: Item — Enter and Space (ark#2946)

- **WHEN** a focused Toggle is activated with Enter, and then with Space
- **THEN** it toggles once for each key, unlike checkbox-based controls that ignore
  Enter

#### Scenario: Item — Held Space

- **WHEN** Space is held long enough to repeat and then released
- **THEN** the Toggle toggles exactly once, on release

#### Scenario: Item — Screen reader activation

- **WHEN** a screen reader activates the Toggle with a bare `click` (`detail: 0`, no
  pointer or key events)
- **THEN** it toggles exactly once with `modality: "virtual"`

#### Scenario: Item — Consumer onClick runs once (radix#1525)

- **WHEN** a consumer passes `onClick` and clicks the Toggle once
- **THEN** the consumer handler runs once and the Toggle toggles once

#### Scenario: Item — Virtual focus does not toggle

- **WHEN** focus moves to the Toggle programmatically with no key or pointer event
- **THEN** the pressed state is unchanged

#### Scenario: Item — Disabled toggle with an explanatory tooltip (base-ui#5834)

- **WHEN** a Toggle is disabled with `focusableWhenDisabled` and the user tabs to it
  and presses Space
- **THEN** it receives focus, has `aria-disabled="true"`, and does not toggle

### Requirement: Item Announcements

These rules apply to `ToggleGroup.Item` (with `ToggleGroup.ItemIndicator`), alone or in a group (formerly the `toggle` capability).

Toggle SHALL NOT announce through the Announcer or render a live region: the state
change is conveyed by `aria-pressed` on the focused element, which screen readers
speak.

#### Scenario: Item — Toggling while focused

- **WHEN** a focused Toggle is activated with Space
- **THEN** no Announcer message is recorded and `aria-pressed` changes in the same step

### Requirement: Item Data Attributes

These rules apply to `ToggleGroup.Item` (with `ToggleGroup.ItemIndicator`), alone or in a group (formerly the `toggle` capability).

The root SHALL carry `data-scope="toggle"`, `data-part="root"`,
`data-state="on|off"`, and the attributes of `button-like-element`
(`data-disabled`, `data-focus`, `data-focus-visible`, `data-hover`, and `data-pressed`,
which means a press is in progress, never the on state). The indicator SHALL carry
`data-scope="toggle"`, `data-part="indicator"`, `data-state` and `data-disabled`.
Every attribute SHALL change in the same step as the state.

#### Scenario: Item — On versus being pressed

- **WHEN** a Toggle that is on is idle, and then the pointer is held down on it
- **THEN** it has `data-state="on"` and no `data-pressed` while idle, and
  `data-pressed` only while the pointer is held

#### Scenario: Item — Substituted element stays styleable (base-ui#1084)

- **WHEN** a disabled Toggle is rendered as a `<span>` through `render`
- **THEN** it has `data-disabled`, `aria-disabled="true"`, `role="button"` and no
  `disabled` attribute

### Requirement: Item Contract

These rules apply to `ToggleGroup.Item` (with `ToggleGroup.ItemIndicator`), alone or in a group (formerly the `toggle` capability).

Toggle SHALL ship a contract with scope `toggle`, anatomy `root` and `indicator`,
located by role `button` and exact accessible name. Actions: `setPressed(pressed)`,
with pointer (click), touch (tap) and keyboard (Space) implementations that activate
only when the current state differs, completing when `isPressed()` equals `pressed`;
and `activateWithEnter(pressed)`, keyboard only, with the same postcondition using
Enter. Queries: `isPressed()` (from `aria-pressed`, never `data-state`) and
`isDisabled()` (native `disabled` or `aria-disabled="true"`). States: `off` observes
`isPressed: false`, `on` observes `isPressed: true`. The machine's `PRESS` event SHALL
map to `setPressed` with the opposite of the oracle's value. A generated driver
`getToggle(target, { name })` SHALL be exported from `@rind-ui/testing`.

#### Scenario: Item — Same test in both environments

- **WHEN** a test calls `getToggle(screen, { name: "Bold" }).setPressed(true)` and
  then the same with a Playwright `page`
- **THEN** both resolve once `aria-pressed="true"` and `isPressed()` returns `true`

#### Scenario: Item — Model-based run

- **WHEN** `testMachine(toggleContract, …)` runs on a Toggle
- **THEN** both edges (`off → on`, `on → off`) run in the pointer, touch, keyboard and
  virtual modalities, with every generic invariant checked after each step

### Requirement: Item Theme

These rules apply to `ToggleGroup.Item` (with `ToggleGroup.ItemIndicator`), alone or in a group (formerly the `toggle` capability).

`@rind-ui/theme` SHALL style Toggle through its data attributes only, with a pressed
cue that is not colour alone (border or inner outline) and that maps to system colours
under `forced-colors: active`, a target of at least 24×24 CSS px, and the shared focus
ring on `data-focus-visible`.

#### Scenario: Item — High contrast (RA#4052, RA#4054)

- **WHEN** an on and an off Toggle are rendered with forced colors emulated
- **THEN** the two states are visibly distinguishable and the focus ring is visible

