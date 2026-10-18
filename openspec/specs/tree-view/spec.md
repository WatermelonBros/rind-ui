# tree-view Specification

## Purpose
Defines rind-ui's Tree View: a hierarchy of nodes the user expands, collapses, navigates
with the keyboard and optionally selects or checks — its parts, ARIA shape, keyboard and
pointer behaviour, selection and checking, lazy children, links, announcements,
attributes and the contract its driver and model-based tests are generated from. Keys,
tree collections, navigation, typeahead, selection rules, repair, set metadata and the
virtualization contract are those of the `add-collections` capabilities and are not
restated.
## Requirements
### Requirement: Anatomy

The Tree View SHALL consist of: `root` (no element), `label` (`span`), `tree` (`div`),
`item` (`div`, or `a` when it has `href`), `item-indicator` (`span`), `item-checkbox`
(`span`), `item-text` (`span`), `loading` (`span`) and `empty` (`div`). Only `root`, `tree`
and `item` SHALL be required. Items SHALL be rendered from a tree collection through a
render function over the visible nodes, as a flat list of siblings (no wrapper element per
branch). Every part SHALL accept the props of the element it renders and SHALL support
element substitution without a change in behaviour.

#### Scenario: Minimal tree

- **WHEN** a consumer renders a tree named "Files" from a collection with two folders,
  one of them containing a file
- **THEN** a `tree` named "Files" is rendered with a `treeitem` per visible node, and it is
  one Tab stop

#### Scenario: Flat DOM

- **WHEN** a branch is expanded
- **THEN** its children are siblings of the branch item in the tree element, not
  descendants of it

### Requirement: Roles And Set Metadata

The `tree` part SHALL have role `tree` and an accessible name from the Label part
(`aria-labelledby`), a consumer `aria-label` or `aria-labelledby`; a tree without a name
SHALL produce a development warning. `aria-multiselectable="true"` SHALL be set in
`multiple` selection mode. Every `item` SHALL have role `treeitem` and carry `aria-level`
(1 for roots), `aria-setsize` and `aria-posinset` for its sibling set, always, not only
when virtualized. A branch SHALL carry `aria-expanded` `"true"` or `"false"`; a leaf SHALL
NOT carry the attribute. An item SHALL be named by its `item-text`; indicators, checkbox and
badges SHALL be `aria-hidden` and not part of the name. A tree with no nodes SHALL render
the `empty` part and keep the tree element as the single Tab stop.

#### Scenario: Set metadata for a nested node

- **WHEN** "index.ts" is the second of three children of "src", which is the first of two
  roots
- **THEN** it has `aria-level="2"`, `aria-posinset="2"`, `aria-setsize="3"`

#### Scenario: Leaf has no aria-expanded (headless-tree#171)

- **WHEN** a tree renders a leaf, a collapsed branch and an expanded branch
- **THEN** the leaf has no `aria-expanded`, the others have `"false"` and `"true"`

#### Scenario: Empty or unloaded branch is still a branch (react-spectrum#10659)

- **WHEN** a node is declared a branch with `isBranch` but has no children, loaded or not
- **THEN** it carries `aria-expanded="false"` and can be expanded

#### Scenario: Unnamed tree (react-arborist#325)

- **WHEN** a tree is rendered without a Label, `aria-label` or `aria-labelledby`
- **THEN** a development warning names the tree

### Requirement: No Interactive Content In Items

An item SHALL NOT contain focusable or interactive elements. The expand indicator and the
checkbox indicator SHALL be presentational: they SHALL carry no role and no `tabIndex`,
SHALL be `aria-hidden`, and their pointer handling SHALL be on the item. In development,
a focusable descendant of an item SHALL produce a warning that points to Grid List and
Table. Non-interactive descendants with their own role (an image with a label) SHALL be
allowed.

#### Scenario: Chevron is not a tab stop (react-spectrum#8111)

- **WHEN** a tree with non-selectable branches is tabbed through
- **THEN** one Tab enters the tree on a row and the next Tab leaves it

#### Scenario: Button inside an item

- **WHEN** an item contains a `<button>`
- **THEN** a development warning names the item and the element

### Requirement: Expansion

Expanded keys SHALL be a controllable value (`expandedValue`, `defaultExpandedValue`,
`onExpandedChange`) over branch keys only; there SHALL be no `"all"` sentinel. The tree
SHALL expose `expandAll()` and `collapseAll()` actions. ArrowRight on a collapsed branch
expands it and keeps the highlight; on an expanded branch it moves to the first child; on
a leaf or on an expanded branch whose children are not rendered yet it does nothing.
ArrowLeft on an expanded branch collapses it; on a leaf or collapsed branch it moves to the
parent; on a root leaf or collapsed root it does nothing. Both are mirrored under
`dir="rtl"`. `*` SHALL expand every collapsed branch among the focused item's siblings.
Press on the `item-indicator` SHALL toggle expansion without moving DOM focus away from the
highlighted row and without changing the selection. A press on the item itself SHALL toggle
expansion of a branch when `expandOnClick` is true (default), unless a modifier key or the
selection model consumes it. Expanded keys that do not exist in the collection SHALL be
ignored.

#### Scenario: Right then Right

- **WHEN** "src" is collapsed and highlighted and the user presses ArrowRight twice
- **THEN** the first press expands it with "src" still highlighted, the second highlights
  its first child

#### Scenario: Left climbs to the parent (react-spectrum#9546)

- **WHEN** a leaf "a.ts" inside "src" is highlighted and the user presses ArrowLeft, then
  ArrowLeft again
- **THEN** "src" is highlighted, then "src" collapses

#### Scenario: Siblings (APG)

- **WHEN** `*` is pressed on a root among three collapsed root branches
- **THEN** all three are expanded and the highlight does not move

#### Scenario: Controlled expansion needs one click (react-spectrum#8263)

- **WHEN** a parent controls `expandedValue` and the user clicks a collapsed branch once
  right after load
- **THEN** `onExpandedChange` is called once and the branch is expanded, and the item
  element is the same DOM node before and after

#### Scenario: Chevron click keeps focus on the row

- **WHEN** the user clicks the indicator of a branch whose row is highlighted
- **THEN** the branch toggles, DOM focus is still on the row and the selection is unchanged

#### Scenario: Expanding yields navigable children (react-spectrum#1525)

- **WHEN** an uncontrolled branch is expanded and the user presses ArrowDown on it
- **THEN** its first child is highlighted

### Requirement: Focus And Tab Stop

The tree SHALL use the collections `roving` strategy over the visible items and be exactly
one Tab stop, with the Tab stop, "first selected" and repair rules over the visible
collection (nearest visible ancestor as fallback) owned by `collection-navigation` ("Exactly
One Tab Stop", "Repair When The Collection Changes"); this capability does not restate them.
`loop` SHALL default to `false`. The tree element SHALL be focusable only while
it has no visible item. Clicking blank space inside the tree SHALL highlight the current
item or do nothing, and SHALL NOT focus the tree element when items exist.

#### Scenario: Selected node under a collapsed parent (zag#1751, zag#1874)

- **WHEN** "a.ts" is selected, its parent "src" is collapsed, and the user Tabs away and
  Shift+Tabs back
- **THEN** focus lands on "src"

#### Scenario: Initial focus ignores hidden selection (react-spectrum#10645)

- **WHEN** a tree is rendered with `autoFocus` and the selected key is inside a collapsed
  branch
- **THEN** a visible row is focused (the selected key's nearest visible ancestor) and the
  first ArrowDown moves to the row below it, skipping none

#### Scenario: Collapse removes the highlight's row

- **WHEN** the highlighted child's parent is collapsed by a controlled `expandedValue`
  change from outside
- **THEN** the parent is highlighted and focused

#### Scenario: Blank space (react-arborist#233)

- **WHEN** the user clicks empty space below the last row and presses Shift
- **THEN** the tree element is not focused and nothing is selected

#### Scenario: No wrap in multiple mode (zag#2028)

- **WHEN** Shift+ArrowDown is pressed on the last visible item of a multiple-selection tree
- **THEN** the highlight and selection do not change

### Requirement: Keyboard Map

The tree SHALL map, through the keyboard module (logical keys, exact modifier sets, RTL):
ArrowDown/ArrowUp → next/previous visible item; Home/End → first/last visible item;
ArrowRight/ArrowLeft → expand/collapse moves; `*` → expand siblings; Space → selection
toggle (or check toggle in a checkable tree), and typeahead continuation while a query is
active; Enter → activation (see Activation); Shift+ArrowDown/Up in `multiple` mode →
move and extend; Shift+Space → select the range from the anchor; Ctrl/⌘+A → select all
visible selectable items in `multiple` mode; printable characters → typeahead over the
text values of the **visible** items. Every key the tree acts on SHALL have its default
prevented. A key not in the map, a key combined with an unmapped modifier, and any event
whose target is an editable element (`input`, `textarea`, `select`, contenteditable) or
inside one SHALL NOT be handled and SHALL NOT have its default prevented, so a consumer's
F2, Delete or clipboard handler on the tree or an inline input in an item works.

#### Scenario: Consumer key bubbles (Reado FileTree)

- **WHEN** F2 is pressed on a focused item and the consumer has an `onKeyDown` on the tree
- **THEN** the consumer's handler runs, the event is not default-prevented by the tree,
  and navigation still works afterwards (contrast zag#2760)

#### Scenario: Typing in an inline input (react-spectrum#7552, zag#1627)

- **WHEN** an item contains a text input, the user focuses it and types "a b"
- **THEN** every character, including the space, reaches the input; the highlight and
  selection do not change

#### Scenario: Typeahead over visible nodes

- **WHEN** "src" is collapsed and contains "server.ts", and the user types "se"
- **THEN** only visible items match; "server.ts" is not highlighted

#### Scenario: Home does not scroll the page (react-spectrum#10720)

- **WHEN** End is pressed in a tree on a long page
- **THEN** the last visible item is highlighted and the page does not scroll

#### Scenario: Select all is visible nodes

- **WHEN** Ctrl+A is pressed in a multiple tree with a collapsed branch of three files
- **THEN** only visible selectable items are selected and `onValueChange` receives an
  explicit key list, never `"all"`

### Requirement: Activation

Enter on an item SHALL run, in order: follow its link when it has `href`; call
`onAction(key, details)` when given; select or toggle it when the tree is selectable; else
toggle the expansion of a branch. In a checkable tree Enter SHALL run the action or toggle
expansion and SHALL NOT change the check. Space SHALL NOT call `onAction` (react-spectrum#7372
is a deliberate difference: APG assigns Space to selection). A disabled item SHALL do none
of these.

#### Scenario: Enter on a branch with no action

- **WHEN** a non-selectable tree has a collapsed branch highlighted and Enter is pressed
- **THEN** the branch expands

#### Scenario: Enter selects in a selectable tree

- **WHEN** a single-selection tree has a leaf highlighted and Enter is pressed
- **THEN** it becomes the selection and `onAction` (when given) is called first

### Requirement: Selection

The tree SHALL support `selectionMode` `none`, `single` and `multiple` (default `single`)
and `selectionBehavior` `toggle` (default) or `replace` (selection follows keyboard focus,
mod+press toggles, Shift ranges over visible order), with the rules of `selection-model`
and `add-listbox`. Selectable items SHALL carry explicit `aria-selected`. Ranges SHALL be
computed over the visible items. Selection SHALL survive collapse: collapsing a branch
SHALL NOT deselect hidden descendants. Single mode SHALL never hold more than one key,
including through a controlled `value` and the programmatic `select` action (zag#1787).
The `value` shapes are `string | null` (single) and `string[]` (multiple), with set
equality in the controllable. `onValueChange` details carry the reason and the key.

#### Scenario: Collapse keeps selection

- **WHEN** a child is selected and its parent is collapsed
- **THEN** `value` is unchanged and the parent has no `aria-selected` change

#### Scenario: Programmatic select in single mode (zag#1787)

- **WHEN** `select("b")` is called while "a" is selected in a single tree
- **THEN** `value` is exactly `"b"`

#### Scenario: Windows multi-select (react-arborist#303)

- **WHEN** Ctrl+click is used on Windows in a multiple `replace` tree
- **THEN** the item toggles; on macOS ⌘+click does

#### Scenario: Branch press selects and expands (ark#2976)

- **WHEN** a branch is clicked in a single tree with `expandOnClick`
- **THEN** it becomes selected and toggles expansion once

### Requirement: Checkable Trees

With `checkable`, each item SHALL carry `aria-checked` `"true"`, `"false"` or `"mixed"` and
NO `aria-selected`; `selectionMode` SHALL be `none` (a development error otherwise);
`aria-multiselectable` SHALL NOT be set. Space and a press on the `item-checkbox` SHALL
toggle the check. `checkedValue` (`defaultCheckedValue`, `onCheckedChange`) SHALL be a
controllable `string[]`. With `checkPropagation` `"both"` (default) the state of a branch
SHALL be derived from its leaves: `"true"` when every enabled descendant leaf is checked,
`"false"` when none is, `"mixed"` otherwise; toggling a branch SHALL set or clear all its
enabled descendant leaves; and `checkedValue` SHALL contain leaf keys only, except that a
branch whose children are not loaded counts as a leaf. Disabled descendants SHALL keep
their state and be ignored by a branch toggle. With `"none"` each key is independent.
`onCheckedChange` SHALL be called once per user action.

#### Scenario: Mixed in both directions (reka-ui#1458)

- **WHEN** one of two children of "src" is checked first, then (separately) the parent is
  checked and one child is unchecked
- **THEN** in both sequences "src" is `"mixed"` while exactly one child is checked

#### Scenario: Branch toggle checks leaves only (react-spectrum#6589)

- **WHEN** a branch with three leaves is toggled
- **THEN** `checkedValue` holds the three leaf keys and not the branch key

#### Scenario: Disabled leaf

- **WHEN** a branch has an unchecked, disabled leaf and two enabled leaves and is toggled
- **THEN** the two enabled leaves become checked and the branch is `"mixed"`

#### Scenario: Unloaded branch counts as a leaf

- **WHEN** an unloaded branch is checked and its children later arrive
- **THEN** the branch key is in `checkedValue` and its children show `"true"`

#### Scenario: Not both attributes

- **WHEN** a checkable tree is rendered
- **THEN** no item carries `aria-selected`

### Requirement: Lazy Children

A node with `hasChildren` and no children SHALL call `onLoadChildren(key, { signal })` once
when first expanded, until children arrive in a new collection or the loader settles with
an error. While loading, the branch SHALL carry `aria-busy="true"` and `data-loading`, the
`loading` part SHALL render under it, and a polite announcement "Loading {name}" SHALL be
made; on arrival, the announcement "{n} items loaded in {name}" SHALL be made. When
`onLoadChildren` returns a promise that rejects, the branch SHALL carry `data-error`,
loading SHALL end, and the next expand request SHALL call the loader again. Collapsing or
unmounting while loading SHALL abort the `signal`. Loading rows SHALL NOT be items. A
loaded branch with no children SHALL remain a branch.

#### Scenario: Twice expanded, once requested

- **WHEN** a lazy branch is expanded twice (expand, expand again) before children arrive
- **THEN** the loader is called once

#### Scenario: Collapse aborts

- **WHEN** a lazy branch is collapsed while its load is pending
- **THEN** the pending `signal` is aborted and `aria-busy` is removed

#### Scenario: Failure then retry

- **WHEN** the loader rejects and the user presses ArrowRight on the branch again
- **THEN** `data-error` is set after the first failure, and the loader is called a
  second time

#### Scenario: Busy is announced

- **WHEN** a lazy branch finishes loading three children with focus on the branch
- **THEN** the recording announcer received "Loading src" and "3 items loaded in src"

### Requirement: Links

An item with `href` SHALL render a native `<a role="treeitem">` through the shared
link-navigation capability (router, modifier clicks, `current`): Enter and press follow the
link and SHALL NOT be default-prevented by the tree; the context menu and middle click
SHALL work. `current` SHALL emit `aria-current` and `data-current`. A link item is
activated, not selected, by press and Enter; Space SHALL still select or check it.

#### Scenario: Right click (react-spectrum#7985)

- **WHEN** a link item is right-clicked
- **THEN** the browser's link context menu applies (the element is an anchor with `href`)

#### Scenario: Current page

- **WHEN** an item has `current="page"`
- **THEN** it has `aria-current="page"` and `data-current`

### Requirement: Disabled Items

A disabled item SHALL carry `aria-disabled="true"` and `data-disabled`, SHALL NOT be
selected, checked, expanded, collapsed or activated by the user, and SHALL be skipped by
navigation unless `focusableWhenDisabled`, in which case it stays highlightable. Disabling
a branch SHALL NOT disable its descendants.

#### Scenario: Disabled branch with enabled children

- **WHEN** a disabled branch is expanded by the consumer
- **THEN** its children remain navigable and selectable

### Requirement: Keys Are Strings

Keys `"0"` and `""` SHALL be valid and SHALL never be dropped or treated as absent
(react-spectrum#9991).

#### Scenario: Zero key

- **WHEN** a tree has an item with key `"0"`
- **THEN** it renders, can be highlighted and selected

### Requirement: Collection Changes

Filtering a tree collection SHALL keep ancestors of matching nodes as branches (with
`children` retained even when empty) so `aria-expanded` and expandability survive
(zag#2582, react-spectrum#10664). The highlight SHALL repair per collections when its
node disappears. A constant-cost highlight move in large trees is specified by the change
`tree-view-virtualization`.

#### Scenario: Filter keeps ancestors

- **WHEN** a tree is filtered to "index.ts" inside "src/app"
- **THEN** "src" and "app" remain as expanded-able branches above it

### Requirement: Virtualization

`aria-level`, `aria-setsize` and `aria-posinset` SHALL come from the tree data (the node's
depth and its position among its siblings), not from the rendered rows. Virtualized rendering
(only the rows near the viewport in the DOM, scroll-to-index, stable ids across expand and
collapse) is specified by the change `tree-view-virtualization`.

#### Scenario: Metadata from the data

- **WHEN** "index.ts" is the second of three children of "src" and is rendered
- **THEN** it has `aria-posinset="2"` and `aria-setsize="3"` from the tree data

### Requirement: Right To Left

Under `dir="rtl"` ArrowLeft and ArrowRight SHALL swap their expand and collapse roles and
the indicator SHALL mirror via the theme.

#### Scenario: RTL expand

- **WHEN** ArrowLeft is pressed on a collapsed branch under `dir="rtl"`
- **THEN** it expands

### Requirement: Messages

User-visible and spoken strings SHALL come from the messages module with defaults:
`loadingAnnouncement(name)`, `loadedAnnouncement(name, count)` (plural),
`loadFailedAnnouncement(name)`, `emptyLabel`, and the label of the tree when none is given
SHALL NOT have a default.

#### Scenario: Translated announcement

- **WHEN** the consumer supplies `loadedAnnouncement` in another locale
- **THEN** the announcer receives that text

### Requirement: Tree View Data Attributes

Every part SHALL carry `data-scope="tree-view"`, `data-part` and `data-instance`.
Beyond the collection part attributes:

- `tree`: `data-selection-mode`, `data-checkable`, `data-empty`, `data-focus`,
  `data-focus-visible`, `data-disabled`.
- `item`: `data-key`, `data-level`, `data-branch` (branches), `data-state` (`open` |
  `closed`, branches), `data-expanded`, `data-selected`, `data-checked`,
  `data-indeterminate`, `data-current`, `data-highlighted`, `data-disabled`,
  `data-loading`, `data-error`, `data-focus-visible`, `data-hover`, `data-pressed`; plus the
  custom property `--rind-tree-view-level` (the level number).
- `item-indicator`: `data-state`, `data-loading`, `data-disabled`.
- `item-checkbox`: `data-state` (`checked` | `unchecked` | `indeterminate`).
- `loading`, `empty`, `label`, `item-text`: scoping attributes only.

#### Scenario: Styling an open branch

- **WHEN** a branch is expanded and highlighted by keyboard
- **THEN** its element has `data-branch`, `data-state="open"`, `data-expanded`,
  `data-highlighted` and `data-focus-visible`

### Requirement: Tree View Contract

The `tree-view` contract SHALL locate an instance by role `tree` and exact accessible name,
include the collection contract fragment with item role `treeitem`, strategy `roving`, and
declare the traits `composite-roving`, `selectable` (unless selection is `none` or
the tree is checkable), `set-metadata` (always). It SHALL NOT use the `disclosure` trait (which belongs to the archived
model-based-testing capability and requires a controlled element); it SHALL ship its own
per-item invariant instead: `aria-expanded` is present on branches only and mirrors the
expansion state. Items SHALL be addressable by accessible
name or by a name path (`["src", "index.ts"]`) because names repeat across folders. It
SHALL declare the actions `expand(item)`, `collapse(item)`, `toggle(item)`,
`check(item)`, `expandSiblings(item)`, `act(item)` and `expandAll()`, and the queries
`items()` (visible, with level, expanded, selected or checked state), `isExpanded(item)`,
`expandedNames()`, `isBusy(item)` and `isEmpty()`. Every action resolves after its
postcondition; actions on a hidden node expand its ancestors through the keyboard path
first. Programmatic changes SHALL map to `{ skip: reason }`; `$sync:value`,
`$sync:expandedValue` and `$sync:checkedValue` SHALL be prop steps.

#### Scenario: Driver round trip

- **WHEN** a test runs `const t = getTreeView(screen, { name: "Files" })`,
  `await t.expand(["src"])`, `await t.act(["src", "index.ts"])`
- **THEN** each action resolves after its postcondition and `onAction` was observed once

#### Scenario: Own expansion invariant

- **WHEN** a wrapper renders `aria-expanded` on a leaf, or leaves a branch's
  `aria-expanded` out of sync with its expansion
- **THEN** the per-item invariant fails naming the item

#### Scenario: Same test in Playwright

- **WHEN** the same test runs with `page`
- **THEN** it passes unchanged

### Requirement: Model-Based Coverage

`testMachine` over the tree-view contract SHALL cover every transition in every modality
including `virtual`, with props classes single `toggle`, multiple `replace`, `none` with
`onAction`, checkable with propagation `both` and `none`, lazy (resolving, rejecting),
links, disabled items, empty and `dir="rtl"`, combined with the collection argument classes
(including keys `"0"` and `""`), and SHALL pass every generic, accessibility and
collection invariant, plus: an item is a branch iff it has `aria-expanded`; the Tab stop is
a visible item; `aria-level` equals depth + 1.

#### Scenario: Broken variant is caught

- **WHEN** a wrapper leaves the Tab stop on a hidden selected node
- **THEN** the first step after collapse fails naming the node

### Requirement: Theme

The Tree View stylesheet SHALL follow the theme-system convention (`@layer
rind.components`, `:where()` selectors on `data-*`, tier-3 `--rind-tree-view-*` tokens read
with a semantic fallback and never declared, family `collection item`, `data-size`
inherited, `data-tone="danger"`). It SHALL indent from `--rind-tree-view-level`, rotate the
indicator from `data-state` and mirror it in RTL, size rows at least 24px and the indicator
hit area at least 24 by 24 px, never use `display: flex` on the `tree` element, give rows
`min-inline-size: fit-content` so highlight backgrounds span horizontal scroll, and give
highlighted and selected rows a non-colour cue under `forced-colors` and a focus ring drawn
as an `outline`.

#### Scenario: Forced colors

- **WHEN** a selected, highlighted row is captured with `forced-colors: active`
- **THEN** the selection and the focus ring are distinguishable without author colours

