## ADDED Requirements

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

