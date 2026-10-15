## Context

See proposal.md and specs/tree-view/spec.md. Research, library comparison and the Bug
history the scenarios cite: [tree-view.md](../../../docs/research/tree-view.md). This change
consumes, without restating:

| From | Used for |
|---|---|
| `add-foundations` (archived) | `setup()`/`machine()`, `controllable()` (`value`, `expandedValue`, `checkedValue`), `bindProp()`, effects, contracts (`{ skip }`, prop steps), drivers, `testMachine`, React adapter |
| `add-a11y-foundations` (archived) | press, hover, modality, keyboard (logical keys, RTL, exact modifiers, IME guard), announcer, quirks registry, messages, invariants |
| `add-collections` | tree collection (`createTreeCollection`, `visible(expandedKeys)`, `hasChildren`), `collectionActions`/`Guards`/`Effects`, `select`, navigation with `expand`/`collapse` moves and repair, typeahead, roving composite, `scrollToIndex`/`persistedKeys`, collection contract fragment, `selectable` / `set-metadata` traits |
| `add-listbox` | selection value shapes and `selectionBehavior` conventions (not the parts) |
| `add-link` | `linkProps` (link-navigation) for `href` items, `current` |
| `add-theme-system` | stylesheet convention, `collection item` family |

## Goals / Non-Goals

**Goals:** the APG tree with a flat, virtualizable DOM; no new navigation or selection
implementation; tri-state checking that is derived, not stored; lazy branches with honest
status; keys that never fight inline editors.

**Non-Goals:** the proposal's Non-goals (interactive items / treegrid, DnD, rename,
static nested JSX, virtualizer).

## Decisions

### 1. Machine

```
idle ──FOCUS──► focused ──BLUR──► idle
focused: NAVIGATE · HIGHLIGHT · TYPEAHEAD · SELECT · SELECT_ALL · CLEAR_SELECTION · DESELECT ·
         EXPAND · COLLAPSE · EXPAND_SIBLINGS · CHECK · ACTION
root:    COLLECTION.CHANGE → repairCollection (+ settle loads) · EXPAND_ALL · COLLAPSE_ALL ·
         CHILDREN.SETTLED · $sync:value · $sync:expandedValue · $sync:checkedValue · $reverted
entry(focused): highlightInitial (last highlighted → selected → first), all over visible items
exit(focused):  resetTypeahead
effects(focused): focusHighlighted (roving) · effects(root): loadChildren (abortable)
```

```ts
type TreeViewEvent =
  | CollectionEvent                                   // add-collections design §5 (EXPAND/COLLAPSE by key)
  | { type: "FOCUS"; modality: Modality } | { type: "BLUR" }
  | { type: "EXPAND_SIBLINGS"; key: CollectionKey } | { type: "EXPAND_ALL" } | { type: "COLLAPSE_ALL" }
  | { type: "CHECK"; key: CollectionKey; via: "space" | "press" | "api" }
  | { type: "ACTION"; key: CollectionKey; via: "enter" | "press"; modality: Modality }
  | { type: "CHILDREN.SETTLED"; key: CollectionKey; ok: boolean }
```

- Visible items are `collection.visible(expandedValue)`, derived in `view` (memoised on
  the two references). Navigation, typeahead, ranges and select-all run on it; selection and
  expansion stay keyed on the whole tree.
- The visible-collection rule (Tab stop, "first selected", repair walk, nearest visible
  ancestor as fallback) is owned by add-collections (`collection-navigation`); this change
  only supplies `collection.visible(expandedValue)` and does not specify it locally. The
  Tab stop and the highlight use the same function, so they can never disagree (zag#1751).
- `activate` (action for `ACTION`): link → `followLink` effect; `onAction`; selectable →
  `select` (collections); else branch → `EXPAND`/`COLLAPSE`. A press on the item maps to
  `ACTION` only when the selection model does not consume it (listbox rule) and expands a
  branch when `expandOnClick`.
- Lazy loading: `expand` on a node with `hasChildren && children empty && status !== loading`
  puts the key in `context.loading` (a set of keys) and starts the `loadChildren` effect,
  which calls `props.onLoadChildren(key, { signal })`, keeps one `AbortController` per key,
  and sends `CHILDREN.SETTLED` when a returned promise settles. A new collection that
  contains children for a loading key also settles it (`COLLECTION.CHANGE` handler), so
  consumers that load without returning a promise work. `COLLAPSE`, unmount and re-keying
  abort. Error keys live in `context.failed`; a later `EXPAND` retries.
- Announcements: `announceLoading`/`announceLoaded`/`announceFailed` through the announcer
  with `messages`; polite, any platform (focus does not move).
- Checking: `check.ts` (pure, node-tested): `stateOf(tree, checked, key)`,
  `toggle(tree, checked, key)`, `normalise(...)`, honoring `isBranch` + loaded children +
  disabled. `checked` holds leaves (unloaded branches count as leaves); branch state is a
  function of leaves. Pure functions are exported for consumers.
- Read-only bound props: `selectionMode`, `selectionBehavior`, `checkable`,
  `checkPropagation`, `expandOnClick`, `focusableWhenDisabled`, `loop` (default false).
- Context: `CollectionContext` + `loading`, `failed`.

### 2. Connect and parts

- `treeProps`: role `tree`, name, `aria-multiselectable`, `tabIndex` only when empty,
  keymap (below), blur/focus handlers, `data-*`.
- `itemProps(key)`: role `treeitem` (`<a>` via `linkProps` when `href`), roving `tabIndex`
  from the visible-aware tab stop, `aria-level/setsize/posinset` from the collection node
  (`level + 1`, sibling count, `index` among siblings), `aria-expanded` iff `isBranch`,
  `aria-selected` or `aria-checked`, `aria-busy`, `aria-disabled`, `aria-current`,
  `aria-labelledby` → item-text id (`aria-label` wins), `style: { "--rind-tree-view-level": level }`.
  Press handling through `core/dom/press`, with `data-pressed`/`data-hover`.
- `itemIndicatorProps`/`itemCheckboxProps`: `aria-hidden`, no role, press handled by the
  item (hit-test on `closest("[data-part=item-indicator]")` in the item's pointer-down, so
  focus never leaves the row: `preventDefault` on pointer-down).
- Keymap (`core/dom/keyboard`, orientation vertical): events as spec; guard: `event.target`
  must be the item or the tree (never an editable descendant); consumer `onKeyDown` runs
  first and may `preventDefault` to cancel.
- Dev checks (React adapter, after commit): unnamed tree, focusable descendant of an item,
  `checkable` with a selection mode.
- React: `createTreeViewParts(useView)`; `TreeView.Tree` takes `children: (node, state) =>
  ReactNode` called per visible node with `{ key, level, posInSet, setSize, isLast,
  parentKey, expanded, selected, checked, loading }` (answers RA#6442/#9758).

### 3. Value shapes

`value`: `string | null` | `string[]` (no `"all"`); `expandedValue`: `string[]`;
`checkedValue`: `string[]`. Sets compared as sets. `onExpandedChange(keys, { reason:
"key" | "press" | "api" | "siblings" | "all" })`; `onCheckedChange(keys, { reason, key })`.

### 4. Contract

```ts
export const treeViewContract = contract(treeViewMachine, {
  scope: "tree-view",
  locate: { role: "tree", name: true, part: "tree" },
  ...collectionContract({ itemRole: "treeitem", strategy: "roving", select: "both" }),
  traits: ({ props }) => ["composite-roving", "set-metadata",
    ...(props.checkable || props.selectionMode === "none" ? [] : ["selectable"] as const)],
  actions: { expand, collapse, toggle, check, expandSiblings, act, expandAll },
  queries: { items, isExpanded, expandedNames, isBusy, isEmpty },
  events: { /* every event mapped to an action, a prop step or { skip: reason } */ },
})
```

Tree View does NOT use the `disclosure` trait: it belongs to the archived model-based-testing
capability and requires a controlled element. Tree View ships its own per-item invariant:
`aria-expanded` is present on branches only and mirrors the expansion state.

### 5. Theme

`packages/theme/src/tree-view.css`: `--rind-tree-view-bg`, `-item-height` (≥ 24px),
`-item-padding`, `-item-radius`, `-indent` (per level), `-gap`, `-item-hover-bg`,
`-item-highlight-bg`, `-item-selected-bg`, `-item-selected-text`, `-item-disabled-text`,
`-current-text`, `-indicator-size`, `-indicator-hit` (≥ 24px), `-checkbox-size`,
`-checkbox-border`, `-checkbox-checked-bg`, `-loading-text`, `-empty-text`, each defaulting
to a semantic token; family `collection item`; indicator rotation and RTL mirror from
`data-state`; no `display: flex` on the tree; rows `min-inline-size: fit-content`.

## Risks / Trade-offs

- [Flat DOM may be announced differently by AT than nested `group`] → unverified; the first
  task is a real-AT prototype (VO macOS/iOS Safari and Chrome, NVDA, JAWS, TalkBack) with both
  shapes behind connect; if flat fails, only connect and parts change.
- [No interactive items] → Reado's "open vs expand nest" and delta-review controls move to
  keys, context menus and the indicator; treegrid rows belong to Table / Grid List.
- [Leaf-only checked values] → documented helper `expandCheckedToBranches(tree, value)`.
- [Select all = visible only] → documented; consumers wanting all use `select` with keys.

## Migration Plan

Reado `FileTree`: `role="tree"` container and `button role=treeitem` rows become
`TreeView.Tree` + `TreeView.Item` over a tree collection built from `listDir` results
(lazy through `onLoadChildren`); `expandedDirs` becomes `expandedValue` (reveal-active-file
= add the ancestor keys from the collection); selection (⌘/⇧ click, `useTreeSelection`)
becomes `selectionMode="multiple" selectionBehavior="replace"`; F2/Delete/cut/copy/paste
stay consumer `onKeyDown` on the tree; the pointer drag stays consumer code on items; the
nested-file twisty and the delta-review control are no longer buttons beside the row: the
twisty is the `item-indicator`, the delta review moves to the context menu and a shortcut.

## Requests to other changes

1. **RESOLVED (coordinator, 2026-10-15)** — no edit to add-collapsible: the `disclosure` trait belongs to the archived model-based-testing capability and requires a controlled element; Tree View does not use it and ships its own per-item invariant (§4). Original request, **`add-collapsible`** (trait `disclosure`): confirm the trait can be checked on an item
   with `aria-expanded` and no controlled element (Tree View branches). Design §4 narrows
   it locally if not.
2. **APPLIED (coordinator, 2026-10-15)** **`add-collections`** (`collection-navigation` "Exactly One Tab Stop", "Repair When The
   Collection Changes"): in trees, "first selected navigable item" and the repair walk SHALL
   consider the visible collection, with the nearest visible ancestor as fallback. This
   change now references that rule instead of specifying it locally (add-collections A.4).
3. **`add-link`** (`link-navigation`): none required; `linkProps` is merged with
   `role="treeitem"` and roving `tabIndex` by connect (the capability emits no role on
   anchors).
