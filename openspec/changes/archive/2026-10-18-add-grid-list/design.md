## Context

See proposal.md and specs/{grid-list,collection-grid}/spec.md. Research, comparison and the
Bug history the scenarios cite: [grid-list.md](../../../docs/research/grid-list.md). Consumed
without restating:

| From | Used for |
|---|---|
| `add-foundations`, `add-a11y-foundations` (archived) | machine runtime, controllables, contracts, drivers, `testMachine`, press/hover/modality, keyboard (logical keys, exact modifiers, RTL, IME), announcer, quirks registry, messages, invariants |
| `add-collections` | list collection, selection model, navigation + repair, typeahead, roving composite, `scrollToIndex`/`persistedKeys`, load-more dedupe, `CollectionLayout`, collection contract fragment, `selectable`/`set-metadata` traits |
| `add-listbox` | value shapes, `act`, `selectOnPressUp` precedent not present there: defined here |
| `add-tag-group` | grid-with-one-cell roles, empty `group`, `locate` role set, `display: contents` rule |
| `add-link` | link activation, `current` |
| `add-checkbox` | native-checkbox semantics (control only) |

## Goals / Non-Goals

**Goals:** a Grid List that never fights its own controls; one place (`collection-grid`)
that decides which element owns which key; spatial navigation only where a layout needs it.

**Why no full 2D navigation:** a row has one cell; the second axis is the row's controls,
linear and ordered. Column-aware moves, headers and cell focus are Table's and Calendar's;
`collection-grid` is written so they add a column axis (child index becomes a column) rather
than replace the model.

**Non-Goals:** the proposal's Non-goals.

## Decisions

### 1. `collection-grid` modules

```
core/collection/grid.ts       child traversal (pure), position model, key ownership predicate
core/env/grid-layout.ts       GridLayout { targetAbove(key), targetBelow(key) } capability
core/dom/grid-layout.ts       measured implementation (item rects by data-key); null on zero rects
core/dom/row-controls.ts      controlsOf(row): item-control elements in document order; dev warning for foreign focusables
```

- `owner(target, row)`: pure function returning `"row" | "control" | "editable" | "nested" |
  "other"` from the event target (editable = input/textarea/select/contenteditable or inside
  one; nested = inside a descendant with role grid/listbox/tree/menu/toolbar). The keymap in
  connect calls it first; this is the single place RA's capture-phase conflicts (#4674,
  #5179, #4928) are decided.
- Child index is a machine context field (`childIndex`), updated by `FOCUS_CHILD` from the
  row's `focusin`; DOM focus is the truth, the machine mirrors it, so a click on a control
  and a keyboard move converge.
- Tab order is computed in connect from `(strategy, childNavigation, highlightedKey)` and
  given to `item-control` through the item context (React context; parts only read it):
  `tabIndex = childNavigation === "tab" && rowIsHighlighted && !disabled ? 0 : -1`.
- Escape: control → row; otherwise unmapped (no clear-selection).
- *Alternative:* a MutationObserver that forces `tabindex=-1` on foreign focusables (fragile,
  hydration-sensitive); an explicit `item-control` part is predictable and typed.

### 2. Machine

```
idle ──FOCUS──► focused ──BLUR──► idle
focused: NAVIGATE · HIGHLIGHT · TYPEAHEAD · SELECT · SELECT_ALL · CLEAR_SELECTION · DESELECT ·
         FOCUS_CHILD · NAVIGATE_CHILD · NAVIGATE_SPATIAL · ACTION
root:    COLLECTION.CHANGE → repairCollection · $sync:value · $reverted
entry(focused): highlightInitial · exit(focused): resetTypeahead
effects(focused): focusHighlighted (roving) · focusChild · announceSelection
```

```ts
type GridListEvent =
  | CollectionEvent
  | { type: "FOCUS"; modality: Modality } | { type: "BLUR" }
  | { type: "FOCUS_CHILD"; key: CollectionKey; index: number }
  | { type: "NAVIGATE_CHILD"; direction: "next" | "previous" | "row" }
  | { type: "NAVIGATE_SPATIAL"; direction: "up" | "down" }
  | { type: "ACTION"; key: CollectionKey; via: "press" | "enter" | "double-press"; modality: Modality }
```

- `selectionMode`, `selectionBehavior`, `childNavigation`, `layout`, `disabledBehavior`,
  `selectOnPressUp` are read-only bound props.
- Press → event mapping (`pressRow`, one action): `hasCheckbox(key)` → action only; else by
  mode/behaviour per spec "Selection And Action". `hasCheckbox` comes from the item registry
  (a checkbox part registers with its item).
- `NAVIGATE_SPATIAL` calls `GridLayout.targetAbove/Below`; null → `navigate next/previous`.
- `announceSelection`: runs after `select*` actions when `quirkActive("webkit-grid-selection-not-announced")`,
  texts from `messages`.
- Context: `CollectionContext` + `childIndex`.

### 3. Connect and parts

- `listProps`: role `grid`/`group`, name, `aria-multiselectable`, `aria-rowcount`/`colcount`
  (virtualized), tab stop only when empty, `data-*`.
- `itemProps(key)`: role `row`, roving tabIndex, `aria-selected`, `aria-disabled`,
  `aria-rowindex`, set metadata, `aria-labelledby` → item-text (+ `aria-describedby`),
  keymap through `owner()`, press (hover/pressed), `data-*`.
- `itemCellProps`: `role="gridcell"` (theme: `display: contents` allowed on the cell only).
- `itemCheckboxProps(key)`: native checkbox, `checked`, `onChange` → `SELECT` (toggle),
  `aria-labelledby` = own id + text id, control tab order, press does not reach the row.
- `itemControlProps(key)`: tab order, inherited disabled, `data-part="item-control"`,
  pointer-down stops row press via the `owner()` rule (no `stopPropagation` dependency).
- React: `createGridListParts(useView)`, dev warnings (unnamed list, foreign focusable,
  `Empty` outside `List`), selection counts for select-all.

### 4. Value shapes, links, loading

As add-listbox §3 (no `"all"` unless select all: reported as an explicit list when
virtualized, never the sentinel, so consumers need no collection to read it). Links: row
`href` runs link-navigation's activation helper (request 1). `load-more` is a `row >
gridcell` sentinel part reusing the collections sentinel effect (observer root = nearest
scroll container else viewport).

### 5. Quirk entry and messages

Entry `webkit-grid-selection-not-announced`, specified as an `a11y-quirks` delta in this change (`specs/a11y-quirks/spec.md`). Messages: `selectedAnnouncement(name)`,
`deselectedAnnouncement(name)`, `selectedCountAnnouncement(n)`, `checkboxLabel(name)` ("Select {name}").

### 6. Contract

```ts
export const gridListContract = contract(gridListMachine, {
  scope: "grid-list",
  locate: { role: ["grid", "group"], name: true },
  ...collectionContract({ itemRole: "row", strategy: "roving", select: "both" }),
  traits: ({ props }) => ["composite-roving", "row-children",
    ...(props.selectionMode === "none" ? [] : ["selectable"] as const),
    ...(props.layout === "grid" ? ["directional"] as const : []),
    ...(props.virtualized ? ["set-metadata"] as const : [])],
  announcements: { selectionAnnouncement },
  actions: { act, select, check, focusControl, pressControl },
  queries: { rows, controls, isEmpty, selectionMode },
  events: { FOCUS_CHILD: { skip: "mirrors DOM focus; covered by focusControl" }, /* rest mapped */ },
})
```

`row-children` is a new trait in `@rind-ui/testing` (owned here): see spec. It needs
`composite-roving`'s "exactly one tab stop" check to ignore `item-control` elements in
`tab` mode (request 3).

### 7. Theme

`packages/theme/src/grid-list.css`: `--rind-grid-list-bg`, `-gap`, `-columns` (grid layout
template), `-item-min-height` (≥ 24px), `-item-padding`, `-item-radius`, `-item-border`,
`-item-hover-bg`, `-item-highlight-bg`, `-item-selected-bg`, `-item-selected-text`,
`-item-disabled-text`, `-description-text`, `-checkbox-size`, `-empty-text`; family
`collection item`; no `display: contents` on list or row.

## Risks / Trade-offs

- [Two child-navigation behaviours double the test matrix] → both are model-tested props
  classes; `arrow` is default (APG), `tab` for text fields.
- [`item-control` is explicit] → consumers must wrap controls; the dev warning and docs say
  how, and it is the price of no DOM-observer magic.
- [Announcement may double-speak on future VoiceOver] → quirk entry with removal condition
  and yearly re-test.
- [Spatial moves depend on measurement] → documented fallback; browser-mode tests.
- [No wrap from last control to row (RA wraps)] → deliberate, matches the APG layout grid.

## Migration Plan

New API. React Aria: `GridList`/`GridListItem` → `GridList.Root`/`List`/`Item`;
`Checkbox slot="selection"` → `GridList.ItemCheckbox`; `Button` → `GridList.ItemControl
render={<Button/>}`; `keyboardNavigationBehavior` → `childNavigation`; `renderEmptyState` →
`GridList.Empty`; `escapeKeyBehavior` has no equivalent; `onAction` unchanged. Reado: no use
today; future row-with-actions lists use this instead of `role="listbox"`.

## Requests to other changes

1. **APPLIED (coordinator, 2026-10-15)** **`add-link`** (`link-navigation`): expose the temporary-anchor activation routine
   (modifier keys, router, `target`) as a function usable by parts that must keep their own
   role (`row`, `treeitem`), separately from the `role="link"` non-anchor fallback props.
   Tree View already uses the native `<a>` path and needs no change.
2. **APPLIED (coordinator, 2026-10-15)** **`add-a11y-foundations`** (archived capability `a11y-quirks`, new change needed): add
   entry `webkit-grid-selection-not-announced` — active on Apple platforms with the WebKit
   engine; links WebKit bug 235068 (selected row state not announced) and RA's
   `useGridSelectionAnnouncement`; test path; removal condition "VoiceOver speaks
   `aria-selected` changes on grid rows"; affects `announcement-parity`.
3. **APPLIED (coordinator, 2026-10-15)** **`add-collections`** (`collection-testing`, trait `composite-roving`): its "exactly one
   tab stop" check SHALL ignore elements with `data-part="item-control"` (they are part of
   the row's tab group in `tab` mode). Specified here as the `row-children` trait's counterpart.
4. **APPLIED (coordinator, 2026-10-15)** **`add-collections`** (`collection-navigation` "Logical Moves"): informational — the
   `Move` union stays closed; spatial moves use their own event (`NAVIGATE_SPATIAL`) owned by
   `collection-grid`. No action needed unless collections prefers to absorb the event.

## Handoff (2026-10-18, after #144 merged)

- State: Grid List merged (#144): collection-grid, machine, connect, contract + driver, React parts, theme, nine site examples, ARIA snapshots, docs; review fixes in; quirk A.1 done.
- Open tasks: 0.2 / 9.2 manual AT (deferred), 3.1 / 6.3 virtualization, 4.3 React Strict/SSR/nested tests, 6.4 virtual screen reader, 9.3 / 9.4 status and archive.
- Backlog: rows `add-grid-list` in docs/review-backlog.md (virtualization, GridLayout capability, labelledby without ItemText, warn once, stale pressedDown entry).
- Next step: decide whether 3.1 / 4.3 / 6.3 / 6.4 block archiving; if not, set Grid List `done` in docs/components.md and archive `add-grid-list`.
- Worktree rind-ui-impl3-gl removed; branch grid-list merged.
