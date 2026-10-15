# Grid List — research

Status: done · Wave: 3

An interactive list: rows that contain focusable controls (a selection checkbox, buttons,
links, a menu trigger, a switch), selectable and actionable as a whole, optionally laid out
as a grid of cards. React Aria's `GridList` is the only library in the matrix that ships it
(components.md: RAC only; "Missing in Ark" although Zag's v2 beta has a `gridlist` machine,
cited by [ZG#3431](https://github.com/chakra-ui/zag/issues/3431)). Keys, selection, repair
and typeahead are [collections.md](collections.md) and `add-collections`; the listbox parts
and their selection rules are `add-listbox`; the wrapped-grid-of-rows precedent is
[tag-group.md](tag-group.md). This note covers what is grid-specific: the two-level
(row, children) focus model that `add-collections` deferred, spatial navigation for a grid
layout, selection checkboxes, actions versus selection, and when to use Listbox instead.
Tree View is the sibling note, [tree-view.md](tree-view.md).

Sources: `react-spectrum` @ `e04377c` — `packages/react-aria/src/gridlist/{useGridList,
useGridListItem,useGridListSelectionCheckbox}.ts`, `packages/react-aria/src/grid/*`,
`packages/react-aria-components/src/GridList.tsx`, docs
[GridList](https://react-aria.adobe.com/GridList.md) (fetched 2026-10-14); APG
[Grid](https://www.w3.org/WAI/ARIA/apg/patterns/grid/) ("Editing and Navigating Inside a
Cell", layout grids) from [accessibility.md](accessibility.md) and the Tag Group note. Bug
history: title scan of `adobe/react-spectrum` (`gh api repos/.../issues`) for `GridList`,
`ListView`, `useGridList`, plus `gh search issues` terms; each cited issue was opened.

## Pattern

- WAI-ARIA APG: [Grid](https://www.w3.org/WAI/ARIA/apg/patterns/grid/), used as a
  **layout grid with one cell per row** (the Tag Group precedent); not the Listbox pattern,
  because `option` children are presentational and may not contain controls
  ([RA#4674](https://github.com/adobe/react-spectrum/issues/4674): "Interactive elements such
  as textfields are not allowed inside a listbox").
- Roles and attributes: `grid` (named; `aria-multiselectable` in multiple mode;
  `aria-rowcount`/`aria-colcount=1` when virtualized) › `row` (focusable; `aria-selected`
  explicit when selectable; `aria-disabled`; `aria-rowindex` when virtualized; named by its
  text) › `gridcell` (one per row, holds the content and controls).
- Keyboard: the grid is one Tab stop; ArrowUp/Down move between rows; Home/End; PageUp/Down;
  typeahead; Space toggles selection; Enter runs the row action; moving into a row's
  controls and out again (APG "navigating inside a cell"); editable controls own their keys.
  RA offers two models, `keyboardNavigationBehavior="arrow"` (default: Left/Right walk the
  row's focusable children) and `"tab"` (Tab walks them; arrows stay inside text fields).

## How the others built it

### React Aria (Components)

- Source: `useGridList.ts`, `useGridListItem.ts`, `useGridListSelectionCheckbox.ts`, RAC
  `GridList.tsx`.
- API: `GridList` (`aria-label` required — `console.warn` otherwise; `items`,
  `selectionMode`, `selectionBehavior`, `onAction`, `layout` `stack` | `grid`, `orientation`,
  `dragAndDropHooks`, `renderEmptyState`, `keyboardNavigationBehavior`, `escapeKeyBehavior`
  (`clearSelection` default), `disabledBehavior`, `shouldSelectOnPressUp`, `autoFocus`,
  `disallowTypeAhead`) › `GridListItem` (`id`, `textValue`, `isDisabled`, `href`, `onAction`;
  `Checkbox slot="selection"`, `Button slot="drag"`); `GridListSection`/`Header` (alpha);
  `GridListLoadMoreItem`.
- State model: `useListState` (shared with ListBox) + `useSelectableList`; the keyboard
  delegate is `ListKeyboardDelegate` (or `GridKeyboardDelegate` with `layout="grid"`);
  `listMap` WeakMap hands per-list options (`onAction`, `linkBehavior`, `keyboardNavigationBehavior`)
  to each item hook.
- Notable: `role=grid` › `row` (the focus target; `aria-label` = textValue,
  `aria-labelledby` = row id + description id) › `gridcell`. Row-level key capture:
  `onKeyDownCapture` handles ArrowUp/Down for the row *even when a child has focus*
  (re-dispatches from the parent) and, in `arrow` mode, ArrowLeft/Right through a
  focusable-tree walker that includes `tabindex=-1` elements, falling back to the row
  at the ends (it wraps). `focusMode="child"` focuses the first tabbable child when the row
  gains focus (used by NavigationTree). In `tab` mode every key from a child except Tab stops
  at the row. Empty list: the grid becomes a Tab stop (`tabIndex 0`, or -1 when the empty
  state contains a tabbable) and RAC renders a `row`/`gridcell` around the empty state.
  Selection checkbox label = `aria-labelledby="<checkbox id> <row id>"`; checkboxes appear
  by convention with `multiple` + `toggle`. `useGridSelectionAnnouncement` announces
  selection changes through the live announcer. Touch: tap runs the action, long-press
  enters toggle mode. `layout="grid"` supports only `tab` navigation ("Only tab navigation is
  supported in grid layout").
- Problems: nested interactive content keeps hitting the capture handlers (space eaten in
  inputs RA#4674/#8112/#8031, nested grids RA#5179, iframe trap RA#4767, stopPropagation on a
  child button ignored RA#4928); row-focus versus cell-focus announcements (RA#2946);
  `display: contents` on the grid breaks Tab handling (RA#9532); virtualization problems
  (RA#3822, #5067, #7041, #9617, #10627); selection versus action conflicts (RA#7962, #9610,
  #9117); disabled rows do not disable their buttons (RA#6323); no `aria-disabled` passthrough
  (RA#10276).

### Zag (v2 beta, not in the clone) and others

- Zag's `gridlist` machine is described in [ZG#3431](https://github.com/chakra-ui/zag/issues/3431)
  as having "role=grid, rows, gridcells, row checkboxes and grid navigation"; the clone read
  here (`055a34f`) does not contain it, so it was not read. Ark ships no Grid List.
- Ariakit's `Composite`/grid and Reka have no list-with-controls component; Ariakit's
  `Composite` row/`CompositeItem` model is the closest ancestor of the two-level focus idea
  (rows contain items) and is not mined here beyond that note.

## Accessibility

Apply [accessibility.md](accessibility.md) and
[assistive-tech-and-a11y-testing.md](assistive-tech-and-a11y-testing.md) ("Tree / grid /
table"). The WebKit grid list in that note applies directly and must be tested on **real
VoiceOver from the first prototype**:

- **Selected row not announced** (WebKit 235068): VoiceOver does not speak a change of
  `aria-selected` on a grid row. RA works around it with a live announcement
  (`useGridSelectionAnnouncement`). Decision: announce selection changes through the
  announcer behind a quirk-registry entry (request to the quirks registry), "{name} selected"
  / "{name} not selected" / "{n} rows selected", so the workaround has a bug link, a test and a
  removal condition.
- **Header/index not announced** (WebKit 236790), **`aria-describedby` on headers ignored**
  (228573): there are no headers in a Grid List (no table semantics); `aria-rowindex` is only
  emitted when virtualized.
- **Navigation breaking while a virtualized grid scrolls** (WebKit 236865): rows are
  reached by DOM focus after `scrollToIndex`; virtualized rows keep stable ids (collections);
  tested in the manual protocol with a virtualized fixture.
- **VO lags behind fast `focus()`** ([RA#7734](https://github.com/adobe/react-spectrum/issues/7734),
  open, reported on a Table, same mechanism): holding an arrow key leaves VO reading the
  previous row. We move DOM focus synchronously and never delay it; the long-run mitigation
  is none known (open question; manual protocol).
- **Name**: the *row* is focused, not the cell, and named by its text part through
  `aria-labelledby` (plus `aria-describedby` for descriptions), so a focused row does not
  read every control inside it (RA#2946: "the contents of the cell is always read out",
  including the drag handle and checkbox label). Checkboxes read "Select <row name>".
- **Roles in an empty list**: a `grid` without rows fails `aria-required-children` (RA#8354,
  Tag Group). An empty Grid List is a `group` with the Empty content, as Tag Group decided.
- **Native checkbox**: the selection control is a native `<input type="checkbox">` (native
  first); NVDA leaves focus mode on checkboxes inside cells (RA#7300, nvda#11413, listed in
  the cross-cutting note) — manual protocol item.
- **Forced colors / target size**: highlighted and selected rows need a non-colour cue under
  `forced-colors`; rows ≥ 24 px, controls inside ≥ 24 × 24 with spacing (WCAG 2.5.8); the
  focus ring on the row is an `outline`. RTL mirrors Left/Right child navigation and the grid
  layout.
- **Native platform** ([native-platform.md](native-platform.md)): none — `<ul>` + buttons has
  no composite keyboard model; `<select multiple>` is a listbox.

## Bug history

"RA" = adobe/react-spectrum (the only tracker with a Grid List).

| Library | Issue | Symptom | Root cause | Fix / status | Lesson for rind-ui |
|---|---|---|---|---|---|
| RA | [#4674](https://github.com/adobe/react-spectrum/issues/4674) closed | Space ignored in an `<input>` inside a ListBox/GridList row | Row handles Space for selection from any descendant | "Not allowed inside a listbox"; GridList has the same bug | Keys from editable targets are never handled by the grid (scenario) |
| RA | [#8112](https://github.com/adobe/react-spectrum/issues/8112) closed, [#8031](https://github.com/adobe/react-spectrum/issues/8031) closed | Space in a TextField in a row swallowed (also with drag and drop) | Capture-phase handler, duplicate of #2328 | Closed as duplicates | Same scenario, incl. with drag and drop on |
| RA | [#2328](https://github.com/adobe/react-spectrum/issues/2328) closed | Need an "edit mode" for cells: Enter enters, Tab cycles inside, Escape leaves, grid keys suspended | APG "editing and navigating inside a cell" unimplemented | Spec'd; `keyboardNavigationBehavior` later | Two-level model: editable control suspends grid keys; Escape returns to the row |
| RA | [#5179](https://github.com/adobe/react-spectrum/issues/5179) open | ArrowUp/Down inside a nested GridList moves the *outer* list | Outer row captures keys in the capture phase | Open: "nested grid roles need more work" | Non-goal nested grids; keys from a nested composite are ignored (scenario) |
| RA | [#4928](https://github.com/adobe/react-spectrum/issues/4928) closed | Clicking a child button that stops propagation still deselects the row | Selection happens on pointerdown, before `onClick` | Explained | Presses that start on an `ItemControl` never select/act the row (scenario) |
| RA | [#6323](https://github.com/adobe/react-spectrum/issues/6323) closed | Buttons inside a disabled row stay pressable | Only checkboxes read the item's disabled state | Fixed via context | `ItemControl` inherits row `disabled` (scenario) |
| RA | [#10276](https://github.com/adobe/react-spectrum/issues/10276) open | `aria-disabled` not emitted for focusable disabled rows | Prop dropped | Open | Disabled rows emit `aria-disabled`; focusable by option |
| RA | [#2946](https://github.com/adobe/react-spectrum/issues/2946) closed | Focus on the cell makes SR read the whole cell (drag handle, checkbox) | Cell focus + no explicit name | Refactor to row focus | Row focus, name from the text part (scenario) |
| RA | [#9532](https://github.com/adobe/react-spectrum/issues/9532) open | `display: contents` on the grid makes Shift+Tab visit every control | Handler assumed a focusable box | Open | Theme never `display: contents` on grid or row; Tab needs no custom handler (scenario) |
| RA | [#4767](https://github.com/adobe/react-spectrum/issues/4767) open | Focus trapped in an `<iframe>` in a row; arrows eaten | Hardcoded focusable list includes iframe | Open | Child traversal covers `ItemControl` only; foreign focusables get a dev warning |
| RA | [#7962](https://github.com/adobe/react-spectrum/issues/7962) open | Row action impossible once any row is selected (toggle mode) | Selection mode swallows presses | Open | With a selection checkbox the row press always runs the action (scenario) |
| RA | [#9610](https://github.com/adobe/react-spectrum/issues/9610) open | Cannot copy text from a row in selection mode; want checkbox-only selection | Whole row toggles | Open | While an `ItemCheckbox` exists the row press never changes the selection (scenario), so text can be selected and copied |
| RA | [#9117](https://github.com/adobe/react-spectrum/issues/9117) closed | `replace` behaviour ignored when clicking the checkbox | Checkbox is an override that always toggles | "Working as intended" | Checkbox always toggles; documented |
| RA | [#8988](https://github.com/adobe/react-spectrum/issues/8988) closed | No hover events when `selectionMode="none"` | Hover only for interactive rows | Hoverable once `onAction` set | `data-hover` on every row (pointer over), independent of mode |
| RA | [#6904](https://github.com/adobe/react-spectrum/issues/6904) closed | Cmd+Shift+Up/Down also triggered Shift+Up/Down range extension | Modifier-agnostic key handler | Fixed in shared `useKeyboard` | Key map matches exact modifier sets (keyboard-interactions) |
| RA | [#10720](https://github.com/adobe/react-spectrum/issues/10720) closed | Home/End/PageUp/PageDown also scroll the page | Missing `preventDefault` | Fixed | Handled keys `preventDefault`; browser test |
| RA | [#3822](https://github.com/adobe/react-spectrum/issues/3822) closed | Virtualized list does not scroll the focused row into view | "The virtualizer handles it" | By design | Virtualized: `scrollToIndex` contract (collections) |
| RA | [#5067](https://github.com/adobe/react-spectrum/issues/5067) closed | Shift-select and Home/End broken with a third-party virtualizer | Collection only knew mounted items | "Virtualization not supported" | Collection is the whole data set; virtualizer only renders (collections) |
| RA | [#7041](https://github.com/adobe/react-spectrum/issues/7041) closed | Tab into a virtualized list scrolls unpredictably | Focus scrolled the wrong target | Fixed (PR 8767) | Focus uses `preventScroll`; scroll only through navigation (collections) |
| RA | [#7076](https://github.com/adobe/react-spectrum/issues/7076) closed, [#7083](https://github.com/adobe/react-spectrum/issues/7083) closed | Shift+click / Cmd+A failed | Item id `0` (falsy) | Reporter's data | Keys `"0"`/`""` valid (test) |
| RA | [#9617](https://github.com/adobe/react-spectrum/issues/9617) closed | Loading indicator row clipped in a virtualized list | Virtualizer sized only items | Partly fixed | `LoadMore` row has a measurable height; counted outside set size |
| RA | [#10627](https://github.com/adobe/react-spectrum/issues/10627) open | Load-more sentinel fires every page when the list scrolls with the page | Observer root = `<html>` | Open | Sentinel observer root is the nearest *scrollport* or the viewport; dedupe per collection (collections) |
| RA | [#4383](https://github.com/adobe/react-spectrum/issues/4383) open | NVDA virtual cursor goes the wrong way after async rows append | Virtual buffer out of sync with appended rows | Open | Append in order, stable ids, `aria-busy` while loading; manual protocol |
| RA | [#7887](https://github.com/adobe/react-spectrum/issues/7887) closed, [#9572](https://github.com/adobe/react-spectrum/issues/9572) closed | Selecting in a GridList in a Popover closed the Modal | Press-down selection + exit animation click-through | `shouldSelectOnPressUp` added | `selectOnPressUp` prop (scenario) |
| RA | [#5279](https://github.com/adobe/react-spectrum/issues/5279) open | Dragged row disables hover/active feedback on its handle | `pointer-events: none` on the row | Open | Drag and drop is a non-goal; reserved `data-dragging` not emitted |
| RA | [#9120](https://github.com/adobe/react-spectrum/issues/9120) closed | `disallowTypeAhead` not passed through | Prop dropped between hooks | Fixed | Typeahead off switch tested end to end |
| RA | [#6801](https://github.com/adobe/react-spectrum/issues/6801) closed | List not updating with suspense queries | Collection builder and duplicate keys | Fixed (reporter keys) | Collections are props; duplicate-key dev error (collections) |
| RA | [#10298](https://github.com/adobe/react-spectrum/issues/10298) closed | Collections empty after `<Activity>` hide/show | Hidden-document collection builder lost subscriptions | Fixed (`queueUpdate`) | No hidden-tree builder; collection from props/registration after commit |
| RA | [#3489](https://github.com/adobe/react-spectrum/issues/3489) open | Scroll container cannot be passed to `useGridList` | Assumes the list scrolls | Open | `scrollParent` resolved by walking up; override option |
| RA | [#7810](https://github.com/adobe/react-spectrum/discussions/7810) discussion | Teams put a GridList in a Popover to get buttons in "options" | Select options cannot hold controls | Workaround | Guidance: Select/Combobox options are text; interactive options = Popover + Grid List, not Select |
| RA | [#7734](https://github.com/adobe/react-spectrum/issues/7734) open | VO announces the previous cell if keys come fast (Table, same mechanism) | AT lags behind synchronous focus | Open | Manual-protocol item; no artificial delay |
| RA | [#6757](https://github.com/adobe/react-spectrum/issues/6757) closed | TagGroup inside a GridList item crashed | Nested collection contexts | Fixed | Nesting test: Tag Group inside an item |
| Zag | [#3431](https://github.com/chakra-ui/zag/issues/3431) closed | Treegrid is "one of the most mistake-prone APG patterns" | No hierarchical grid machine | Closed, v2 pointer | Grid List stays flat; treegrid belongs to Table |

## Known pitfalls

- **Capture-phase key handling over descendants** is the root of RA#4674/#8112/#8031/#5179:
  decide *per target* who owns a key — the row (its own target), an `ItemControl` (arrows
  between controls, ArrowUp/Down to other rows), an editable (everything).
- **Two Tab-stop models** (RA's `arrow` vs `tab`) exist because rows with text fields and rows
  with buttons need opposite things; both are needed.
- **Selection on press-down versus click** (RA#4928, #7887, #9572): decisions that depend on
  whether a child handled the event must be made at the same phase.
- **`display: contents`** on the grid or row (RA#9532, ariakit#7160): never in the theme.
- **Virtualization** needs the whole collection (RA#5067, #3822).
- **Safari/VO**: selected-row announcement missing; lag on fast focus; test early.

## Testing notes

- Props classes: `stack`/`grid` layout; selection none/single/multiple; toggle/replace;
  `arrow`/`tab` child navigation; with/without checkbox; actions; links; disabled rows;
  empty; virtualized; RTL.
- Fixtures: rows with a checkbox + two buttons, a row with a text input (editable), a row with
  a link control, a disabled row with a button, a nested Tag Group, 0/1/many rows, a 3-column
  card layout of 7 rows (last row short).
- Driver: rows by accessible name; `controls(row)` and `focusControl(row, name)`; the model
  checks "exactly one tab stop" with the tab-mode exception (new `row-children` trait).
- Hard to test: real VO behaviour (manual protocol), measured spatial moves (browser mode
  only; jsdom documents the fallback).

## Decisions

- **Role and shape**: `grid` › `row` › `gridcell` (one cell per row, `item-cell`); the row is
  the focus target and the item. Empty → `group`.
- **When Listbox, when Grid List**: use **Listbox** (and Select/Combobox popups) when options
  are text with at most a static description — `option` children are presentational; use
  **Grid List** as soon as a row holds any control (checkbox, button, link, switch, menu
  trigger) or the rows form a card grid. Grid List is not a Select popup. Documented in the
  docs page and as a development warning in Listbox is *not* added (Listbox's existing
  "interactive descendants" warning already points here).
- **Full 2D cell navigation is not needed.** A row has exactly one cell; the second
  dimension is the row's controls, which is linear. The spec therefore adds, as a new
  capability `collection-grid` owned by this change: (1) the **row/child focus model**
  (`rows`, then the controls of the highlighted row, with `arrow` and `tab` navigation
  behaviours), (2) **spatial navigation** for `layout="grid"` (up/down/left/right over a
  measured wrapped layout) and (3) **event ownership per target**. True multi-cell grids
  (Table, Calendar) extend (1) with a column axis later; this change does not specify
  column-aware moves.
- **Controls**: `ItemControl` part marks a control inside a row (tab-order managed, disabled
  inheritance, navigation registration); `ItemCheckbox` is a native checkbox that is an
  `ItemControl`; plain focusables not wrapped get a development warning.
- **Child navigation default**: `arrow` (APG layout-grid behaviour), `tab` available;
  editable controls always own their keys; Escape returns to the row.
- **Selection vs action**: a row with an `ItemCheckbox` (toggle behaviour): selection only by
  the checkbox or Space; row press runs `onAction` if given, else does nothing (RA#7962,
  #9610). Without a checkbox: `toggle` presses toggle, `replace` presses select and Enter /
  double press run the action (listbox rules); touch uses collections' toggle rule.
- **Announcements**: selection changes announced behind a quirk entry; removal not applicable.
- **Links**: row `href` activates through link-navigation (router, modifier clicks); rows stay
  `row`; recommended: an `<a>` as `ItemControl` for native link features.
- **Machine**: states `idle` | `focused`; events = collection events + `FOCUS_CHILD`,
  `NAVIGATE_CHILD`, `NAVIGATE_SPATIAL`, `ACTION`; context adds `childIndex` (0 = the row).
- **`data-*`**: collection item attributes + `data-hover`, `data-pressed`,
  `data-focus-visible-within`, `data-selection-mode`, `data-layout`, `data-empty`,
  `data-child-focused` on a row while a control inside has focus.
- **Contract**: collection fragment (`itemRole: "row"`, roving) + actions `act`, `select`,
  `focusControl`, `pressControl`, `check`; queries `rows()`, `controls(row)`, `isEmpty()`;
  traits `composite-roving`, `selectable`, `directional` (grid layout), `set-metadata`
  (virtualized), new `row-children`.
- **Deliberately different**: row focus + `labelledby` instead of cell focus; empty `group`;
  checkbox press always toggles and row press always acts; no Escape-clears-selection
  (as Listbox); no hidden-document collection builder; no wrap from the last control back
  to the row (RA wraps); drag and drop, sections and nested grids deferred.

## Open questions

- Does VO (Safari) announce row `aria-selected` and our announcer text twice? Needs the
  manual protocol on macOS/iOS; the quirk entry can be narrowed.
- `arrow` versus `tab` default after user testing with rows that mix buttons and inputs.
- Sections (`rowgroup`) and drag and drop reordering: follow-up changes once collections
  covers them.
- Should `layout="grid"` expose a column count for `aria-colcount`? We emit none (cards are
  rows); revisit with Table.
