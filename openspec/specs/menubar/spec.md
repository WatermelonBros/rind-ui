# menubar Specification

## Purpose
Defines rind-ui's Menubar: a persistent, named row (or column) of menu items, each
opening a Menu, that is one tab stop with arrow-key and typeahead navigation, and that
switches between open menus by press, hover and keyboard without a second click. Every
behaviour inside a menu is that of the `menu` capability and is not restated.
## Requirements
### Requirement: Anatomy

The Menubar SHALL consist of `root` (`div`), one `menu` per top-level menu (no element:
a Menu root level whose parent is the menubar) and, in each menu, one `trigger` (`div`)
followed by the Menu parts (`positioner`, `content`, items, groups, separators,
submenus) exactly as the `menu` capability defines them. Every part SHALL accept the
props of the element it renders and SHALL support element substitution without a change
in behaviour.

#### Scenario: Reado title bar

- **WHEN** Reado's `MenuBar` (File / Edit / View with items, disabled items, headers,
  separators and shortcut hints) is rewritten with `Menubar.Root`, `Menubar.Menu`,
  `Menubar.Trigger` and Menu parts
- **THEN** it opens, switches by hover, runs commands, closes on item, Escape and outside
  press, and additionally gains roles, arrow keys and focus restore

### Requirement: Roles And Naming

The root SHALL have role `menubar`, `aria-orientation="vertical"` only when vertical,
and its name from the consumer's `aria-labelledby` or `aria-label`; a development
warning SHALL name an unnamed menubar. Each `trigger` SHALL have role `menuitem`,
`aria-haspopup="menu"`, `aria-expanded` (true while its menu is open) and
`aria-controls` while its content is mounted. Each menu's content SHALL be named by its
trigger, following the `menu` capability. The root's children in the accessibility tree
SHALL be menubar items only (wrappers exposed as `none`); no portal owner or other
foreign element SHALL be inserted among them.

#### Scenario: Open menubar passes axe

- **WHEN** a menubar has its "Edit" menu open and is checked with axe
- **THEN** there are no violations, `aria-required-children` included (regression:
  mui/base-ui#4004)

#### Scenario: No aria-owns

- **WHEN** a menu of the menubar is open
- **THEN** no element in the document carries an `aria-owns` pointing at the menu or its
  portal (regression: ariakit#5262)

### Requirement: Open Menu Value And Reasons

Which menu is open SHALL be a controllable value (`value`, `defaultValue`,
`onValueChange`), the open menu's key or `null`, `null` by default. Each change SHALL
carry one of these reasons (kebab case, like every other component's): `trigger` (a
press on an item, Enter or Space included), `trigger-key` (an arrow key that opens),
`hover`, `menu-navigate`, the close reason of the menu that closed (`item-select`,
`escape-key`, `tab-key`, `outside-press`, `outside-focus`, `window-blur`), or `api`
(programmatic). An initial `value` or `defaultValue` SHALL open its menu once the menus
are mounted. At most one menu SHALL be open. A menu's own open state SHALL be derived
from this value; `Menubar.Menu` SHALL NOT accept its own `open` props. Keys SHALL be
strings compared by value.

#### Scenario: Switching in a controlled menubar

- **WHEN** "File" is open in a controlled menubar and the user hovers "Edit"
- **THEN** `onValueChange("edit", details)` is called once with `details.reason ===
  "hover"`, and only "Edit" is open after the parent accepts it

#### Scenario: Programmatic open

- **WHEN** the application sets `value="format"` from a keyboard shortcut and the user
  then hovers "View"
- **THEN** "Format" closes and "View" opens, and never are both open (regression:
  ariakit#7083, ariakit#7086)

### Requirement: One Tab Stop

The menubar SHALL be exactly one Tab stop, as specified by the collections' "Exactly One
Tab Stop": on first entry, the first navigable item; afterwards the item focused last.
Before items register, the first item rendered SHALL have `tabIndex=0`. Tab and
Shift+Tab SHALL leave the menubar (closing any open menu, per the `menu` capability).

#### Scenario: Return to the last item

- **WHEN** the user arrows to "View", tabs out and tabs back
- **THEN** focus is on "View" and no menu is open

### Requirement: Keyboard On The Bar

With focus on a menubar item and no menu open: in a horizontal menubar ArrowRight and
ArrowLeft SHALL move to the next and previous item (mirrored under `dir="rtl"`); in a
vertical one ArrowDown and ArrowUp SHALL. Home and End SHALL move to the first and last
item. `loop` (default `true`) SHALL wrap at the ends. Printable characters SHALL move
focus to the next item whose text starts with the typed text, through the shared
typeahead. Moving SHALL never open a menu. The bar SHALL act only on keys whose target
is one of its items and that carry no Alt, Control or Meta modifier.

#### Scenario: Left arrow

- **WHEN** focus is on "Edit" and the user presses ArrowLeft
- **THEN** focus is on "File" (regression: huntabyte/bits-ui#989)

#### Scenario: Typeahead on the bar

- **WHEN** focus is on "File" and the user types "v"
- **THEN** focus is on "View" and no menu opens

#### Scenario: Arrows never open

- **WHEN** the user arrows along the bar with no menu open
- **THEN** no menu opens and the item that lost focus has no `data-highlighted`
  (regression: unovue/reka-ui#164)

#### Scenario: Keys from another popup

- **WHEN** a popover elsewhere on the page is open and the user presses ArrowDown in it
- **THEN** the menubar does nothing (regression: huntabyte/bits-ui#1593)

### Requirement: Opening A Menu

On a horizontal menubar item, Enter, Space and ArrowDown SHALL open its menu and focus
its first item, and ArrowUp SHALL open it on its last item; on a vertical menubar item,
Enter, Space and the expand key (ArrowRight in left-to-right, ArrowLeft in right-to-left)
SHALL open it on its first item. The key SHALL open the menu of the item that has focus.
A pointer press SHALL open on release, with the `menu` capability's rules (focus on the
content, nothing highlighted; a touch that turns into a scroll opens nothing); an
assistive-technology press SHALL open and focus the first item. Pointer hover SHALL
NOT open a menu while no menu is open.

#### Scenario: VoiceOver opens a menu

- **WHEN** VoiceOver users press VO+Space on "File" in Safari, delivering a bare `click`
- **THEN** the File menu opens with its first item focused (regression:
  radix-ui/primitives#3699)

#### Scenario: Enter on the arrowed-to item

- **WHEN** focus arrived on "Edit" by ArrowRight from "File" and the user presses Enter
- **THEN** the Edit menu opens, not the File menu (regression: kobaltedev/kobalte#332)

#### Scenario: Scrolling over the bar on a phone

- **WHEN** a touch starts on "File" and moves into a page scroll
- **THEN** no menu opens (regression: radix-ui/primitives#3267)

#### Scenario: Hover with nothing open

- **WHEN** no menu is open and the mouse moves over "Edit"
- **THEN** no menu opens

### Requirement: Switching Between Open Menus

While a menu is open (open mode), each of these SHALL close it and open another
menubar item's menu in one step, with no intermediate state where none or two are open:
a press on another item; a mouse or pen moving onto another item (no delay, never from
touch); and an arrow key that the open menu does not use (see Arrow Keys Inside An Open
Menu). The newly opened menu SHALL take focus by the `menu` capability's
focus-by-modality rule. Disabled items SHALL be skipped when switching by keyboard and
SHALL do nothing when hovered or pressed. A press on the item whose menu is open SHALL
close it, except the pointer press that completes a hover switch onto that item (the
pointer arriving to click it): that press SHALL keep the menu the hover opened. When the last open menu closes, for any reason, open mode SHALL end, and
hover SHALL no longer open menus.

#### Scenario: One press switches modal menus

- **WHEN** a modal "File" menu is open and the user clicks "Edit"
- **THEN** File closes and Edit opens with that one click, and Edit stays open when the
  click lands after the pointer's hover already switched to it (regression: ariakit#4023,
  kobaltedev/kobalte#544)

#### Scenario: Hover switches

- **WHEN** "File" is open and the mouse moves onto "Edit"
- **THEN** Edit's menu is open and File's is closed, without a click

#### Scenario: Open mode ends on close

- **WHEN** the user opens "File" with a click, closes it by clicking "File" again (or by
  Escape), and then hovers "Edit"
- **THEN** no menu opens, and arrow keys on the bar still move focus (regression:
  kobaltedev/kobalte#333)

#### Scenario: Item rules after switching

- **WHEN** the user opens "Edit", hovers to "View", opens its "Layout" submenu and
  activates a radio item there
- **THEN** the menu stays open, exactly as when "View" was opened directly (regression:
  mui/base-ui#2092)

#### Scenario: Sweeping across the bar

- **WHEN** a menu is open and the mouse sweeps quickly across five bar items
- **THEN** exactly one menu is open at every moment and it is the last item's

### Requirement: Arrow Keys Inside An Open Menu

In a horizontal menubar, when focus is in an open menu: the expand key on a submenu
trigger SHALL open the submenu, and the collapse key inside a submenu SHALL close it, as
the `menu` capability specifies. The expand key on an item that has no submenu, and the
collapse key at the menu's top level, SHALL instead switch to the next, respectively
previous, enabled menubar item's menu (wrapping with `loop`) and focus its first item.
In a vertical menubar the collapse key at a menu's top level SHALL close the menu and
focus its menubar item, and the expand key on an item without a submenu SHALL do
nothing. Up and Down inside a menu SHALL always stay in the menu.

#### Scenario: Right arrow from the File menu

- **WHEN** focus is on "New" in the open File menu and the user presses ArrowRight
- **THEN** File closes, Edit opens and its first item is focused

#### Scenario: Right arrow on a submenu trigger

- **WHEN** focus is on the "Open Recent" submenu trigger in the File menu and the user
  presses ArrowRight
- **THEN** the submenu opens and the menubar does not switch

#### Scenario: Left arrow in a submenu

- **WHEN** focus is in the "Open Recent" submenu and the user presses ArrowLeft
- **THEN** only the submenu closes and focus is on its trigger in the File menu

#### Scenario: Right-to-left

- **WHEN** the menubar is under `dir="rtl"` and focus is on an item without a submenu
- **THEN** ArrowLeft switches to the next menubar item's menu

### Requirement: Closing

Closing a menubar menu SHALL follow the `menu` capability: Escape closes the innermost
menu and, at a menu's top level, closes it and focuses its menubar item; activating an
item closes the menu (unless the item keeps it open); Tab and Shift+Tab close it and
leave the menubar, from inside the menu or from its bar item; an outside press, outside focus (non-modal) or the window losing
focus close it. Each SHALL set the menubar value to `null` with the menu's close reason
and end open mode.

#### Scenario: Escape returns to the bar

- **WHEN** the Edit menu is open with focus on an item and the user presses Escape
- **THEN** the menu closes, focus is on "Edit", and ArrowRight moves to "View" without
  opening it

#### Scenario: Tab leaves the bar

- **WHEN** the File menu is open and the user presses Tab
- **THEN** the menu closes and focus is on the element after the menubar

### Requirement: Modality

`modal` (default `true`) SHALL be passed to every menu of the menubar. While a modal menu
is open, the menubar root and its items SHALL belong to that menu's layer: they SHALL
stay outside the inert set, keep their accessible names, receive pointer hover and
presses, and count as inside for dismissal, so a press on another item switches menus
instead of only dismissing. Everything else outside SHALL be inert and page scrolling
locked, as the overlay capabilities specify. With `modal={false}` nothing is inert, and
an outside press closes the menu and reaches the page.

#### Scenario: Names stay reachable

- **WHEN** a modal menu of the menubar is open in Chromium and the accessibility tree is
  read through the browser
- **THEN** the menubar items are not inert and the open menu is named by its item

#### Scenario: Non-modal menubar

- **WHEN** a `modal={false}` menubar has a menu open and the user clicks a page button
- **THEN** the menu closes and the button is activated

### Requirement: Orientation And Positioning

`orientation` SHALL be `horizontal` (default) or `vertical`. A horizontal menubar's
menus SHALL be placed below their item, aligned to its start, with the `dropdown`
positioning preset; a vertical menubar's menus SHALL be placed at the inline end of
their item with the `submenu` preset. Collision handling SHALL follow the positioning
capability.

#### Scenario: Vertical menubar

- **WHEN** focus is on "File" in a vertical menubar and the user presses ArrowRight
- **THEN** the File menu opens beside the item, with its first item focused, and
  ArrowDown on the bar (with no menu open) moves to "Edit" (regression: ariakit#7410,
  radix-ui/primitives#3762)

### Requirement: Disabled Items

A disabled menubar item SHALL carry `aria-disabled="true"`, SHALL stay focusable and
reachable by arrow keys and typeahead by default (`focusableWhenDisabled` default
`true`), and SHALL never open its menu. `disabled` on the root SHALL disable every item.
With `focusableWhenDisabled={false}` disabled items SHALL be skipped.

#### Scenario: Disabled menubar

- **WHEN** a menubar is rendered with `disabled`
- **THEN** every item has `aria-disabled="true"` and no press or key opens a menu
  (regression: mui/base-ui#2727)

#### Scenario: Switching over a disabled item

- **WHEN** "File" is open, "Edit" is disabled and the user presses ArrowRight on a plain
  item in File
- **THEN** File closes and "View" opens

### Requirement: Programmatic Focus

The menubar SHALL expose `focus()`, moving focus to its tab-stop item with the
`programmatic` source, so applications can bind their own shortcut to reach it. It SHALL
bind no global key.

#### Scenario: Application shortcut

- **WHEN** an application calls the menubar's `focus()` from its F10 handler
- **THEN** focus is on the menubar's tab-stop item and no menu is open

### Requirement: Announcements

The menubar SHALL make no announcements of its own; items and menus are announced
through roles and states as focus moves.

#### Scenario: Navigating and switching

- **WHEN** the user arrows along the bar and switches menus with a recording announcer
- **THEN** the announcement log is empty

### Requirement: Data Attributes

The root SHALL carry `data-scope="menubar"`, `data-part="root"` and `data-instance`. A
`trigger` is the menu's trigger and SHALL keep the menu's `data-scope="menu"`,
`data-part="trigger"` and the menu's `data-instance` (the menu's parts and contract
resolve through it), and SHALL carry `data-host="menubar"`, which marks it as a bar
item. Menu parts inside a menu keep `data-scope="menu"`. Additionally:

- `root`: `data-orientation`, `data-state` (`open` while a menu is open, else
  `closed`), `data-disabled` when disabled, `data-modal` when modal.
- `trigger`: `data-host="menubar"`, `data-key`, `data-state` (`open` | `closed`),
  `data-highlighted` while it has focus, `data-focus-visible`, `data-disabled`,
  `data-orientation`, `data-pressed`.

All parts SHALL forward `data-variant`, `data-size` and `data-tone` unchanged.

#### Scenario: Open-mode styling

- **WHEN** the File menu is open
- **THEN** the root has `data-state="open"` and the File item has `data-state="open"`
  while the other items have `data-state="closed"`

### Requirement: Menubar Contract

The `menubar` contract SHALL locate an instance by role `menubar` and exact accessible
name and include the collection contract fragment's queries. It SHALL declare the
actions `tabIn()`, `moveTo(name)` (keyboard: bar arrows; no pointer implementation, with
the stated reason that pointer focus is a press), `openMenu(name)` (pointer: click;
touch: tap; keyboard: `moveTo` then Enter, or, with a menu open, focus the item then
Enter; on the open item it closes it), `openMenuOnLast(name)` (keyboard: `moveTo` then
ArrowUp; a vertical bar has no such key and uses its expand key), `switchTo(name)`
(pointer: hover the item; touch: tap it; keyboard: the expand key inside the open menu
until the named menu is open, or in a vertical bar Escape, the bar's arrows and Enter),
`closeMenu()` (Escape), `typeahead(text)` and `tabOut()`, each with a postcondition, the
model-step actions `focusItem(name)`, `arrowNext()` and `leave()`, and the queries
`items()`, `currentMenu()` (the open menu's item name or null; `openMenu` is the
action), `focusedItem()`, `tabStop()`, `isDisabled(name)` and `orientation()`. The
testing package's `getMenubar(…).menu(name)` SHALL return the `menu` driver of that
item's menu, located through the item (role `menuitem`). It SHALL declare the trait
`directional`; each menu keeps the `menu` contract's traits. Programmatic `OPEN` /
`CLOSE`, `FOCUS_MENUBAR`, `TYPEAHEAD` (the typeahead action and DOM tests),
`MENU_NAVIGATE` (switchTo's keyboard path) and the `value` prop (`VALUE.SYNC`,
`$props:value`) SHALL map to `{ skip: reason }`.

#### Scenario: Driver round trip

- **WHEN** a test runs `const bar = getMenubar(screen, { name: "Application" })`, then
  `await bar.openMenu("File")`, `await bar.switchTo("Edit")`,
  `await bar.menu("Edit").choose("Find…")`
- **THEN** each action resolves after its postcondition, the item's `onSelect` ran once
  and `await bar.currentMenu()` is null

#### Scenario: Same test in Playwright

- **WHEN** the same test runs with `page`
- **THEN** it passes unchanged

### Requirement: Model-Based Coverage

`testMachine` over the menubar contract SHALL cover every transition of the menubar
graph in every declared modality including `virtual`, in both directions, with argument
classes horizontal, vertical, `loop: false`, a disabled item, a disabled menubar,
`modal: true` and `modal: false`, composing each menu's own `menu` contract coverage,
and SHALL pass every generic, accessibility, collection and overlay invariant.

#### Scenario: Wrapper breaks the item role

- **WHEN** a consumer wrapper renders menubar items as plain buttons without
  `role="menuitem"` and runs `testMachine`
- **THEN** the first step fails, naming the `menubar` with no menu items
  (`menubar-one-tab-stop: the menubar has no menu items`)

