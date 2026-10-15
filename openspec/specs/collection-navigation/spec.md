# collection-navigation Specification

## Purpose
Defines how users move through a rind-ui collection — the highlighted item, keyboard
moves, the single tab stop, roving tabindex versus `aria-activedescendant`, disabled
items, repair when items change, scrolling, pointer interplay and the announcements
assistive technology needs — once for every collection component.
## Requirements
### Requirement: Highlight Is A Key

A collection component SHALL track at most one highlighted key, separate from the
selection, the range anchor and DOM focus. The highlighted key SHALL always be a key of
the current collection or none. Every highlight change SHALL record its source:
`keyboard`, `typeahead`, `typing` (the highlight followed text typed into a combobox
input), `pointer` or `programmatic`. Exactly one item, or none, SHALL
carry `data-highlighted`.

#### Scenario: Insertion before the highlight

- **WHEN** items are inserted before the highlighted item "m"
- **THEN** "m" stays highlighted

### Requirement: Logical Moves

Machines SHALL receive navigation as logical moves — next, previous, first, last, page
next, page previous and, in trees, expand and collapse — never raw key names. The
following keyboard mapping SHALL apply, with horizontal arrows mirrored in right-to-left
direction and vertical arrows, Home, End, PageUp and PageDown never mirrored:

| Key | Vertical | Horizontal |
|---|---|---|
| ArrowDown / ArrowUp | next / previous | — |
| ArrowRight / ArrowLeft (LTR) | — (tree: expand / collapse) | next / previous |
| Home / End | first / last | first / last |
| PageDown / PageUp | page next / page previous | — |

A component with orientation `both` SHALL accept both pairs of arrows. Moves SHALL
update the highlight synchronously, so a key pressed before DOM focus has moved is
computed from the new highlight.

#### Scenario: RTL horizontal

- **WHEN** ArrowLeft is pressed in a horizontal collection under `dir="rtl"`
- **THEN** the highlight moves to the next item

#### Scenario: Fast key presses

- **WHEN** ArrowRight is pressed three times faster than focus can move
- **THEN** the third item after the start is highlighted and focused, and no press is
  lost

### Requirement: Loop, Ends And Pages

With `loop`, next on the last navigable item SHALL move to the first and previous on the
first to the last; without it they SHALL do nothing. First and last SHALL move to the
first and last navigable items of the whole collection, including unmounted ones. Page
moves SHALL move by the number of items that fit in the visible area when the
environment can measure it, SHALL fall back to ten items when it cannot, and SHALL stop
at the ends without looping.

#### Scenario: No loop

- **WHEN** next is requested on the last item of a collection without `loop`
- **THEN** the highlight does not change

#### Scenario: Page without layout

- **WHEN** page next is requested in an environment that cannot measure layout
- **THEN** the highlight moves ten navigable items forward, or to the last item

### Requirement: Disabled Items In Navigation

Disabled items SHALL be skipped by every move unless the component enables
`focusableWhenDisabled`, in which case they SHALL be reachable, carry
`aria-disabled="true"` and never use the native `disabled` attribute. Every search for
the next navigable item SHALL stop after at most one pass over the collection. When no
item is navigable, moves SHALL do nothing and the highlight SHALL be none.

#### Scenario: All disabled

- **WHEN** every item is disabled and the user presses ArrowDown and End
- **THEN** nothing is highlighted, nothing hangs, and the widget is still reachable by
  Tab

#### Scenario: Run of disabled items

- **WHEN** items 2 to 5 are disabled and the user presses ArrowDown on item 1
- **THEN** item 6 is highlighted

### Requirement: Focus Strategies

A component SHALL declare one focus strategy. With `roving`, DOM focus SHALL be on the
highlighted item, which SHALL have `tabIndex=0` while every other item has
`tabIndex=-1`. With `active-descendant`, DOM focus SHALL stay on the input or container,
which SHALL carry `aria-activedescendant` set to the highlighted item's id, or no
attribute when nothing is highlighted; items SHALL NOT be focusable; and the referenced
element SHALL be rendered, carry an item role and lie inside the element named by
`aria-controls`. `active-descendant` SHALL be used only by components whose focus must
stay in a text field (Combobox, Autocomplete, Command, Tags Input, Mentions); all others
SHALL use `roving`.

#### Scenario: Roving tab stop

- **WHEN** a roving collection of five items has "c" highlighted
- **THEN** only "c" has `tabIndex=0` and DOM focus is on "c"

#### Scenario: Active descendant

- **WHEN** the user arrows to option "b" in an active-descendant collection
- **THEN** DOM focus stays in the input and its `aria-activedescendant` is the id of "b"

### Requirement: Exactly One Tab Stop

A roving collection SHALL be exactly one Tab stop at all times: the highlighted item;
else the first selected navigable item of the visible collection; else the first navigable item; else, when no
item is navigable or the collection is empty, the list container itself. When the
composite itself is disabled and not `focusableWhenDisabled`, NOTHING in it SHALL be a
Tab stop, matching native disabled controls (base-ui#4174). A selected but
disabled item SHALL NOT be the tab stop unless it is navigable. In a tree, the Tab stop SHALL be computed over the visible
collection (nodes not hidden by a collapsed ancestor); a selected or highlighted node that is
hidden SHALL be replaced by its nearest visible ancestor. Before item parts have
registered (server render, first paint), the item whose key is selected SHALL have
`tabIndex=0`, or the container when there is none.

#### Scenario: Disabled selected tab

- **WHEN** the selected tab is disabled
- **THEN** the first enabled tab has `tabIndex=0` and the tab list is reachable by Tab

#### Scenario: Disabled composite is skipped (base-ui#4174)

- **WHEN** a disabled radio group (not `focusableWhenDisabled`) is on the page and the
  user presses Tab through it
- **THEN** focus skips the whole group, and neither the container nor any item can be
  focused programmatically by rind-ui

#### Scenario: Selected node under a collapsed parent

- **WHEN** a tree's selected node is inside a collapsed branch
- **THEN** the branch's row (the nearest visible ancestor) is the Tab stop and no hidden
  node has `tabIndex=0`

#### Scenario: Server render

- **WHEN** a roving collection with `defaultValue="b"` is server-rendered
- **THEN** the HTML gives item "b" `tabIndex=0` and every other item `tabIndex=-1`

### Requirement: Repair When The Collection Changes

When the highlighted key leaves the collection (removal, filtering, collapse of its
parent) the highlight SHALL move to the first key after it in the previous collection's
order that still exists and is navigable, else the first such key before it, else none.
In a tree the walk SHALL run over the visible collection, and when the highlighted key is
absent from the visible collection but present in the full one (an ancestor collapsed), the
highlight SHALL move to its nearest visible ancestor instead.
In roving mode, if DOM focus was inside the collection, focus SHALL move with the
highlight, or to the container when the highlight is none — never to `<body>`. Repair
SHALL be driven by the collection data, not by item elements unmounting, so
virtualization and suspended items do not trigger it.

#### Scenario: Delete the focused tag

- **WHEN** the focused tag "b" of "a, b, c" is removed
- **THEN** "c" is highlighted and focused

#### Scenario: Delete the last tag

- **WHEN** the focused last tag "c" of "a, b, c" is removed
- **THEN** "b" is highlighted and focused

#### Scenario: Delete next to disabled items

- **WHEN** the focused item is removed and every following item is disabled
- **THEN** the nearest navigable item before it is focused and nothing hangs

#### Scenario: Ancestor collapses under the highlight

- **WHEN** the highlighted node "a.ts" is inside "src" and "src" is collapsed
- **THEN** "src" is highlighted and focused

#### Scenario: Virtualized item unmounts

- **WHEN** the highlighted item scrolls out of a virtualized list and unmounts
- **THEN** the highlight does not change

### Requirement: Scrolling Follows Navigation Only

A highlight change from `keyboard`, `typeahead` or `programmatic` navigation SHALL bring
the highlighted item into view with the smallest scroll (`block: "nearest"`); opening a
popup with a selected item SHALL centre it (`block: "center"`, native select parity,
ariakit#7011), unless the component asks for `nearest`. Neither SHALL use smooth
scrolling. The alignment SHALL be passed to the scroll-to-index callback (`align`). A `pointer` highlight
and a collection change SHALL NOT scroll. In a virtualized component scrolling SHALL go
through the scroll-to-index callback.

#### Scenario: Items appended

- **WHEN** an infinite list appends items while an item is highlighted
- **THEN** the scroll position does not change

#### Scenario: Pointer highlight

- **WHEN** the pointer moves onto a partly visible item
- **THEN** the list does not scroll

### Requirement: Pointer And Keyboard Interplay

Pointer movement SHALL highlight the item under the pointer only for real pointer
movement: a pointer or mouse move whose coordinates did not change SHALL be ignored, and
pointer moves SHALL NOT change the highlight while a keyboard or typeahead navigation
session is active, until the pointer moves again. Pointer leave during keyboard
navigation SHALL NOT clear the highlight. These rules SHALL be implemented once for all
collection components.

#### Scenario: List scrolls under a resting pointer

- **WHEN** keyboard navigation scrolls the list and the browser fires a zero-delta
  `mousemove` over another item
- **THEN** the keyboard highlight stays where it is

### Requirement: Composition And Modifiers

Navigation SHALL ignore key events that are part of an IME composition (`isComposing`,
or `keyCode` 229), and SHALL NOT change the highlight or move focus while a composition
is in progress in the component's input.

#### Scenario: Japanese input

- **WHEN** the user presses ArrowDown while composing in a combobox input
- **THEN** the highlight does not change

### Requirement: Trees

In a tree, expand on a collapsed branch SHALL expand it; expand on an expanded branch
SHALL move to its first child; collapse on an expanded branch SHALL collapse it;
collapse on a leaf or collapsed branch SHALL move to its parent. Expanded keys SHALL be a
controllable value. Tree items SHALL carry `aria-level`, `aria-setsize` and
`aria-posinset` for their sibling set, and branches `aria-expanded`.

#### Scenario: Collapse moves to parent

- **WHEN** collapse is requested on leaf "a.ts" inside "src"
- **THEN** "src" is highlighted

### Requirement: Announcements For Active Descendant On Apple Platforms

When the environment reports an Apple platform, an `active-descendant` component SHALL
announce, through the injected announcer, the text value of each newly highlighted item
whose highlight source is `keyboard` (never `typing`, `pointer` or `programmatic`),
prefixed by its section label and the section's option count when the section changed,
and followed by its selected state; on other platforms it SHALL NOT announce highlight
changes. Which Apple platforms announce is decided by the announcer's
`vo-activedescendant` quirk entry (add-a11y-foundations). Roving components
SHALL NOT announce highlight changes on any platform.

#### Scenario: VoiceOver on macOS

- **WHEN** the user arrows from "Apple" in section "Fruit" to "Carrot" in section
  "Vegetables" on an Apple platform
- **THEN** the announcer receives one announcement containing "Vegetables", the
  section's option count, and "Carrot"

#### Scenario: Highlight that follows typing

- **WHEN** typing "ca" into a combobox moves the highlight to "Carrot"
- **THEN** no highlight announcement is made (the typed letters are read instead)

#### Scenario: Windows

- **WHEN** the same move happens on a non-Apple platform
- **THEN** no announcement is made

### Requirement: Sections For Assistive Technology

A section SHALL render as an element with role `group` labelled by its section label
through `aria-labelledby`; the label SHALL NOT be an item and SHALL NOT be counted in set
size or position. A separator between sections SHALL have role `separator` and SHALL
NOT be navigable.

#### Scenario: Section label not counted

- **WHEN** a sectioned list renders its first option
- **THEN** that option is in a `group` named by the section label and, when set metadata
  is emitted, has `aria-posinset="1"`

