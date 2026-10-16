## Purpose

Defines rind-ui's Menu (dropdown menu): a menu button that opens a list of actions,
checkbox and radio items, links and submenus — its parts, attributes, keyboard and
pointer behaviour, closing rules and the contract its driver and model-based tests are
generated from. Layering, dismissal mechanics, positioning, collection navigation,
typeahead and hover intent are those of the capabilities this builds on and are not
restated.

## ADDED Requirements

### Requirement: Anatomy

The Menu SHALL consist of: `root` (no element), `trigger` (`button`), `positioner`
(`div`), `content` (`div`), `arrow` (`div`), `item` (`div`), `checkbox-item` (`div`),
`radio-group` (`div`), `radio-item` (`div`), `item-indicator` (`span`), `item-text`
(`span`), `group` (`div`), `group-label` (`div`), `separator` (`div`), `submenu` (no
element; the root of a nested level) and `submenu-trigger` (`div`). Only `root`,
`trigger` and `content` SHALL be required. A `submenu` SHALL contain one
`submenu-trigger` and its own `positioner` and `content`, and MAY be nested to any
depth. Every part SHALL accept the props of the element it renders and SHALL support
element substitution without a change in behaviour; an `item` rendered as `<a href>` is
a link item. Content SHALL work the same inline or inside the shared `Portal` part.

#### Scenario: Reado dropdown

- **WHEN** Reado's `Dropdown` (trigger, portal, positioner, content, rows with an item
  text, a check indicator and group headings) is rewritten with rind-ui parts
- **THEN** it opens, navigates, selects, closes and returns focus with no other change
  to its markup

#### Scenario: Three levels

- **WHEN** a menu has a submenu that has its own submenu, and the user selects an item
  in the third level
- **THEN** that item's `onSelect` runs once and every level closes (regression:
  radix#4095)

### Requirement: Open State And Reasons

The root menu's open state SHALL be a controllable value (`open`, `defaultOpen`,
`onOpenChange`), closed by default. Every change SHALL carry one of these reasons
(`details.reason`, kebab case like every other layer): `trigger` (a press on the
trigger, Enter or Space included), `trigger-key` (ArrowDown or ArrowUp on the
trigger), `item-select`, `escape-key`, `tab-key`, `outside-press`, `outside-focus`,
`window-blur`, `parent-dismissed` or `api` (programmatic). Controlled menus
SHALL only propose changes. Submenu open state SHALL NOT be controllable; it is owned
by the menu tree.

#### Scenario: Selecting an item in a controlled menu

- **WHEN** a controlled open menu's item is activated
- **THEN** `onOpenChange(false, details)` is called once with `details.reason ===
  "item-select"`

#### Scenario: Refused close

- **WHEN** the parent keeps `open={true}` after an `escape-key` proposal
- **THEN** the menu stays open and focus does not move

### Requirement: Opening From The Trigger

The trigger SHALL be a button-like part. A press SHALL toggle the menu on activation
(release), for mouse, pen, touch and keyboard, and for a bare `click` sent by assistive
technology; a pointer press-down alone SHALL NOT open it. ArrowDown and ArrowUp on the
trigger SHALL open a closed menu. A touch press that becomes a scroll SHALL NOT open the
menu. The release that completes an opening press SHALL NOT activate an item, even when
the content is placed under the pointer. While a modal menu is open, the trigger SHALL
count as inside the menu, so pressing it closes the menu with reason `trigger`
and never closes and re-opens it.

#### Scenario: VoiceOver press

- **WHEN** VoiceOver activates the trigger with VO+Space in Safari (a `click` with
  `detail: 0` and no pointer or key events)
- **THEN** the menu opens (regression: radix#1963, radix#2700, bits-ui#1760)

#### Scenario: Thumb resting on the trigger while scrolling

- **WHEN** a touch starts on the trigger and turns into a page scroll
- **THEN** the menu does not open (regression: radix#2418, radix#3977)

#### Scenario: Pointer cancellation

- **WHEN** the user presses the mouse on the trigger, moves off it and releases
- **THEN** the menu does not open (regression: radix#3124, kobalte#624)

#### Scenario: Content placed over the trigger

- **WHEN** a menu whose content overlaps its trigger is opened with a click
- **THEN** it stays open and no item is activated (regression: radix#610, radix#1089,
  react-spectrum#5350)

#### Scenario: Extended tap area

- **WHEN** the trigger contains an absolutely positioned child that enlarges its hit
  area and the user clicks that child
- **THEN** the menu opens and stays open (regression: mui/base-ui#3184)

### Requirement: Initial Focus By Modality

When the menu opens, focus SHALL move into it after its first placement: with the
keyboard (Enter, Space, ArrowDown) and with assistive technology (virtual modality) to
the first navigable item; with ArrowUp to the last navigable item; with a mouse, pen or
touch press to the content element, with no item highlighted. Initial focus SHALL run
once per open; changes to the items while open SHALL NOT re-run it. The key that opened
the menu SHALL NOT activate the item that receives focus.

#### Scenario: Screen reader open

- **WHEN** NVDA activates the trigger in browse mode (a bare `click`)
- **THEN** the first item is focused (regression: radix#1815)

#### Scenario: ArrowUp

- **WHEN** focus is on the trigger and the user presses ArrowUp
- **THEN** the menu opens with its last item focused (regression: radix#3640)

#### Scenario: Mouse open

- **WHEN** the user clicks the trigger
- **THEN** the content is focused, no item has `data-highlighted`, and ArrowDown then
  focuses the first item

#### Scenario: Enter does not leak into the first item

- **WHEN** the first item renders a native `<button>` and the user opens the menu with
  Enter
- **THEN** the menu is open with the first item focused and not activated (regression:
  radix#1655)

### Requirement: Keyboard Interactions

Inside an open menu: ArrowDown and ArrowUp SHALL move to the next and previous navigable
item, wrapping when `loop` is true (default `true`); Home and End SHALL move to the first
and last; printable characters SHALL use the shared typeahead; Enter SHALL activate the
focused item; Space SHALL activate it unless a typeahead search is in progress, in which
case Space joins the search; Space SHALL NOT scroll the page. The menu SHALL act only on
key events whose target is its content or one of its own items, never on keys from
other elements rendered inside it (inputs, nested dialogs). Key handling SHALL ignore
IME composition.

#### Scenario: Wrapping

- **WHEN** the last item is focused and the user presses ArrowDown
- **THEN** the first item is focused

#### Scenario: Input in a dialog opened inside a menu

- **WHEN** a dialog rendered inside a menu item contains a text field and the user
  types Space and presses Enter in it
- **THEN** the space is inserted, the form behaves natively and the menu does not react
  (regression: radix#3232, headlessui#2504)

#### Scenario: Space on an item

- **WHEN** the user presses Space on a focused item in a long page
- **THEN** the item activates and the page does not scroll (regression: radix#623)

### Requirement: Disabled Items

Disabled items SHALL carry `aria-disabled="true"` and `data-disabled`, SHALL be
reachable by arrow keys and typeahead (`focusableWhenDisabled`, default `true`), SHALL
never activate, and SHALL NOT be highlighted by pointer movement. With
`focusableWhenDisabled={false}` they SHALL be skipped by keyboard navigation too.

#### Scenario: Hovering a disabled item

- **WHEN** the pointer moves over a disabled item
- **THEN** it does not get `data-highlighted`, and the previously pointer-highlighted
  item loses it (regression: mui/base-ui#1733, mui/base-ui#4881)

#### Scenario: Keyboard reaches a disabled item

- **WHEN** the user arrows onto a disabled item and presses Enter
- **THEN** the item is focused, announced as dimmed by assistive technology, and nothing
  is activated

### Requirement: Pointer Highlight

Real mouse or pen movement over a navigable item SHALL highlight it and move focus to it
without scrolling, except while a keyboard or typeahead navigation session is active (the
shared pointer guard) and except when focus is in a text-entry element inside the menu.
Pointer leaving the content SHALL remove a pointer-made highlight and focus the content.
Touch SHALL never highlight by hover. A closing menu SHALL NOT react to pointer movement.

#### Scenario: Typeahead to an off-screen item

- **WHEN** the mouse rests over the list and typeahead scrolls an item into view so
  another item slides under the cursor
- **THEN** the typeahead match stays highlighted (regression: zag#3255, reka-ui#2100)

#### Scenario: Input inside the menu

- **WHEN** the user types in a search field rendered inside the menu and moves the mouse
  over items
- **THEN** focus stays in the field (regression: radix#2193)

#### Scenario: Pointer leaves

- **WHEN** an item highlighted by the pointer is left by moving the pointer off the
  content
- **THEN** no item has `data-highlighted` (regression: reka-ui#2596)

#### Scenario: Exit animation

- **WHEN** an item's `onSelect` focuses an editor and the pointer moves over items while
  the menu animates out
- **THEN** focus stays in the editor (regression: radix#4195, radix#1266)

### Requirement: Item Activation

An item SHALL activate on press release (from `click`), on Enter and on Space, exactly
once per press, calling `onSelect(details)`; for an element substituted with `render`,
keyboard activation SHALL dispatch a `click` on the rendered element so its own click
handler runs. Presses with a secondary mouse button SHALL neither activate an item nor
close the menu. Unless `details.cancel()` is called or the item's `closeOnSelect` is
false, activation SHALL close the whole menu tree with reason `item-select`.
`closeOnSelect` SHALL default to `true` for items and `false` for checkbox and radio
items. The menu SHALL close only after the activation's `click` has been dispatched, so
a touch selection never activates an element underneath the menu.

#### Scenario: Keep open

- **WHEN** an item's `onSelect` calls `details.cancel()` (Reado's "Open With" row that
  swaps the menu's content)
- **THEN** the menu stays open and focus stays on the item

#### Scenario: Touch selection over a button

- **WHEN** a user taps an item that lies over a button on the page
- **THEN** the item's `onSelect` runs and the button is not activated (regression:
  react-spectrum#1513, zag#776)

#### Scenario: Right click on an item

- **WHEN** the user right-clicks an item
- **THEN** nothing is selected and the menu stays open (regression: radix#2756)

#### Scenario: Custom button element

- **WHEN** an item is rendered with a component whose `onClick` logs, and the user
  activates it with Enter
- **THEN** the log runs once (regression: mui/base-ui#2281)

### Requirement: Checkbox And Radio Items

A `checkbox-item` SHALL have role `menuitemcheckbox` and a controllable `checked`
(`checked`, `defaultChecked`, `onCheckedChange`); activation SHALL toggle it. A
`radio-group` SHALL have role `group` and a controllable `value` (`value`,
`defaultValue`, `onValueChange`); activating a `radio-item` SHALL select its value.
Both SHALL carry `aria-checked` as `"true"` or `"false"`, never absent. Space on them
SHALL never close the menu; Enter and pointer activation SHALL close it only when
`closeOnSelect` is true. `item-indicator` SHALL render only while its item is checked,
unless `keepMounted`.

#### Scenario: Toggling several options

- **WHEN** the user clicks three checkbox items in turn
- **THEN** all three are checked and the menu stayed open throughout (regression:
  radix#2366)

#### Scenario: One activation per press

- **WHEN** a checkbox item with `closeOnSelect={false}` is clicked once
- **THEN** `onCheckedChange` is called once (regression: zag#237)

#### Scenario: Keyboard

- **WHEN** a radio item is focused and the user presses Space
- **THEN** it becomes checked, the previously checked radio becomes unchecked, and the
  menu stays open (regression: zag#1090)

### Requirement: Link Items

An item rendered as `<a href>` SHALL keep link navigation: Enter SHALL navigate through
the browser's own activation only, exactly once; Space SHALL navigate once and SHALL NOT
scroll the page; a primary activation SHALL close the menu tree. Clicks with ⌘, Ctrl or
Shift and middle clicks SHALL keep the browser's default (new tab or window) and SHALL
leave the menu open and call no `onSelect`. Closing SHALL NOT undo the navigation's
scroll (in-page anchors). Link items SHALL be built with add-link's `linkProps`
(`link-navigation`), so modifier and middle clicks, client routing through the
environment router and the disabled-link rules are the same as on a Link; the menu tree
SHALL close only when `linkProps` reports `onActivate({ disposition: "same-tab" })`. The
menu adds only the composite's Space handling on top.

#### Scenario: Enter on a link

- **WHEN** a link item with `target="_blank"` is focused and the user presses Enter
- **THEN** exactly one new tab opens and the menu closes (regression: zag#2704,
  react-spectrum#8697, react-spectrum#9431)

#### Scenario: Space on a link

- **WHEN** the user presses Space on a link item
- **THEN** it navigates once and the page did not scroll (regression: mui/base-ui#1746,
  react-spectrum#8916)

#### Scenario: Opening several links in tabs

- **WHEN** the user ⌘-clicks two link items in turn
- **THEN** two background tabs open and the menu is still open (regression: radix#2366
  discussion)

#### Scenario: Client router link

- **WHEN** a link item rendered by a client router's link component is clicked
- **THEN** the route changes and the menu closes (regression: radix#2718)

#### Scenario: Plain anchor link item uses the environment router

- **WHEN** a router is provided and a link item rendered as a plain `<a href="/docs">` is
  clicked
- **THEN** the router's `navigate("/docs")` is called once without a page load and the
  menu closes, while a ⌘-click on it opens a new tab and the menu stays open

#### Scenario: In-page anchor

- **WHEN** a modal menu's link item points at `#section` further down the page
- **THEN** after the menu closes the page is scrolled to that section (regression:
  mui/base-ui#2126)

### Requirement: Groups, Labels And Separators

A `group` SHALL have role `group` and be named by its `group-label` through
`aria-labelledby` while the label is rendered. A `separator` SHALL have role `separator`,
SHALL NOT be focusable or navigable, and SHALL NOT be counted as an item. The separator
part SHALL be built with add-separator's shared `separatorProps` helper in the `menu`
context (scope `menu`), so its role and orientation rules are the Separator's: its
default orientation is perpendicular to the menu's (horizontal in a vertical menu),
an explicit `orientation` wins, and `aria-orientation="vertical"` is emitted only for a
vertical separator. Any other element directly inside the content SHALL be exposed as
`none`.

#### Scenario: Labelled section

- **WHEN** a group labelled "Remote" contains two items
- **THEN** both items are inside a `group` named "Remote" and the label is not an item

#### Scenario: Separator between groups

- **WHEN** a vertical menu renders a `separator` between two groups
- **THEN** it has `role="separator"`, `data-orientation="horizontal"`, no
  `aria-orientation`, and ArrowDown from the last item of the first group focuses the
  first item of the second

#### Scenario: Separator in a horizontal menu

- **WHEN** a menu with a horizontal orientation renders a `separator` without
  `orientation`
- **THEN** it has `data-orientation="vertical"` and `aria-orientation="vertical"`

### Requirement: Submenus

A `submenu-trigger` SHALL be an item of its parent menu with role `menuitem`,
`aria-haspopup="menu"`, `aria-expanded` and `aria-controls` (while its content is
mounted). Enter, Space and the expand key (ArrowRight in left-to-right, ArrowLeft in
right-to-left, independent of the side the submenu was placed on) SHALL open the
submenu and focus its first navigable item; a pointer press and an assistive-technology
press SHALL open it, the latter focusing its first item. Activating the trigger of an
open submenu SHALL close it and keep focus on the trigger. The collapse key (the
opposite arrow) inside a submenu SHALL close it and focus its trigger. At most one
submenu SHALL be open per level: opening one closes its open sibling. Focus moving
from a submenu into its parent menu SHALL close the submenu only. Submenus SHALL work
when they mount after other submenus were opened.

#### Scenario: Keyboard into and out of a submenu

- **WHEN** a submenu trigger is focused and the user presses ArrowRight, then ArrowLeft
- **THEN** the submenu opened with its first item focused, then closed with focus back
  on its trigger (regression: radix#1443, zag#3056, ark#3733)

#### Scenario: Right-to-left

- **WHEN** `dir="rtl"` and the user presses ArrowLeft on a submenu trigger
- **THEN** the submenu opens to the inline end with its first item focused

#### Scenario: Enter opens, Enter selects

- **WHEN** the user opens a submenu with Enter and presses Enter again
- **THEN** the submenu's first item is activated (regression: react-spectrum#9686)

#### Scenario: TalkBack closes a submenu

- **WHEN** a screen reader activates an open submenu's trigger
- **THEN** the submenu closes and the parent menu stays open

#### Scenario: Swiping past the last submenu item

- **WHEN** iOS VoiceOver moves focus from the last submenu item to the next item of the
  parent menu
- **THEN** the submenu closes and the parent menu stays open (regression:
  mui/base-ui#5794)

#### Scenario: Virtual cursor

- **WHEN** a screen reader's virtual cursor activates a submenu trigger
- **THEN** focus moves to the submenu's first item (regression: radix#916)

#### Scenario: Late submenu

- **WHEN** a submenu trigger mounts after the user opened and closed another submenu
- **THEN** hovering it opens its submenu (regression: react-spectrum#9915)

### Requirement: Submenu Pointer Intent

Submenus SHALL open and close from pointer movement through the `hover-intent`
capability, with an open delay of `submenuOpenDelay` (default 100 ms) and a close delay
of 0, and its grace area computed toward the side the submenu was actually placed on.
The Menu SHALL extend it as follows: while the pointer is inside a submenu's grace
area, pointer movement over other items of the parent menu SHALL NOT move the parent's
highlight or focus, and SHALL NOT start opening another submenu; when the pointer rests
inside the grace area for `submenuGraceTimeout` (default 300 ms) without reaching the
submenu, the grace area SHALL end and the item under the pointer SHALL take the
highlight (opening its submenu if it is a submenu trigger). Leaving a submenu trigger
SHALL be detected even when the browser drops `mouseleave` during a fast sweep.

#### Scenario: Diagonal path to a submenu

- **WHEN** the pointer moves diagonally from a submenu trigger to the middle of its open
  submenu, crossing two other items
- **THEN** the submenu stays open, the crossed items are never highlighted and their
  submenus never open (regression: zag#2955, radix#3761)

#### Scenario: Resting in the grace area

- **WHEN** the pointer leaves a submenu trigger toward its submenu and stops over the
  next item for 300 ms
- **THEN** the submenu closes and the item under the pointer is highlighted (regression:
  radix#2935, bits-ui#2191)

#### Scenario: Flipped submenu

- **WHEN** a submenu is flipped to the inline-start side by collision and the pointer is
  flicked onto one of its items and clicked
- **THEN** the click activates that item (regression: radix#4036)

#### Scenario: Sweeping across submenu triggers

- **WHEN** the pointer sweeps quickly down five adjacent submenu triggers and stops on
  the last
- **THEN** only the last trigger's submenu opens (regression: mui/base-ui#5152,
  zag#2811, zag#2931)

#### Scenario: Own trigger

- **WHEN** the pointer returns from an open submenu to its own trigger
- **THEN** the submenu stays open (regression: reka-ui#2998)

### Requirement: Submenu Triggers On Apple Platforms

On Apple platforms, through the `vo-submenu-expanded` quirk entry, a submenu trigger
SHALL omit `aria-expanded` while its submenu is open (keeping `aria-haspopup`), so
VoiceOver announces the submenu's first item instead of the state change. The contract
SHALL declare this as an exception to "aria-expanded mirrors state" for the
`submenu-trigger` part only.

#### Scenario: VoiceOver

- **WHEN** a submenu is opened with ArrowRight on an Apple platform
- **THEN** its trigger has no `aria-expanded`, and the model run reports the exception
  by quirk id

#### Scenario: Windows

- **WHEN** the same submenu opens on Windows
- **THEN** its trigger has `aria-expanded="true"`

### Requirement: Escape, Tab And Window Blur

Escape SHALL close only the innermost open menu and focus its trigger (the root trigger
or the parent's submenu trigger), and SHALL call `preventDefault()` on the key it acted
on. Tab and Shift+Tab inside any level SHALL close the whole tree and move focus to the
element after, respectively before, the root trigger in sequential focus order. The
window losing focus SHALL close the whole tree with reason `window-blur` without moving
focus.

#### Scenario: Escape in a submenu

- **WHEN** focus is in a submenu and the user presses Escape
- **THEN** only the submenu closes and focus is on its trigger; a second Escape closes
  the menu and focuses the root trigger (regression: radix#1933)

#### Scenario: Escape in fullscreen

- **WHEN** the page is in fullscreen and the user presses Escape in a menu
- **THEN** the menu closes and the page stays in fullscreen (regression: radix#1420,
  radix#1751)

#### Scenario: Tab out

- **WHEN** a portalled menu is open and the user presses Tab on an item
- **THEN** every level closes and focus is on the element that follows the trigger
  (regression: radix#1934, headlessui#1634, bits-ui#1105, reka-ui#2296,
  mui/base-ui#411)

#### Scenario: Switching applications

- **WHEN** the window loses focus while a menu is open
- **THEN** the menu closes (regression: mui/base-ui#3125)

### Requirement: Focus Restore

When the tree closes, focus SHALL be restored to the root trigger by the overlay's
restore rule, which applies only while focus is still inside the menu tree or on
`body`. A focus move made by an item's handler SHALL be kept. Closing SHALL never move a
highlight. A level closed because a sibling menu opened (`TREE.SIBLING_OPENED`, as when
a menubar switches menus) SHALL skip focus restore: focus is moving into the sibling.

#### Scenario: Switching menus in a menubar

- **WHEN** the "File" menu of a menubar is open with focus on an item and the user
  presses ArrowRight to open "Edit"
- **THEN** focus moves from the "File" item to the first "Edit" item without the "File"
  trigger being focused in between

#### Scenario: Item focuses an editor

- **WHEN** an item's `onSelect` focuses a text editor outside the menu
- **THEN** after the menu closes the editor still has focus (regression:
  mui/base-ui#5930, radix#3106, headlessui#259)

#### Scenario: Click outside a mouse-opened menu

- **WHEN** a menu opened with the mouse is closed by clicking outside
- **THEN** no item got `data-highlighted` during the close (regression:
  react-spectrum#10767)

### Requirement: Hosted By A Menubar

When a menu root level's parent kind in the `MenuTree` is `menubar`:
- its layer's elements SHALL include the menubar root element (registered with the tree)
  in addition to its positioner, content and trigger, so the bar stays outside the inert
  set and presses on other bar items count as inside the menu;
- an expand key (ArrowRight in left-to-right, ArrowLeft in right-to-left) that the level
  did not consume (the focused item is not a submenu trigger), and a collapse key at the
  level's own top level, SHALL be forwarded to the parent through the `MenuTree` port
  instead of being ignored; submenu levels SHALL keep their own behaviour;
- the trigger SHALL be in menubar mode: role `menuitem` (no `button` role), no own tab
  stop (its roving `tabIndex` comes from the bar), a press delegated to the bar instead
  of toggling the level directly, and default element `div`; in a vertical bar the
  expand key on the trigger SHALL open its menu.

#### Scenario: Expand key on a plain item

- **WHEN** a menubar's "File" menu is open with focus on a plain item and the user
  presses ArrowRight
- **THEN** the menu level forwards the key to the bar and the "Edit" menu opens

#### Scenario: Collapse at the top level

- **WHEN** focus is on a plain item of the "Edit" menu and the user presses ArrowLeft
- **THEN** the key is forwarded to the bar and the "File" menu opens; inside an "Edit"
  submenu the same key closes only the submenu

#### Scenario: Bar outside the inert set (regression: ariakit#4023)

- **WHEN** a modal menubar menu is open
- **THEN** the menubar root is not inert and a press on another bar item switches menus
  with one press

#### Scenario: Trigger in menubar mode

- **WHEN** a Menu trigger is rendered inside a menubar
- **THEN** it is a `div` with `role="menuitem"`, `aria-haspopup="menu"`, its `tabIndex`
  is the bar's roving value, and pressing it asks the bar to open the menu

### Requirement: Modal By Default

The root menu SHALL be a modal layer of kind `menu` unless `modal={false}`: everything
outside it, its descendant layers and its trigger SHALL be inert and page scrolling
locked, as specified by the overlay capabilities; an outside press SHALL close the menu
with reason `outside-press` without activating the element under the pointer. Tab
SHALL follow Escape, Tab And Window Blur, not focus containment. With `modal={false}`,
nothing SHALL be inert, scrolling SHALL NOT be locked, an outside press SHALL close the
menu and reach the element under the pointer, and focus moving outside SHALL close it
with reason `outside-focus`. Submenus SHALL be non-modal descendant layers.

#### Scenario: Dismissing click on the page

- **WHEN** a modal menu is open and the user clicks a button on the page
- **THEN** the menu closes and the button is not activated (regression: ark#2874)

#### Scenario: Non-modal toolbar menus

- **WHEN** two `modal={false}` menus sit side by side, the first is open and the user
  clicks the second's trigger
- **THEN** the first closes and the second opens with that one click (regression:
  react-spectrum#10248, headlessui#1019, zag#548)

### Requirement: Accessible Name

The content SHALL have role `menu` and SHALL be named by the trigger through
`aria-labelledby`, unless the consumer passes `aria-label` or `aria-labelledby`. The
trigger SHALL stay outside the inert set while the menu is modal, so the name resolves
in every engine; the menu SHALL NOT copy the trigger's text into an attribute. A
submenu's content SHALL be named by its submenu trigger.

#### Scenario: Chromium accessibility tree

- **WHEN** a modal menu is open in Chromium and the accessibility tree is read through
  the browser
- **THEN** the menu's name is the trigger's text and the trigger is not inert
  (regression: react-spectrum#9737)

#### Scenario: Trigger text changes

- **WHEN** a trigger that shows the current value ("UTF-8") changes its text while the
  menu is closed and the menu then opens
- **THEN** the menu's name is the new text

### Requirement: Roles And ARIA Attributes

The trigger SHALL carry `aria-haspopup="menu"`, `aria-expanded` and `aria-controls`
pointing at the content only while the content is mounted. The content SHALL have
`role="menu"`, `tabindex="-1"` and `aria-orientation="vertical"` only when the consumer
sets a horizontal orientation (vertical is implicit). Items SHALL have role `menuitem`
(including link items, rendered as `<a role="menuitem">`), checkbox and radio items
their roles and `aria-checked`. The arrow and item indicators SHALL be `aria-hidden`.

#### Scenario: Closed menu

- **WHEN** the menu is closed and its content is not mounted
- **THEN** the trigger has `aria-expanded="false"` and no `aria-controls` (regression:
  radix#3013)

### Requirement: Menus And Dialogs

A menu rendered inside a dialog SHALL be a child layer of it: an outside press on the
dialog closes only the menu, and Escape closes only the menu. A dialog opened from a menu
item SHALL stay open after the menu tree closes and unmounts, SHALL receive initial
focus, and on close SHALL return focus to the menu's trigger; the page SHALL keep no
inert or style left by either.

#### Scenario: Dialog from an item

- **WHEN** an item opens a modal dialog whose input uses React's `autoFocus`, from the
  keyboard and from the mouse
- **THEN** the input is focused in both cases; closing the dialog focuses the menu
  trigger and the page responds to clicks (regression: radix#1836, radix#3317,
  ark#2883, reka-ui#2267)

#### Scenario: Menu in a dialog

- **WHEN** a menu inside a modal dialog is open and the user clicks the dialog's backdrop
- **THEN** only the menu closes

### Requirement: Positioning

The root content SHALL use the `dropdown` positioning preset and submenu content the
`submenu` preset, overridable by `positioning` props, and expose the positioning
contract fragment.

#### Scenario: Submenu at the viewport edge

- **WHEN** a submenu has no room on the inline-end side
- **THEN** it is placed on the inline-start side and carries `data-side` accordingly

### Requirement: Mounting

Content SHALL NOT be mounted before the menu first opens and SHALL be unmounted after
its exit animation; with `keepMounted` it SHALL stay mounted, hidden and inert while
closed, holding no layer. Closed menus SHALL do no positioning or hover-intent work.

#### Scenario: Lazy rows

- **WHEN** a menu's rows are fetched in `onOpenChange(true)` and arrive after opening
- **THEN** the first row is focusable by ArrowDown when it arrives and focus was not
  moved again by initial focus (regression: ariakit#7766)

### Requirement: Announcements

The menu SHALL NOT announce anything through the announcer; focus movement carries item
names and states to assistive technology.

#### Scenario: Navigating

- **WHEN** the user opens a menu and arrows through it with a recording announcer
- **THEN** the announcement log is empty

### Requirement: Data Attributes

Every part SHALL carry `data-scope="menu"`, `data-part` (its part name) and
`data-instance`. Additionally:

- `trigger`: `data-state` (`open` | `closed`), `data-focus`, `data-focus-visible`,
  `data-pressed`, `data-disabled`.
- `positioner`: placement attributes (`data-side`, `data-align`, `data-anchor-hidden`,
  `data-placing`), layer metadata (`data-nested`, `data-has-nested`, `--layer-index`).
- `content`: `data-state`, `data-side`, `data-align`, `data-placing`, `data-modal` when
  modal, `data-close-reason` (kebab case) from close until the next open, layer metadata.
- `item`, `checkbox-item`, `radio-item`, `submenu-trigger`: `data-key`,
  `data-highlighted`, `data-disabled`, `data-focus-visible`; checkbox and radio items
  `data-state` (`checked` | `unchecked`); submenu trigger `data-state` (`open` |
  `closed`).
- `item-indicator`: `data-state`. `radio-group`: `data-disabled` when disabled.
- `arrow`: `data-side`, `data-uncentered`.

`group`, `group-label`, `separator` and `item-text` SHALL carry only the scoping
attributes.

#### Scenario: Open submenu styling

- **WHEN** a submenu is open and focus is in it
- **THEN** its trigger has `data-state="open"` and no `data-highlighted` (regression:
  mui/base-ui#1197)

### Requirement: Menu Contract

The `menu` contract SHALL locate an instance by its trigger's role `button` and exact
accessible name, include the collection and positioning contract fragments, and declare
the traits `layer`, `restores-focus`, `presence`, `anchored`, plus `modal` when modal,
with the `vo-submenu-expanded` exception (invariant `state-attrs` on `submenu-trigger`).
Items of every level are located by role and exact name (`menuitem`,
`menuitemcheckbox`, `menuitemradio`). It SHALL declare the actions `open` (pointer,
touch and keyboard Enter), `openWithArrowUp`, `close` (the trigger, or Escape), `choose(name)`,
`toggle(name)` (checkbox and radio items), `openSubmenu(name)` (pointer hover and the
expand key), `closeSubmenu()` (collapse key), `pressEscape`, `pressOutside`, `tabOut`
and `typeahead(text)`, each with a postcondition, and the queries `isOpen`, `items`,
`highlighted`, `focusedItem`, `isChecked(name)`, `isDisabled(name)`, `openPath`
(names of the open submenu triggers) and `closeReason`. Programmatic `OPEN`/`CLOSE` and
`WINDOW_BLUR` events SHALL map to `{ skip: reason }`; `$sync:open` SHALL map to a prop step.

#### Scenario: Driver round trip

- **WHEN** a test runs `const m = getMenu(screen, { name: "Encoding" })`, then
  `await m.open()`, `await m.openSubmenu("Reopen with")`, `await m.choose("UTF-16")`
- **THEN** each action resolves after its postcondition, the item's `onSelect` ran once
  and `await m.isOpen()` is false

#### Scenario: Same test in Playwright

- **WHEN** the same test runs with `page`
- **THEN** it passes unchanged

### Requirement: Model-Based Coverage

`testMachine` over the menu contract SHALL cover every transition of a root menu level in
every declared modality including `virtual`, with props classes `{ modal: true }`,
`{ modal: false }` and `{ loop: false }`, in left-to-right and right-to-left, and SHALL
pass every generic, accessibility, collection, overlay and layout invariant. Submenu
levels (whose opening edges come from the parent level and hover intent) SHALL be covered
by the submenu DOM and browser tests. A close by Tab is exempt from the restores-focus
invariant: focus was restored to the trigger and the browser's Tab moved on from it.

#### Scenario: Wrapper breaks the trigger name

- **WHEN** a consumer wrapper renders an icon-only trigger with no accessible name and
  runs `testMachine`
- **THEN** the step that opens the menu fails, naming the unnamed `menu` and `button`

### Requirement: Label Activation Focuses The Trigger

The root menu's trigger SHALL declare the press option `labelActivation: "focus"`
(add-a11y-foundations `press-interactions`, following add-label's `label-interaction`
"Labels Focus Popup Triggers"). A click that the browser forwards to the trigger from any
label (a consumer `<label for>` or a wrapping `<label>`) SHALL focus the trigger and SHALL
NOT open the menu (radix#3679, headlessui#3787). A direct press on the trigger SHALL still
toggle the menu as specified in Opening From The Trigger.

#### Scenario: Label click focuses the trigger and does not open it (headlessui#3787)

- **WHEN** a closed menu's trigger is referenced by a `<label for>` and the user clicks the
  label's text
- **THEN** the trigger is focused and the menu stays closed

#### Scenario: Wrapping label (radix#3679)

- **WHEN** a menu trigger is wrapped in a `<label>`, the menu is opened by a press on the
  trigger, and an item is activated
- **THEN** the item's action runs, the menu closes, and it does not open again
