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

