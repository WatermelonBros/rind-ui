## Purpose

Defines rind-ui's Toolbar: a named container of controls that is one tab stop, with
arrow-key navigation between its controls, explicit rules for which keys belong to the
toolbar and which to the controls inside it, and the contract its driver and
model-based tests are generated from. Roving focus, repair and the single tab stop are
those of the collection capabilities and are not restated.

## ADDED Requirements

### Requirement: Anatomy

The Toolbar SHALL consist of: `root` (`div`), `button` (`button`), `link` (`a`), `item`
(no default element: any focusable control supplied through element substitution, such
as a Menu, Select, Popover or Tooltip trigger, a checkbox or a text input), `group`
(`div`) and `separator` (`div`). Only `root` and at least one control SHALL be
required. `button`, `link` and `item` are the toolbar's **controls**; items of a hosted
composite (see `composite-host`) are controls too. Every part SHALL accept the props of
the element it renders and SHALL support element substitution without a change in
behaviour; substituting a control with another component's part (for example
`<Toolbar.Item render={<Menu.Trigger />} />`) SHALL give the element both components'
behaviour, with keys divided as in Key Ownership, and SHALL activate once per press.

#### Scenario: Menu trigger as a toolbar control

- **WHEN** a toolbar contains Bold, Italic and a Menu trigger rendered through
  `Toolbar.Item`
- **THEN** the trigger is one of the three roving controls and opens its menu on Enter

#### Scenario: Nested substitution activates once

- **WHEN** a toggle rendered through a toolbar control is clicked
- **THEN** its `onClick` and its change callback run once each (regression:
  radix-ui/primitives#1525)

### Requirement: Roles And Naming

The root SHALL have role `toolbar`, `aria-orientation="vertical"` only when vertical,
and its name from `aria-labelledby` or `aria-label` given by the consumer; a development
warning SHALL name an unnamed toolbar. Controls SHALL keep the roles of the components
they are (button, link, toggle button, menu button, radio, combobox, textbox…); the
toolbar SHALL add no role to them. A `group` SHALL have role `group`, named by its
`aria-label` / `aria-labelledby`. A `separator` SHALL follow the separator capability
with context `toolbar`.

#### Scenario: No invented roles

- **WHEN** a toolbar with buttons, a toggle group and a link is checked with axe
- **THEN** there are no violations and no element carries a role that is not an ARIA
  role (regression: radix-ui/primitives#949)

#### Scenario: Vertical toolbar

- **WHEN** a toolbar is rendered with `orientation="vertical"`
- **THEN** its root has `aria-orientation="vertical"`

### Requirement: One Tab Stop With Focus Memory

The toolbar SHALL be exactly one Tab stop, as specified by the collections' "Exactly One
Tab Stop": on first entry, the first navigable control. Before controls register (server
render, first paint), the first control rendered SHALL have `tabIndex=0` and the root
SHALL never be the tab stop while a control is navigable. After focus has left the
toolbar, the next entry SHALL land on the control that was focused last, as long as it
still exists and is navigable; otherwise repair applies. Re-entry SHALL focus one
element once and dispatch one `focus` event. The toolbar SHALL NOT intercept Tab or
Shift+Tab: the browser moves focus out from the focused control.

#### Scenario: Return to the last control

- **WHEN** the user tabs into a toolbar, arrows to "Italic", tabs out and Shift+Tabs back
- **THEN** focus is on "Italic"

#### Scenario: One focus event on re-entry

- **WHEN** a consumer counts `focus` events on toolbar controls while tabbing back into
  the toolbar
- **THEN** exactly one control received one `focus` event (regression:
  adobe/react-spectrum#5457)

#### Scenario: Tabbing out does not touch the last control

- **WHEN** focus is on the first of four controls that have tooltips and the user presses
  Tab
- **THEN** focus leaves the toolbar directly and no other control is focused on the way
  (regression: adobe/react-spectrum#10496)

### Requirement: Keyboard Navigation

In a horizontal toolbar ArrowRight and ArrowLeft SHALL move focus to the next and
previous navigable control (mirrored under `dir="rtl"`); in a vertical toolbar ArrowDown
and ArrowUp SHALL. Home and End SHALL move to the first and last navigable control.
With `loop` (default `true`) the ends SHALL wrap; without it they SHALL stop. Moving
SHALL never activate, press, check or open anything. Separators and group containers
SHALL be skipped. The toolbar SHALL have no typeahead.

#### Scenario: Wrapping

- **WHEN** focus is on the last control of a horizontal toolbar and the user presses
  ArrowRight
- **THEN** focus is on the first control

#### Scenario: Right-to-left

- **WHEN** ArrowLeft is pressed in a horizontal toolbar under `dir="rtl"`
- **THEN** focus moves to the next control (regression: ariakit#6299)

#### Scenario: Arrows do not press

- **WHEN** focus moves with arrows over a toggle button and a radio
- **THEN** neither the toggle's pressed state nor the radio's checked state changes

### Requirement: Key Ownership

The toolbar SHALL act on a keydown only when all of these hold: its target is one of the
toolbar's controls (not an element inside a popup, a portal or other content nested in
a control); it has no Alt, Control or Meta modifier; it is not part of an IME
composition; and the control has not called `preventDefault()` on it. It SHALL act only
on the arrow keys of its own axis and on Home and End. The perpendicular arrow keys,
Enter, Space, Escape, printable characters and every other key SHALL belong to the
control. When the target is a text field (a text-type `input`, a `textarea` or a
contenteditable element), the toolbar SHALL move only when Shift is not held, no text is
selected and the caret is at the start (for the previous-direction arrow) or the end
(for the next-direction arrow) of the value; Home and End SHALL belong to the text
field. Text fields SHALL be recognised by tag name and type, so fields created in
another document (same-origin iframes) are recognised too.

#### Scenario: Caret moves inside a text field

- **WHEN** a text input in the middle of a toolbar holds "hello" with the caret after
  "he" and the user presses ArrowLeft, then ArrowRight four times, then ArrowRight
- **THEN** the caret moves within the text for the first five presses and the last
  press moves focus to the next control (regression: adobe/react-spectrum#7937)

#### Scenario: Home in a text field

- **WHEN** the user presses Home in a toolbar text input
- **THEN** the caret moves to the start of the value and focus stays in the input

#### Scenario: Text field in an iframe

- **WHEN** a toolbar is rendered into a same-origin iframe by code running in the parent
  window and the user presses ArrowLeft inside its text input with the caret mid-text
- **THEN** the caret moves and focus stays in the input (regression: ariakit#6316)

#### Scenario: Keys from a popup

- **WHEN** a menu opened from a toolbar control is portalled and the user presses
  ArrowRight on one of its items
- **THEN** the toolbar does not move focus (regression: mui/base-ui#1759,
  radix-ui/primitives#3232)

#### Scenario: Modified arrow

- **WHEN** the user presses Alt+ArrowRight on a toolbar button
- **THEN** focus does not move and the interaction modality is unchanged (regression:
  ariakit#7099)

#### Scenario: Select in a horizontal toolbar

- **WHEN** focus is on a Select trigger in a horizontal toolbar and the user presses
  ArrowRight, then returns and presses ArrowDown
- **THEN** ArrowRight moves to the next control and ArrowDown opens the Select
  (regression: adobe/react-spectrum#8636)

#### Scenario: Select in a vertical toolbar

- **WHEN** focus is on a Select trigger in a vertical toolbar and the user presses
  ArrowDown, then returns and presses Enter
- **THEN** ArrowDown moves to the next control and Enter opens the Select (regression:
  mui/base-ui#4487)

### Requirement: Controls With Popups

A control that opens a menu, listbox, popover, dialog or tooltip SHALL keep its own
opening keys and pointer behaviour. When that popup closes and restores focus to the
control, the control SHALL be the toolbar's tab stop, and Tab and Shift+Tab SHALL leave
the toolbar from it in both directions.

#### Scenario: Popover from a toolbar control

- **WHEN** the user arrows to a popover trigger in a toolbar, opens the popover, closes
  it with its close button and presses Shift+Tab
- **THEN** focus moves to the element before the toolbar (regression: mui/base-ui#4123)

#### Scenario: Menu closes back into the toolbar

- **WHEN** a menu opened from the third control closes with Escape and the user presses
  ArrowLeft
- **THEN** focus is on the second control

### Requirement: Disabled Controls

A disabled control SHALL, by default, stay focusable and reachable by arrow keys with
`aria-disabled="true"`, SHALL not activate, and SHALL keep pointer hover so a tooltip on
it still opens. A disabled text-field control SHALL also be read-only, so no input —
typing, paste or IME composition — changes its value. With `focusableWhenDisabled={false}`
on the control (or the toolbar), a disabled control SHALL use the native `disabled`
attribute where the element has one and SHALL be skipped by arrow keys. `disabled` on
the root or on a `group` SHALL disable every control inside it. Disabling, enabling or
removing the focused or tab-stop control SHALL keep exactly one tab stop and SHALL keep
focus inside the toolbar.

#### Scenario: Disabled first control

- **WHEN** the first control becomes disabled with `focusableWhenDisabled={false}` after
  render and the user tabs to the toolbar
- **THEN** focus lands on the first enabled control (regression: ariakit#3232)

#### Scenario: Disabling the focused control

- **WHEN** the focused control becomes disabled while it has focus
- **THEN** focus stays on it, it gets `aria-disabled="true"`, and ArrowRight still moves
  to the next control (regression: ariakit#7359)

#### Scenario: Natively disabled when not focusable

- **WHEN** a toolbar button is disabled with `focusableWhenDisabled={false}`
- **THEN** it has the `disabled` attribute and arrows skip it (regression:
  mui/base-ui#2175)

#### Scenario: Tooltip on a disabled control

- **WHEN** the pointer rests on a disabled, focusable toolbar button that is a tooltip
  trigger
- **THEN** the tooltip opens (regression: mui/base-ui#4966)

#### Scenario: IME into a disabled field

- **WHEN** a disabled toolbar text input has focus and the user commits Japanese text
  through an IME
- **THEN** the input's value is unchanged (regression: mui/base-ui#5366)

### Requirement: Buttons And Links

A `button` control SHALL be a button-like element (Enter and Space activate, activation
bound to click). A `link` control SHALL navigate on Enter through the browser's native
activation, and on Space SHALL dispatch one `click` and call `preventDefault()` so the
page does not scroll. A link inside a hosted composite item SHALL keep both behaviours.
The `Link` part SHALL be built with add-link's `linkProps` (`link-navigation`), so
modifier and middle clicks, client routing through the environment router and the
disabled-link rules are the same as on a Link; the toolbar adds only the Space handling
and the roving props.

#### Scenario: Space on a link

- **WHEN** focus is on a toolbar link and the user presses Space
- **THEN** the link navigates once and the page does not scroll

#### Scenario: Enter on a link in a group

- **WHEN** a link inside a toolbar group has focus and the user presses Enter
- **THEN** the link navigates (regression: huntabyte/bits-ui#642)

#### Scenario: Toolbar link uses the environment router

- **WHEN** a router is provided and a toolbar `Link` with `href="/docs"` is clicked, then
  ⌘-clicked
- **THEN** the click calls the router's `navigate("/docs")` once without a page load, and
  the ⌘-click is left to the browser (new tab) with no client navigation

### Requirement: Pointer Interaction

A pointer press on a control SHALL focus it (where the control takes focus on press)
and make it the tab stop. Pointer hover SHALL never move focus or the toolbar's
highlight. A control may declare that it does not take focus on press (press-interactions
"Press Without Focus"); pressing it SHALL activate it while focus and the tab stop stay
where they were.

#### Scenario: Editor toolbar

- **WHEN** a rich-text editor has focus and the user clicks a toolbar "Bold" button
  declared as not taking focus
- **THEN** bold is applied and the editor keeps focus (regression:
  radix-ui/primitives#2507)

#### Scenario: Hover

- **WHEN** the pointer moves across the toolbar's controls
- **THEN** no control gains focus or `data-highlighted` (regression: mui/base-ui#3094)

### Requirement: Programmatic Focus

The toolbar SHALL expose `focus()`, which moves focus to its current tab stop with the
`programmatic` source, so an application can bind a documented shortcut to reach the
toolbar. The toolbar SHALL bind no global key itself.

#### Scenario: Shortcut from the editor

- **WHEN** an application calls the toolbar's `focus()` from an Alt+F10 handler in its
  editor
- **THEN** focus is on the toolbar's tab-stop control and the focus ring is visible
  (regression: mui/base-ui#1454)

### Requirement: Announcements

The toolbar SHALL make no announcements of its own; controls announce through their own
roles and states as the screen reader moves.

#### Scenario: Navigating

- **WHEN** the user arrows through a toolbar with a recording announcer
- **THEN** the announcement log is empty

### Requirement: Performance

Moving focus between controls SHALL re-render at most the two controls whose tab-stop
state changed, and SHALL NOT re-render other controls or start work in closed tooltips.

#### Scenario: Holding an arrow key

- **WHEN** the user holds ArrowRight over a toolbar of 30 buttons that are tooltip
  triggers
- **THEN** each move re-renders two controls and no closed tooltip mounts or subscribes
  (regression: ariakit#497, ariakit#4428)

### Requirement: Data Attributes

Every part SHALL carry `data-scope="toolbar"`, `data-part` and `data-instance`.
Additionally:

- `root`: `data-orientation`, `data-disabled` when disabled.
- `button`, `link`, `item` and hosted items: `data-key`, `data-orientation`,
  `data-disabled`, `data-focus-visible`, and `data-highlighted` on the tab-stop control
  only while focus is inside the toolbar.
- `group`: `data-orientation`, `data-disabled`.
- `separator`: the separator capability's attributes, with `data-part="separator"`.

All parts SHALL forward `data-variant`, `data-size` and `data-tone` unchanged.

#### Scenario: Highlight only while inside

- **WHEN** focus leaves the toolbar after the user arrowed to "Italic"
- **THEN** no control has `data-highlighted`, and "Italic" still has `tabIndex=0`

### Requirement: Toolbar Contract

The `toolbar` contract SHALL locate an instance by role `toolbar` and exact accessible
name and include the collection contract fragment's queries. It SHALL declare the
actions `tabIn()` (keyboard: Tab from the element before), `moveTo(name)` (keyboard:
axis arrows, bounded to one cycle; no pointer implementation, with the stated reason that
pointer focus is a press), `press(name)` (pointer: click; touch: tap; keyboard: `moveTo`
then Enter, or Space for links), `tabOut()` and `focus()`, each with a postcondition,
and the queries `items()`, `focusedItem()`, `tabStop()` (the control with
`tabIndex=0`), `isDisabled(name)` and `orientation()`. Controls — the toolbar's own and
the items of hosted composites — SHALL carry `data-host="toolbar"`, so the contract lists
them in document order. It SHALL declare the trait `directional` and a
`toolbar-one-tab-stop` invariant over every control (own and hosted; the generic
`composite-roving` invariant sees only one part name). Focus SHALL change only the focus
state and the focused-control query, never activate; the contract declares the control
parts as committing on focus for that reason. Programmatic `FOCUS_TOOLBAR` is a framework
API (`actionsRef.focus()`) a driver cannot call, so it SHALL be skipped by the model
with that reason and covered by DOM tests; `COLLECTION.CHANGE` SHALL be skipped likewise
(static parts).

#### Scenario: Driver round trip

- **WHEN** a test runs `const t = getToolbar(screen, { name: "Formatting" })`, then
  `await t.tabIn()`, `await t.moveTo("Italic")`, `await t.press("Italic")`
- **THEN** each action resolves after its postcondition and "Italic" is pressed

#### Scenario: Hosted component drivers

- **WHEN** a test gets `getRadioGroup(screen, { name: "Alignment" })` for a radio group
  inside the toolbar and calls `check("Center")`
- **THEN** the radio driver works unchanged and Center is checked

### Requirement: Model-Based Coverage

`testMachine` over the toolbar contract SHALL cover every transition in every declared
modality including `virtual`, in both directions, with argument classes horizontal,
vertical, `loop: false`, first control disabled, all controls disabled, a text field as
first, middle and last control, a hosted Radio Group, a hosted Toggle Group and a Menu
trigger, and SHALL pass every generic, accessibility and collection invariant.

#### Scenario: Wrapper adds a second tab stop

- **WHEN** a consumer wrapper renders a toolbar control with `tabIndex={0}` forced on
  every control and runs `testMachine`
- **THEN** the first step fails the one-tab-stop invariant, naming the controls
