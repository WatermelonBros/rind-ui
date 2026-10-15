# tabs Specification

## Purpose
Defines the Tabs component (APG Tabs pattern): a tab list whose tabs select one panel,
with keyboard-only automatic activation, a single tab stop that is never lost, panels that
are hidden for assistive technology and optionally findable, and a contract that lets
drivers select and read tabs in any test environment.
## Requirements
### Requirement: Anatomy

Tabs SHALL consist of a `root` part, one `list` part, one `tab` part per tab, one
`panel` part per tab and an optional `indicator` part rendered inside the list. Each tab
and its panel SHALL be paired by the same `value` key, never by position. Tab parts SHALL
register as static collection items (`add-collections`), so their order is the document
order at each commit. Each tab SHALL be a button-like element (`add-button`
`button-like-element`): a `<button type="button">` by default, substitutable through
`render` without changing behaviour. Every part SHALL accept the `render` prop.

#### Scenario: Tab inserted before the selected one (headlessui#1834)

- **WHEN** a new tab and panel with value `"new"` are rendered before the selected tab
  `"b"`
- **THEN** `"b"` stays selected, its panel stays visible, and the new tab is first in
  keyboard order

#### Scenario: Reordered tabs (headlessui#2131)

- **WHEN** the tabs are reordered while `"b"` is selected
- **THEN** `"b"` and its panel stay selected and visible

#### Scenario: Nested tabs stay separate (bits-ui#2189)

- **WHEN** a panel contains another Tabs instance and the user presses End in the outer
  list
- **THEN** focus moves to the last tab of the outer list, never to a tab of the inner list

### Requirement: Value And Default Selection

Tabs SHALL have a controllable value `value: string | null` (`value`, `defaultValue`,
`onValueChange(value, details)`). When uncontrolled and no `defaultValue` is given, the
first enabled tab SHALL become selected once the tabs have registered, and
`onValueChange` SHALL be called once with `details.reason === "INITIAL"` (base-ui#2097
asked for the callback; the dedicated reason lets consumers ignore it). A
controlled `null` SHALL be honoured: no tab is selected, no panel is visible, and the
value is not overwritten. When the selected tab leaves the collection and Tabs is
uncontrolled, the tab chosen by the collection's repair rule (next surviving enabled tab
in the previous order, else the previous one) SHALL become selected, reported once with
`reason: "COLLECTION.CHANGE"`. A disabled tab SHALL never be selected by default.

#### Scenario: First enabled tab by default (base-ui#2098, base-ui#2097)

- **WHEN** uncontrolled Tabs render with no `defaultValue` and the first tab disabled
- **THEN** the second tab is selected and `onValueChange` was called once with its value
  and `reason: "INITIAL"`

#### Scenario: Controlled null is respected (react-spectrum#5700, react-spectrum#9584)

- **WHEN** controlled Tabs render with `value={null}`
- **THEN** no tab has `aria-selected="true"`, no panel is visible, `onValueChange` is not
  called, and nothing re-renders in a loop

#### Scenario: Selected tab removed (headlessui#1092)

- **WHEN** uncontrolled Tabs have `"c"` selected among `"a"`, `"b"`, `"c"`, `"d"` and tab
  `"c"` is removed
- **THEN** `"d"` is selected and its panel is visible

### Requirement: Activation

Tabs SHALL support `activationMode: "automatic" | "manual"`, default `automatic`. In
automatic mode a tab SHALL be selected as a consequence of a keyboard navigation move in
the list (logical `NEXT`, `PREV`, `FIRST`, `LAST` with `modality: "keyboard"`), using the
keyboard-modality guard of `add-a11y-foundations`. In both modes a tab SHALL be selected
by a `PRESS` on it — pointer or touch release over the tab, Enter, Space, or an
assistive-technology `click` with no preceding pointer or key events — exactly once per
activation. A `focus` event alone SHALL NOT select a tab, whatever its modality. A press
released outside the tab, a secondary mouse button and a disabled tab SHALL NOT select.

#### Scenario: Screen-reader cursor does not select (radix#1047, ariakit#421)

- **WHEN** a VoiceOver or ChromeVox virtual cursor moves onto an unselected tab and the
  browser fires `focus` with no key or pointer event
- **THEN** the selected tab and the visible panel do not change

#### Scenario: Arrow selects in automatic mode

- **WHEN** focus is on the selected tab `"a"` and the user presses ArrowRight
- **THEN** tab `"b"` is focused and selected in the same step, and its panel is visible

#### Scenario: Manual mode

- **WHEN** `activationMode` is `manual` and the user presses ArrowRight, then Enter
- **THEN** after ArrowRight tab `"b"` is focused but `"a"` stays selected; after Enter
  `"b"` is selected

#### Scenario: Activation on release (radix#1879, headlessui#845, base-ui#1323)

- **WHEN** the user presses the mouse button on an unselected tab, moves off it and
  releases outside
- **THEN** the selection does not change

#### Scenario: Blur in the old panel runs first (radix#3600, react-spectrum#8558)

- **WHEN** an input inside the visible panel has focus and the user clicks another tab
- **THEN** the input's `blur` fires before its panel is hidden or unmounted

#### Scenario: Right click (radix#1113, bits-ui#780, base-ui#1317)

- **WHEN** the user right-clicks an unselected tab
- **THEN** the selection does not change

#### Scenario: Screen-reader activation

- **WHEN** a screen reader activates an unselected tab with a bare `click` (`detail: 0`,
  no pointer or key events)
- **THEN** that tab is selected exactly once with `modality: "virtual"`

### Requirement: Keyboard Navigation

Navigation SHALL follow `add-collections` with logical keys from `add-a11y-foundations`.
With `orientation: "horizontal"` (default) ArrowRight and ArrowLeft SHALL move to the next
and previous tab and ArrowUp/ArrowDown SHALL do nothing; with `orientation: "vertical"`
ArrowDown and ArrowRight SHALL move to the next tab and ArrowUp and ArrowLeft to the
previous one. Home and End SHALL move to the first and last enabled tab. Horizontal arrows
SHALL be mirrored under `dir="rtl"`. Moves SHALL wrap when `loop` is true (default). Arrow
keys combined with Alt, Control, Meta or Shift, keys whose target is not the tab itself,
and key events marked `composing` SHALL NOT navigate or select. Every move SHALL update
focus and selection synchronously in the same step as the key. Tabs SHALL NOT use
typeahead.

#### Scenario: RTL (radix#468, headlessui#3020, ariakit#7482)

- **WHEN** ArrowLeft is pressed on the first tab of a horizontal list under `dir="rtl"`
- **THEN** the second tab is focused (and selected in automatic mode)

#### Scenario: Vertical list accepts both arrow pairs (react-spectrum#4140)

- **WHEN** ArrowRight is pressed on a tab of a vertical list
- **THEN** the next tab is focused, as with ArrowDown

#### Scenario: Horizontal list leaves Up and Down alone (react-spectrum#5996)

- **WHEN** ArrowDown is pressed on a tab of a horizontal list
- **THEN** focus and selection do not change and the key's default action is not
  prevented

#### Scenario: Browser shortcut (base-ui#1465)

- **WHEN** Alt+ArrowLeft is pressed on a tab
- **THEN** focus and selection do not change

#### Scenario: Space typed in an input inside a tab (radix#2915)

- **WHEN** a tab contains a text input and the user types Space in it in manual mode
- **THEN** the tab is not selected

#### Scenario: Fast key presses (radix#4136, radix#2910)

- **WHEN** ArrowRight is pressed three times faster than the browser can move focus
- **THEN** the third tab after the start is focused and selected, and no press is lost

### Requirement: Tab Stop And Focus

The list SHALL be exactly one Tab stop, following `add-collections`: the focused tab;
else the selected tab if it is navigable; else the first navigable tab; else the list
itself. A disabled selected tab SHALL NOT be the tab stop unless `focusableWhenDisabled`
is set. Before the tabs register (server render), the tab whose value equals the selected
value SHALL have `tabIndex=0`, else the first tab rendered. While focus is outside the
list, the roving tab stop SHALL follow the selected tab, including after controlled value
changes. Tab from a tab SHALL move to the next element in the page tab sequence (the
visible panel or its first tabbable element).

#### Scenario: Disabled selected tab (react-spectrum#10633)

- **WHEN** the selected tab `"a"` is disabled and the user tabs into the list
- **THEN** focus lands on the first enabled tab and the tab list is operable

#### Scenario: Nothing selected (zag#2762)

- **WHEN** controlled Tabs render with `value={null}` and the user presses Tab into the
  list
- **THEN** the first enabled tab receives focus

#### Scenario: Server render

- **WHEN** Tabs with `defaultValue="b"` are rendered on the server
- **THEN** the HTML gives tab `"b"` `tabIndex=0` and the other tabs `tabIndex=-1`

#### Scenario: Controlled change while blurred (base-ui#2100, base-ui#2101)

- **WHEN** the parent changes the controlled value from `"a"` to `"c"` while focus is
  outside the list, and the user then tabs into the list
- **THEN** focus lands on `"c"` and the selection stays `"c"`

### Requirement: Disabled Tabs

A disabled tab SHALL carry `aria-disabled="true"` and `data-disabled`, SHALL never be
selected by a user action and SHALL be skipped by every keyboard move unless
`focusableWhenDisabled` is set on the root, in which case it SHALL be reachable by arrows
but still not selectable. A `disabled` root SHALL disable every tab. Every search for the
next navigable tab SHALL stop after one pass, so a list in which every tab is disabled
never hangs.

#### Scenario: Run of disabled tabs

- **WHEN** tabs 2 and 3 of 4 are disabled and the user presses ArrowRight on tab 1
- **THEN** tab 4 is focused

#### Scenario: Focusable when disabled (base-ui#1442)

- **WHEN** `focusableWhenDisabled` is set and tab 2 is disabled
- **THEN** ArrowRight from tab 1 focuses tab 2, which stays unselected, and ArrowRight
  again focuses tab 3

#### Scenario: All tabs disabled (react-spectrum#1358)

- **WHEN** every tab is disabled and the user presses Tab, then ArrowRight and End
- **THEN** the list itself is the tab stop, nothing is selected, and nothing hangs

### Requirement: Roles And ARIA

The list SHALL have role `tablist`, `aria-orientation="vertical"` when vertical (and no
`aria-orientation` otherwise) and a name from `aria-labelledby` or `aria-label`; when it
has neither, a development warning SHALL name the list. Each tab SHALL have role `tab`,
`aria-selected` set explicitly to `"true"` or `"false"`, a name from its content, and
`aria-controls` referencing its panel only while that panel is rendered. Each rendered
panel SHALL have role `tabpanel` and `aria-labelledby` referencing its tab. The indicator
SHALL carry `aria-hidden="true"`. Ids SHALL be derived from the root id and the tab's key
(`add-a11y-foundations` element ids).

#### Scenario: Unselected tabs are explicit

- **WHEN** three tabs render with `"b"` selected
- **THEN** `"a"` and `"c"` have `aria-selected="false"` and `"b"` has
  `aria-selected="true"`

#### Scenario: No dangling aria-controls (radix#1703)

- **WHEN** inactive panels are unmounted
- **THEN** only the selected tab has `aria-controls`, and it resolves to the rendered
  panel

#### Scenario: Unnamed list

- **WHEN** a tab list renders with no `aria-label` and no `aria-labelledby` in development
- **THEN** a warning names the list part

### Requirement: Panels

The root SHALL accept `inactivePanels: "unmount" | "hidden" | "until-found"`, default
`unmount`. With `unmount` only the selected tab's panel content SHALL be mounted. With
`hidden` every panel SHALL stay mounted and inactive panels SHALL carry the `hidden`
attribute. With `until-found` inactive panels SHALL stay mounted with
`hidden="until-found"` as specified by the `hidden-content` capability. Inactive panels
SHALL never be hidden only visually. A visible panel SHALL have `tabIndex=0` while it
contains no tabbable element and no `tabIndex` otherwise, re-evaluated when its content
changes.

#### Scenario: Hidden for assistive technology (headlessui#2688)

- **WHEN** `inactivePanels` is `hidden` and tab `"a"` is selected
- **THEN** the panels of `"b"` and `"c"` have the `hidden` attribute and are not in the
  accessibility tree

#### Scenario: Panel with focusable content (reka-ui#2430, base-ui#5126)

- **WHEN** the visible panel contains a button and the user presses Tab from the selected
  tab
- **THEN** focus moves to the button and the panel itself has no `tabIndex`

#### Scenario: Text-only panel

- **WHEN** the visible panel contains only text
- **THEN** it has `tabIndex=0` so keyboard users can reach and scroll it

#### Scenario: Content changes (ariakit#6332)

- **WHEN** the visible panel's content changes from text only to a form with inputs
- **THEN** the panel's `tabIndex` is removed

### Requirement: Find-In-Page

With `inactivePanels: "until-found"`, a `beforematch` event on an inactive panel SHALL
select its tab with `details.reason === "find-in-page"` through `onValueChange`, and the
panel SHALL carry `data-reveal="find-in-page"` until the next transition. If a controlled
consumer does not apply the value, the panel SHALL return to `hidden="until-found"` in
the next frame. Where `until-found` is unsupported, inactive panels SHALL behave as
`hidden`.

#### Scenario: Searching the page reveals a tab (base-ui#3734)

- **WHEN** the user searches the page for text that is only in the panel of unselected tab
  `"c"`
- **THEN** `"c"` becomes selected with `reason: "find-in-page"`, its panel is visible and
  carries `data-reveal="find-in-page"`

#### Scenario: Controlled refusal

- **WHEN** a controlled consumer ignores the proposed `"c"`
- **THEN** the panel of `"c"` carries `hidden="until-found"` again in the next frame

### Requirement: Scrolling

A keyboard navigation move SHALL scroll the newly focused tab into view with the
nearest-edge rule and no smooth scrolling. Mounting the component, a pointer press and a
controlled value change SHALL NOT scroll the page or the list.

#### Scenario: No scroll on load (react-spectrum#4132)

- **WHEN** a page renders Tabs below the fold
- **THEN** the page does not scroll

#### Scenario: Clicking an edge tab (ariakit#4132)

- **WHEN** the user clicks a partly visible tab at the edge of a scrollable list
- **THEN** the tab is selected and the list does not scroll under the pointer before the
  click completes

### Requirement: Announcements

Tabs SHALL NOT announce through the Announcer and SHALL NOT render a live region: the
selected state is conveyed by `aria-selected` on the focused tab.

#### Scenario: Arrowing between tabs

- **WHEN** the user arrows from `"a"` to `"b"` in automatic mode
- **THEN** no Announcer message is recorded

### Requirement: Data Attributes

Every part SHALL carry `data-scope="tabs"`, `data-part` (`root`, `list`, `tab`, `panel`,
`indicator`) and `data-orientation`. The root and list SHALL carry
`data-activation-direction` (`next`, `previous` or `none`: the direction of the last
selection change in collection order). The list SHALL carry `data-focus` while a tab has
focus and `data-disabled` when the root is disabled. Each tab SHALL carry `data-key`,
`data-selected` when selected, `data-highlighted` when it is the roving focus target,
`data-disabled`, and the `button-like-element` attributes `data-focus`,
`data-focus-visible`, `data-pressed` and `data-hover`. Each panel SHALL carry `data-key`,
`data-selected` when visible and `data-reveal="find-in-page"` after a find-in-page
reveal. The indicator SHALL carry the attributes of the `selection-indicator` capability.
Every attribute SHALL change in the same step as the state.

#### Scenario: Selected and focused tab

- **WHEN** tab `"b"` is selected and focused with the keyboard
- **THEN** it has `data-key="b"`, `data-selected`, `data-highlighted`, `data-focus` and
  `data-focus-visible`

#### Scenario: Activation direction

- **WHEN** the selection moves from the third tab to the first
- **THEN** the root and list carry `data-activation-direction="previous"`

### Requirement: Contract

Tabs SHALL ship a contract with scope `tabs`, anatomy `root`, `list`, `tab`, `panel`,
`indicator`, located by role `tablist` and exact accessible name. Actions:
`select(name)` — pointer and touch: press the tab named `name`; keyboard: focus the list
and press arrow keys until that tab is focused, then Enter when `activationMode` is
`manual`; completes when `selected()` equals `name` — and `focusTab(name)` — keyboard
only: arrow keys until the tab is focused; completes when `focusedTab()` equals `name`.
Queries: `tabs()` (accessible names in order), `selected()` (name of the tab with
`aria-selected="true"`, or null), `focusedTab()`, `panel()` (accessible name and text of
the visible panel, or null) and `isDisabled(name)`. Traits: `composite-roving`,
`selectable` and `directional`. Focus SHALL change only the focus state and the
focused-tab query, never the value; the contract declares the tab as committing on focus
for that reason (and the panel and the list, which are stops outside the tabs), and the
value is checked by the `selectable` invariant after every step. A generated driver
`getTabs(target, { name })` SHALL be exported from `@rind-ui/testing`.

#### Scenario: Same test in both environments

- **WHEN** a test calls `getTabs(screen, { name: "Settings" }).select("Billing")` and then
  the same with a Playwright `page`
- **THEN** both resolve once the "Billing" tab is selected and `panel()` returns the
  Billing panel

#### Scenario: Model-based run

- **WHEN** `testMachine(tabsContract, …)` runs with argument classes for no default value,
  first tab disabled, selected tab disabled, all disabled, vertical, manual activation and
  both directions
- **THEN** every transition runs in the pointer, touch, keyboard and virtual modalities
  with every generic and trait invariant checked after each step

### Requirement: Theme

`@rind-ui/theme` SHALL style Tabs through data attributes only: a selected-tab cue that
is not colour alone and maps to system colours under `forced-colors: active`, tab targets
of at least 24×24 CSS px, the shared focus ring on `data-focus-visible`, an indicator
transition that is zero under `prefers-reduced-motion: reduce` and disabled while the
indicator carries `data-resizing`, and no `[hidden]` override that would defeat
`hidden="until-found"`.

#### Scenario: High contrast

- **WHEN** Tabs render with forced colors emulated
- **THEN** the selected tab is distinguishable from the others without the indicator

#### Scenario: Reduced motion

- **WHEN** the selection changes with reduced motion emulated
- **THEN** the indicator moves without a transition

