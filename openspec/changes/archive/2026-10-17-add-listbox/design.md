## Context

See proposal.md for motivation and specs/listbox/spec.md for behaviour. Research and the
Bug history the scenarios cite: [listbox.md](../../../docs/research/listbox.md). This
change consumes, without restating:

| From | Used for |
|---|---|
| `add-foundations` | `setup()`/`machine()`, `controllable()` (`value`), `bindProp()` (`selectionMode`, `selectionBehavior`, `orientation` read by guards), contracts (`{ skip }`, prop steps), drivers, `testMachine`, React adapter |
| `add-a11y-foundations` | `core/dom/press` (item presses, `virtual`/`touch` modality, double press for actions), `core/dom/keyboard` (logical keys, RTL, platform `mod`, IME guard), `data-focus(-visible)`, messages, invariants |
| `add-collections` | `Collection`, static item registration, `collectionActions`/`Guards`/`Effects`, `select()` with modality/shift/mod, `selectAll`, navigation + repair, typeahead, roving composite props, `scrollToIndex`/`persistedKeys`, load-more dedupe, collection contract fragment, `selectable`/`set-metadata` traits, the `listbox` reference fixture (this change turns it into the public component) |

## Goals / Non-Goals

**Goals:**
- The public Listbox is the collections reference fixture made public, plus behaviours,
  actions and parts — no second navigation or selection implementation.
- The listbox parts are a module Select imports; Select's spec adds only popup rules.

**Non-Goals:**
- Active-descendant, filter input, grid layout, drag and drop (proposal Non-goals).

## Decisions

### 1. Machine

```
idle ──FOCUS──► focused ──BLUR──► idle
focused:  NAVIGATE · HIGHLIGHT · TYPEAHEAD · SELECT · SELECT_ALL · CLEAR_SELECTION · ACTION
root:     COLLECTION.CHANGE → repairCollection · $sync:value · $reverted
entry(focused): highlightInitial (last highlighted, else first selected, else first)
exit(focused):  resetTypeahead
effects(focused): focusHighlighted (roving)
```

```ts
type ListboxEvent =
  | CollectionEvent                                   // add-collections design §5
  | { type: "FOCUS" } | { type: "BLUR" }
  | { type: "ACTION"; key: CollectionKey; modality: Modality; via: "press" | "enter" | "double-press" }
```

- Behaviour, mode and orientation are read-only props bound with `bindProp`, so guards
  read them and the graph stays one flat definition; model tests run it once per props
  class.
- `NAVIGATE` in `replace` behaviour without `mod` runs `navigate` then `select` with
  `{ modality: "keyboard", shift, mod: false }` — the "selection follows focus" rule is
  one guard (`followsFocus`) on the existing event, not a new state. Because a screen
  reader focus produces `FOCUS`/`HIGHLIGHT { source: "programmatic" }` and never
  `NAVIGATE`, rule 13 holds by construction.
- `SHIFT_SPACE` is not a new event: connect maps Shift+Space to `SELECT { shift: true }`
  on the highlighted key.
- No `POINTER_MOVE` handling: a standalone list does not highlight on hover (spec Pointer
  Selection); the fragment leaves it to popup components (Select).
- Escape is not mapped (spec Escape).

### 2. The reusable listbox fragment and parts

```ts
// core/components/listbox/listbox.parts.ts
export interface ListboxPartsView {            // what a host component's connect supplies
  scope: string; ids: Ids; collection: Collection<unknown>
  highlightedKey: CollectionKey | null; isSelected(key): boolean
  selectionMode: "single" | "multiple" | "none"; orientation: Orientation
  disabled: boolean; loading: LoadingStatus; virtualized: boolean
  send(event: ListboxEvent): void
}
export function listProps(v: ListboxPartsView, consumer: NameProps): PartProps
export function itemProps(v: ListboxPartsView, key: CollectionKey): PartProps
export function itemTextProps / itemDescriptionProps / itemIndicatorProps / sectionProps /
  sectionLabelProps / separatorProps / emptyProps / loadMoreProps
export const listboxKeymap: KeyMap<ListboxEvent>  // logical key + modifiers → event
export const listboxMachinePieces = { events, guards: { followsFocus, canAct }, actions: { act } }
```

- `listbox.connect.ts` calls these with `scope: "listbox"`; `select.connect.ts` calls them
  with `scope: "select"`. Both machines spread `collectionActions` and
  `listboxMachinePieces` into `setup()`. The listbox `separatorProps` part delegates to
  add-separator's `separatorProps({ context: "listbox", scope })` (`role="none"`, keeps
  `data-orientation`): `separator` is not an allowed child of `listbox`. Combobox later uses the same parts with
  `strategy: "active-descendant"` (the composite module already supports it).
- React: `packages/react/src/listbox/parts.tsx` exports `createListboxParts(useView)`;
  `Listbox.*` and `Select.Item`/`Select.ItemText`/… are instances bound to their own
  context. No behaviour in the parts.
- *Alternatives:* Select embeds a Listbox service (two services for one popup, focus and
  selection split across them, nothing gained because Select's selection is the same
  controllable); Select re-implements options (the duplication this change exists to
  avoid).

### 3. Value shapes

Single: `string | null` ↔ a set of 0–1 keys. Multiple: `string[] | "all"` ↔
`SelectionValue`. The `equal` of the controllable compares sets, so a parent passing a
new array with the same keys is not a change (collections RA#7947). `onValueChange`
details: `{ reason: "SELECT" | "SELECT_ALL" | "CLEAR_SELECTION" | "NAVIGATE" | "TYPEAHEAD",
key }`.

### 4. Option names and descriptions

Name from content; `item-description` gets an id, `aria-hidden="true"`, and is added to
the option's `aria-describedby` while mounted (part registry, same mechanism as
control-label's Description). Development warnings (missing text value for non-text
content, interactive descendants, unnamed list) are emitted from the React adapter's
dev-only checks after commit.

### 5. Empty and loading

The root renders `empty` after `list` (the part may be placed by the consumer, but the
React `Listbox.Empty` asserts in development that it is not inside `List`). The list's
`aria-describedby` merges the empty id while empty. `load-more` reuses the collections
sentinel effect.

### 6. Contract

```ts
export const listboxContract = contract(listboxMachine, {
  scope: "listbox",
  locate: { role: "listbox", name: true, part: "list" },
  ...collectionContract({ itemRole: "option", strategy: "roving", select: "both" }),
  traits: ({ props }) => ["composite-roving",
    ...(props.selectionMode === "none" ? [] : ["selectable"] as const),
    ...(props.virtualized ? ["set-metadata"] as const : []),
    ...(props.orientation === "horizontal" ? ["directional"] as const : [])],
  actions: { act },
  queries: { isEmpty, selectionMode },
  events: {
    ACTION: "act", FOCUS: { skip: "covered by every keyboard step" }, BLUR: { skip: "tab out; driver test" },
    "$sync:value": { props: (value) => ({ value }) },
  },
})
```

### 7. Theme

`packages/theme/src/listbox.css` reads tier-3 tokens only (decision 0007, after
`add-theme-system`): `--rind-listbox-bg`, `-border`, `-radius`, `-padding`, `-gap`,
`-item-height` (≥ 24px), `-item-padding`, `-item-radius`, `-item-highlight-bg`,
`-item-highlight-text`, `-item-selected-bg`, `-item-selected-text`, `-item-disabled-text`,
`-description-text`, `-section-label-text`, `-separator`, `-indicator-size`,
`-empty-text`, each defaulting to a semantic token. Select's stylesheet reuses the item
rules by selecting on `[data-part="item"]` under either scope through shared tokens
(`--rind-select-item-*` default to `--rind-listbox-item-*`).

## Risks / Trade-offs

- [`"all"` in the public multiple value complicates consumers] → only produced by select
  all; typed, documented with a helper `isAllSelected(value)`; collections decided it.
- [`aria-hidden` description read via `aria-describedby` may be skipped by an AT] → in
  the manual protocol (VO macOS/iOS, NVDA, TalkBack); the fallback is a one-attribute
  change in `itemDescriptionProps`.
- [Selection follows focus can surprise in long lists] → opt-in (`replace`), default
  `toggle`.
- [Converting the internal fixture into a public component may drift from add-collections'
  fixture tasks] → the fixture stays the collections test bed; the component imports the
  same pieces and has its own tests.

## Migration Plan

New API. Reado: `SemanticModal` becomes `<Listbox.Root selectionMode="none" onAction>`,
its status/empty paragraphs move to `Listbox.Empty` or outside the list, rows become
`Listbox.Item` (no nested `<button>`), and the `cursor` state is removed (the highlight
replaces it).
