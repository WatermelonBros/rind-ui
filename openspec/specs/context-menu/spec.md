# context-menu Specification

## Purpose
Defines rind-ui's Context Menu: a Menu opened from a region by a secondary action (right
click, Control+click, long press, Shift+F10 / ContextMenu key) and anchored at a point —
how it opens on every platform and input, where it is placed, how it behaves while open
and on close, and what the region exposes. Everything inside the open menu is the
`menu` capability.
## Requirements
### Requirement: Anatomy And Reuse

The Context Menu SHALL consist of `root` (no element) and `trigger` (the region, `div`),
plus the Menu parts `positioner`, `content`, `arrow`, items, groups, separators and
submenus used inside the root. Inside the open menu every behaviour of the `menu`
capability SHALL apply unchanged (navigation, typeahead, activation, checkbox and radio
items, links, submenus, Escape, Tab, window blur, focus restore). Every part SHALL carry
`data-scope="menu"` (one instance, one scope for the driver and the theme); the region
SHALL carry `data-part="trigger"` and `data-context-menu`.

#### Scenario: Reado file tree

- **WHEN** Reado's file-tree context menu (items with icons, a destructive item, a
  separator, a disabled item, a "keep open" item) is rewritten with these parts
- **THEN** it opens at the pointer, selects, keeps open on the "keep open" item through
  `details.cancel()`, and dismisses as before

### Requirement: Opening By Pointer

A `contextmenu` event on the region or any descendant SHALL open the menu at the event's
point and prevent the browser's own menu, unless the event was already
`defaultPrevented` by a descendant or the root is `disabled`, in which case the browser's
menu SHALL show. On macOS a Control+click SHALL open it (through the browser's
`contextmenu`) and SHALL NOT also count as a press. The release or trailing `click` of the
opening gesture SHALL NOT activate an item or close the menu.

#### Scenario: Right click

- **WHEN** the user right-clicks the region at (600, 400)
- **THEN** the menu opens with its top-left corner at the pointer, the content is focused
  and no item is highlighted

#### Scenario: Child opts out

- **WHEN** a link inside the region calls `preventDefault()` on its own `contextmenu`
- **THEN** the context menu does not open (regression: bits-ui#1641)

#### Scenario: Disabled

- **WHEN** the root is disabled and the user right-clicks the region
- **THEN** the browser's menu shows

#### Scenario: First click after opening

- **WHEN** the menu is opened by right click and the user clicks a checkbox item once
- **THEN** the item toggles once (regression: mui/base-ui#2828)

### Requirement: Opening By Long Press

A touch or pen press held on the region for `longPressDelay` (default 500 ms) SHALL open
the menu at the press's starting point, with text selection and the platform callout
suppressed during the press. The press SHALL be cancelled by moving more than 10 px, by
a second pointer, by `pointercancel` or by release before the delay. Where the platform
also fires `contextmenu` during the same gesture, the menu SHALL open once. Long press
SHALL be configurable off per root (`longPress={false}`). The trailing `click` of the
long press SHALL NOT activate the item that appears under the finger.

#### Scenario: iPhone

- **WHEN** the user keeps a finger on the region for 500 ms on iOS (which fires no
  `contextmenu`)
- **THEN** the menu opens at the finger, the region's text is not selected and the iOS
  callout does not appear (regression: radix#701, radix#931, kobalte#271)

#### Scenario: Android

- **WHEN** a long press on Android fires `contextmenu` at 520 ms during the emulated
  press
- **THEN** the menu opens exactly once

#### Scenario: Jitter

- **WHEN** the finger moves 4 px during the long press
- **THEN** the menu still opens

#### Scenario: Stylus

- **WHEN** a pen is held on the region for 500 ms
- **THEN** the menu opens (regression: mui/base-ui#4854, radix#747)

#### Scenario: Opt out

- **WHEN** `longPress={false}` and the user holds a finger on the region
- **THEN** nothing opens (regression: radix#748)

### Requirement: Opening By Keyboard And Assistive Technology

The logical `CONTEXT_MENU` key (Shift+F10, the ContextMenu key) pressed on a focused
element inside the region SHALL open the menu anchored to that element's rectangle with
its first navigable item focused, and SHALL prevent the browser's own menu that follows.
A `contextmenu` event not preceded by a pointer press (VoiceOver VO+Shift+M, the
browser's keyboard-dispatched event) SHALL open the menu with its first navigable item
focused. The keyboard twin SHALL exist for every pointer and touch opening in the
contract.

#### Scenario: Shift+F10 on a file-tree row

- **WHEN** a file-tree row inside the region is focused and the user presses Shift+F10
- **THEN** the menu opens next to the row with its first item focused, and no browser
  menu appears

#### Scenario: VoiceOver

- **WHEN** VoiceOver sends "open shortcut menu" on a focused row
- **THEN** the menu opens with its first item focused

### Requirement: Innermost Region

When regions are nested, only the innermost region containing the gesture's target SHALL
open its menu, for `contextmenu`, long press and the keyboard alike. A dropdown menu
rendered inside a region SHALL be an independent root, not a submenu of the context menu.

#### Scenario: Pane menu around a row menu

- **WHEN** a row with its own context menu sits inside a pane region and the user long
  presses the row on touch
- **THEN** only the row's menu opens (regression: radix#4165, reka-ui#1844)

#### Scenario: Dropdown inside a region

- **WHEN** a region contains a toolbar menu button and the user opens that menu and moves
  the pointer off its trigger
- **THEN** the toolbar menu stays open (regression: ark#3285, mui/base-ui#2505)

### Requirement: Point Anchor

The menu SHALL be positioned with the `pointer` preset at a point anchor (keyboard: the
focused element's rectangle), with `fixed` positioning and no tracking, so it lands under
the pointer regardless of transformed ancestors of the region. The transform origin SHALL
be the menu corner at the pointer.

#### Scenario: Near the bottom-right corner

- **WHEN** the user right-clicks 10 px from the bottom-right corner of the viewport
- **THEN** the menu opens up and to the left of the pointer, fully inside the viewport,
  with `--rind-transform-origin` at its bottom-right corner (regression: radix#3066)

#### Scenario: Inside a scaled layer

- **WHEN** the region is inside an ancestor with `transform: scale(1.25)` (Reado's zoom
  layer) and the user right-clicks it
- **THEN** the menu's corner is at the pointer

### Requirement: While Open

While the menu is open, a `contextmenu` whose point lies inside the same region (decided
by the region's rectangles, since the region is inert while a modal menu is open) SHALL
re-anchor the open menu to the new point without closing it or restarting its entry
animation, SHALL reset the highlight and focus the content, and SHALL report the new
target in an `onOpenChange`-free `onAnchorChange(details)` callback. A `contextmenu`
anywhere else SHALL close the menu with reason `outside-press` and let the browser
handle the event. At most one context menu SHALL be open per document; opening one closes
another. Secondary-button presses inside the open menu SHALL neither close it nor
activate items. With `modal={false}`, scrolling the page SHALL close the menu.

#### Scenario: Second right click in the same region

- **WHEN** the menu is open and the user right-clicks another row of the same table
  region
- **THEN** the menu moves to the new point and `onAnchorChange` reports the new row
  (regression: radix#1287, radix#2611, radix#2572)

#### Scenario: Fast right clicks across regions

- **WHEN** the user right-clicks three different regions in quick succession
- **THEN** exactly one context menu is open afterwards (regression: bits-ui#1743,
  bits-ui#563, reka-ui#701)

#### Scenario: Right click on an item

- **WHEN** the user right-clicks an item of the open menu on Windows
- **THEN** the menu stays open and nothing is selected (regression: mui/base-ui#3595)

#### Scenario: Release elsewhere

- **WHEN** the user presses the right button on the region, moves 50 px and releases
- **THEN** the menu is open (regression: mui/base-ui#3317)

#### Scenario: Non-modal and scroll

- **WHEN** a `modal={false}` context menu is open and the page scrolls
- **THEN** the menu closes (regression: radix#2795)

### Requirement: Open Details And Programmatic Opening

`onOpenChange(open, details)` SHALL carry, on open, the `point`, the `target` element
the gesture started on and the originating `nativeEvent`, with reasons (kebab case like
every layer) `context-menu` (pointer or AT), `context-menu-key`, `long-press` or `api`
(`openAt`, a programmatic open). A non-modal context menu closed by a page scroll SHALL
report the reason `scroll`. The root SHALL offer
`openAt(point, target?)` for programmatic opening; a controlled `open={true}` without a
point SHALL anchor at the region's top-left corner and log a development warning.

#### Scenario: Which row was clicked

- **WHEN** the user right-clicks the "README.md" row
- **THEN** `details.target` is that row's element and `details.point` the pointer
  position (regression: radix#766, kobalte#646, bits-ui#771)

#### Scenario: Document-wide edit menu

- **WHEN** Reado's `EditMenu` calls `openAt({ x, y }, field)` from a document
  `contextmenu` listener
- **THEN** the menu opens at the point and `details.target` is the field

### Requirement: Region Semantics

The region SHALL have no role, no `aria-haspopup`, no `aria-expanded` and no
`aria-controls`, SHALL keep any `tabindex` the consumer gives it, and SHALL NOT be made
focusable by the component. When the region is focusable and long press is enabled, it
SHALL reference the long-press hint (`messages.longPressHint`) through
`aria-describedby`. A press on the region SHALL be an ordinary page press for other
layers.

#### Scenario: Consumer tabindex

- **WHEN** the consumer renders the region with `tabIndex={0}`
- **THEN** it keeps `tabindex="0"` (regression: bits-ui#1885)

#### Scenario: Region inside a popover

- **WHEN** a region sits inside an open popover and the user left-clicks it
- **THEN** the popover stays open (regression: bits-ui#1948)

### Requirement: Accessible Name

The content SHALL be named by the consumer's `aria-label` or `aria-labelledby` on the
content; when it has neither after opening, one development warning SHALL be logged and
nothing thrown.

#### Scenario: Unnamed

- **WHEN** a context menu opens without a name
- **THEN** one warning names the instance and the model run's "named role" invariant fails

### Requirement: Focus And Closing

Initial focus SHALL follow the Menu rule by modality (pointer and touch: the content;
keyboard and assistive technology: the first item). On close, focus SHALL be restored to
the element that was focused when the menu opened, through the overlay restore rule. All
Menu closing rules SHALL apply, including window blur.

#### Scenario: Escape after a keyboard open

- **WHEN** a context menu opened with Shift+F10 on a row is closed with Escape
- **THEN** focus is on the row

#### Scenario: Window loses focus

- **WHEN** a context menu is open and the user switches to another application
- **THEN** the menu closes (regression: mui/base-ui#3125)

### Requirement: Data Attributes

`trigger` SHALL carry `data-scope="menu"`, `data-part="trigger"`, `data-context-menu`,
`data-instance`, `data-state` (`open` | `closed`), `data-disabled` when disabled, and
`data-focus` / `data-focus-visible` while a focusable region has focus itself. The
long-press hint reference (`aria-describedby`) SHALL be present only while closed.
The Menu parts SHALL carry the Menu data attributes; the content additionally SHALL carry
`data-context-menu`.

#### Scenario: Highlight the right-clicked row

- **WHEN** a context menu is open for a region
- **THEN** the region has `data-state="open"`

### Requirement: Context Menu Contract

The `context-menu` contract SHALL extend the `menu` contract (its actions, queries,
traits and exception), locate an instance by a text inside its region (a closed menu has
no content to name it by), and add `openAt(at)` (`at`: fractions of the region's box;
pointer: a right click there; touch: a long press; keyboard: focus the region and press
Shift+F10; virtual: a `contextmenu` with no preceding pointer press), `reanchor(at)` and
the query `anchorPoint()`. It SHALL declare no restore-target part: focus returns to what
had it when the menu opened (`<body>` when nothing had). Both adapters SHALL offer
`contextMenu()` (dispatched as a PointerEvent) and `longPress()` (on the environment's
time: fake timers or a virtual clock) on every part.

#### Scenario: Driver round trip

- **WHEN** a test runs `const c = getContextMenu(screen, { text: "README.md" })`,
  `await c.openAt()`, `await c.choose("Rename")`
- **THEN** both resolve after their postconditions and `await c.isOpen()` is false

#### Scenario: Long press in jsdom with fake timers

- **WHEN** the same driver runs `openAt` with the touch modality in jsdom with fake timers
- **THEN** it advances 500 ms and resolves with the menu open

### Requirement: Model-Based Coverage

`testMachine` over the context-menu contract SHALL cover every opening path in every
declared modality including `virtual`, with props classes `{ modal: true }` and
`{ modal: false }` (long presses on a virtual clock), and SHALL pass every invariant the
`menu` contract passes. `longPress: false` is covered by the DOM tests.

#### Scenario: Keyboard twin missing in a wrapper

- **WHEN** a consumer wrapper swallows Shift+F10 on the region's children and runs
  `testMachine`
- **THEN** the keyboard path of `openAt` fails, naming the action and the modality

