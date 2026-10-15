## Context

`add-foundations` provides the machine runtime (static definitions, controllables with
`$sync` / `$reverted`, `onProps` events, effects, `after` delays, `view(props)` with
memoised computed values, `inspect`), the injected environment (small capability
interfaces, `domEnvironment()`), contracts and drivers, and the model-based runner with
the `composite-roving` / `composite-activedescendant` traits. `add-a11y-foundations`
(proposed next) provides key normalisation into logical keys, interaction modality,
`Environment.platform` / `locale` / `dir`, the announcer and `messages`. This change
builds on both; the reasoning and the library comparison are in
[collections.md](../../../docs/research/collections.md) (Decisions).

## Goals / Non-Goals

**Goals:**
- Pure, DOM-free modules: every collection, selection, navigation and typeahead
  scenario runs in the `node` project.
- One model and one navigation implementation for data-driven and static-part
  components.
- 10,000 items: O(1) moves, O(n) only when a new collection instance is built; moving
  the highlight re-renders two items.

**Non-Goals:**
- Grid navigation, drag and drop, a virtualizer, data fetching (see proposal).
- Deciding hierarchical states or machine composition (machine-runtime §6.1–6.2).

## Decisions

### 1. Modules

```
packages/core/src/collection/
├─ key.ts           CollectionKey brand, toKey() at component boundaries
├─ list.ts          createListCollection, Collection<T>, Node<T>
├─ tree.ts          createTreeCollection, visible(expandedKeys)
├─ filter.ts        createFilter(locale) → { startsWith, contains } (text value or any keyword)
├─ selection.ts     SelectionState + pure operations
├─ navigation.ts    next/previous/first/last/page/tree moves, bounded walker, repair()
├─ typeahead.ts     pure typeahead step
├─ composite.ts     connect helpers: item/list/container props for both strategies
├─ machine.ts       reusable context fields, events, guards and actions for machines
└─ index.ts
packages/core/src/env/   + Clock, CollectionLayout capability interfaces
packages/core/src/dom/   + item-registry.ts (commit-time registration, document-order sort),
                           collection-layout.ts (measured page moves), pointer-guard.ts
packages/react/src/      + use-collection-items.ts (static parts → Collection)
packages/core/src/contract/collection.ts   contract fragment
packages/testing/src/    + traits/selectable.ts, traits/set-metadata.ts
packages/testing/fixtures/listbox/
```

### 2. Collection data model

```ts
declare const keyBrand: unique symbol
export type CollectionKey = string & { readonly [keyBrand]: true }
/** Brands at a component boundary. Sound: keys are plain strings at run time. */
export const toKey = (value: string) => value as CollectionKey

export interface ItemNode<T> {
  readonly type: "item"
  readonly key: CollectionKey
  readonly value: T
  readonly textValue: string
  readonly keywords: readonly string[] // filters only; never typeahead/announcements (from add-command)
  readonly disabled: boolean
  readonly index: number            // over items only
  readonly parentKey: CollectionKey | null // section or tree parent
  readonly level: number            // 0 for lists
}
export interface SectionNode { readonly type: "section"; readonly key: CollectionKey; readonly label: string }

export interface Collection<T> {
  readonly size: number             // items only
  get(key: CollectionKey): ItemNode<T> | undefined
  has(key: CollectionKey): boolean
  keyAfter(key: CollectionKey): CollectionKey | null   // items only, O(1)
  keyBefore(key: CollectionKey): CollectionKey | null
  firstKey(): CollectionKey | null
  lastKey(): CollectionKey | null
  at(index: number): ItemNode<T> | undefined           // O(1), array-backed
  sections(): readonly SectionNode[]
  sectionOf(key: CollectionKey): SectionNode | undefined
  [Symbol.iterator](): Iterator<ItemNode<T> | SectionNode> // render order
  filter(predicate: (node: ItemNode<T>) => boolean): Collection<T>
  insert(index: number, ...items: T[]): Collection<T>
  remove(...keys: CollectionKey[]): Collection<T>
  move(key: CollectionKey, toIndex: number): Collection<T>
}

export function createListCollection<T>(options: {
  items: Iterable<T>
  getKey: (item: T) => string
  getText: (item: T) => string
  getKeywords?: (item: T) => readonly string[]
  isDisabled?: (item: T) => boolean
  getSection?: (item: T) => { key: string; label: string } | undefined
}): Collection<T>
```

Internals: one array of nodes plus a `Map<CollectionKey, number>`; prev/next are index
± 1 over the item array, so no linked list is maintained. Built eagerly in the factory
(O(n)), immutable after. Duplicate keys throw in development (`import.meta.env.DEV`-style
flag supplied by the build), are skipped in production.

*Alternatives:* React Aria's linked `Map` of nodes (same complexity, more memory);
Zag's `findIndex` (O(n) moves, rejected); DOM-registered items as the source of order
(Radix, Ariakit, Base UI, Headless UI — rejected: observers, SSR gaps, bug history).

### 3. Static parts

`use-collection-items.ts` (React) gives each item part a ref callback that registers
`{ key, textValue, keywords, disabled, element }` into `core/dom/item-registry.ts`. The registry
collects registrations during commit and, in one layout-phase flush, sorts by
`compareDocumentPosition` (adjacent-sibling fast path, as Base UI) and calls
`createListCollection`. The root passes the result as `props.collection` through
`setProps`, so the machine sees an ordinary collection change. Server render: no
collection yet; connect falls back to "the item whose key equals the selected value
gets `tabIndex=0`, else the container" (spec: Exactly One Tab Stop).

*Alternative:* React Aria Components' hidden fake-document builder — handles nested
JSX of any shape, but is the most complex code in that repository and React-specific.

### 4. Collections and the snapshot (resolves machine-runtime open question 6)

- `collection` is a prop. Machines declare `onProps: { collection: "COLLECTION.CHANGE" }`
  (Object.is comparison). The handler action `repairCollection` reads the new
  collection from `props` and the previous one from `context.lastCollection`, a
  reference stored by the same action (a pointer; the snapshot still holds no items).
- Context fields contributed by `collection/machine.ts`:

```ts
interface CollectionContext {
  highlightedKey: CollectionKey | null
  highlightSource: "keyboard" | "typeahead" | "pointer" | "programmatic" | null
  anchorKey: CollectionKey | null
  typeahead: { buffer: string; at: number; lastKey: CollectionKey | null }
  lastCollection: Collection<unknown> | null
  pendingLoadMore: Collection<unknown> | null   // dedupes onLoadMore per instance
}
```

- Selection is a controllable value of the component (`value` / `defaultValue` /
  `onValueChange`), stored internally as `SelectionValue = ReadonlySet<CollectionKey> |
  "all"`; each component maps its public shape (`string | null`, `string[]`) with an
  `equal` that compares sets. Expanded keys in trees are a second controllable.
- Item parts read `useSelector(service, s => s.context.highlightedKey === key)` and the
  equivalent for selection, so a move re-renders two items.

*Alternatives:* copying items into context (O(n) snapshots, every change re-renders all
items); a version counter outside the snapshot (two sources of truth); Zag's
`toString()` change detection (O(n) per render).

### 5. Reusable machine pieces

Collection behaviour is not a machine of its own. `collection/machine.ts` exports the
event union and implementations that component machines spread into `setup()`:

```ts
export type CollectionEvent =
  | { type: "NAVIGATE"; move: Move; extend?: boolean; source: "keyboard" }
  | { type: "HIGHLIGHT"; key: CollectionKey | null; source: HighlightSource }
  | { type: "POINTER_MOVE"; key: CollectionKey; x: number; y: number }
  | { type: "TYPEAHEAD"; char: string; composing: boolean; modifiers: Modifiers }
  | { type: "SELECT"; key: CollectionKey; modality: Modality; shift: boolean; mod: boolean }
  | { type: "SELECT_ALL" } | { type: "CLEAR_SELECTION" } | { type: "DESELECT"; key: CollectionKey }
  | { type: "EXPAND"; key: CollectionKey } | { type: "COLLAPSE"; key: CollectionKey }
  | { type: "COLLECTION.CHANGE" } | { type: "COMPOSITE.BLUR" }
type Move = "next" | "previous" | "first" | "last" | "page-next" | "page-previous"
          | "expand" | "collapse"
// The union stays closed: spatial moves (grid layouts) use their own event,
// NAVIGATE_SPATIAL, owned by add-grid-list's `collection-grid`.

export const collectionActions = { navigate, highlight, pointerMove, typeahead, select,
  selectAll, clearSelection, deselect, expand, collapse, repairCollection,
  resetTypeahead, scrollToHighlighted, announceHighlighted } // signatures per §5.3 of machine-runtime
export const collectionGuards = { hasHighlight, isEmpty, canSelect, isTypingAhead }
export const collectionEffects = { focusHighlighted } // roving: env.focus on highlight change
```

Logical keys come from `add-a11y-foundations`' key normalisation in connect; machines
never see `ArrowDown`. The pure functions underneath (`navigation.ts`, `selection.ts`,
`typeahead.ts`) are exported for components that need them directly.

### 6. Selection operations

```ts
export interface SelectionConfig {
  mode: "none" | "single" | "multiple"
  behavior: "toggle" | "replace"
  disallowEmpty: boolean
  disabledBehavior: "all" | "selection"
}
export function select(c: Collection<unknown>, s: SelectionValue, anchor: CollectionKey | null,
  input: { key: CollectionKey; modality: Modality; shift: boolean; mod: boolean },
  cfg: SelectionConfig): { value: SelectionValue; anchor: CollectionKey | null }
export function selectAll / clear / deselect / isSelected(c, s, key)
```

`extend` remembers the previous range end in the anchor record (`{ key, rangeEnd }`) to
replace, not accumulate, the range. `"all"` is materialised only by `isSelected`
(`canSelect(key)`) and by the component's `onValueChange` mapping (enumerating the
current collection plus a `"all"` flag where the component's public type allows it).
Labels for selected keys absent from the collection come from a key → text map updated
in `repairCollection` (Zag's selection-map idea, text only).

### 7. Navigation, focus strategy and repair

- `navigation.ts`: `move(c, from, move, { loop, navigable, pageSize })` with one bounded
  walker (`for (i = 0; i < c.size; i++)`), `navigable = (node) => !node.disabled ||
  focusableWhenDisabled`. Page size comes from the `CollectionLayout` capability:

```ts
export interface CollectionLayout {
  /** Key reached by a page move from `key`, or null when layout cannot be measured. */
  pageTarget(key: CollectionKey, direction: "next" | "previous"): CollectionKey | null
}
```

  `domEnvironment()` implements it with React Aria's visible-rect algorithm over item
  elements found by `data-key`; it returns null in jsdom (zero rects), and the machine
  then uses 10 items.
- `repair(prev, next, key)` walks `prev` forward from `key`, then backward, returning
  the first key that `next` has and that is navigable.
- `composite.ts` produces props from `(view, strategy)`: roving → item `tabIndex`,
  container `tabIndex` only in the no-navigable-item case; active-descendant → container
  or input `aria-activedescendant` (only when the highlighted item is registered as
  rendered, which virtualizers guarantee via persisted keys), item `id` from
  `rootId + "-item-" + encodeKey(key)`.
- Scrolling: `scrollToHighlighted` runs only for non-pointer sources; it calls
  `props.scrollToIndex` when given, else `env.dom` scroll-into-view with
  `block: "nearest", behavior: "instant"`.
- Pointer guard: `core/dom/pointer-guard.ts` keeps the last pointer coordinates per
  window; connect forwards `POINTER_MOVE` only when they changed, and the `pointerMove`
  action ignores it while `highlightSource` is `keyboard` / `typeahead` until a real
  move arrives.
- Apple announcements: `announceHighlighted` runs only when `strategy ===
  "active-descendant"` and `env.platform.apple`; text via `messages` (section label,
  item text, selected state).

### 8. Typeahead

```ts
export interface TypeaheadState { readonly buffer: string; readonly at: number; readonly lastKey: CollectionKey | null }
export function typeahead(state: TypeaheadState, input: { char: string; now: number },
  c: Collection<unknown>, from: CollectionKey | null,
  opts: { timeout: number; collator: Intl.Collator; navigable: (n) => boolean })
  : { state: TypeaheadState; key: CollectionKey | null }
```

The "timer" is `now - at > timeout`, with `now` from a new `Clock` capability
(`{ now(): number }`, `performance.now()` in `domEnvironment()`, fake clocks in tests).
No `setTimeout`, nothing to clean up on unmount or StrictMode replay. The collator is
created once per locale (`usage: "search", sensitivity: "base"`) and cached. Composing
and modifier events are dropped in connect before `TYPEAHEAD` is sent; the action
re-checks `composing` so the machine rule is testable without a DOM.

*Alternatives:* a delayed `after` transition (needs a typeahead state in every machine,
or machine composition, which foundations leaves undecided); a per-component
`setTimeout` (Zag, Radix #4097 class of bugs).

### 9. Async and virtualization

- Props contributed to collection components: `loading?: "idle" | "loading" |
  "loading-more" | "error"`, `onLoadMore?: () => void`, `virtualized?: boolean`,
  `scrollToIndex?: (details: { index: number; key: CollectionKey; reason:
  "navigation" | "typeahead" | "open" }) => void`.
- `view.computed.persistedKeys` (highlighted key + focused key) for the consumer's
  virtualizer (`rangeExtractor` in TanStack Virtual; documented recipe).
- `onLoadMore` is called from the `navigate` action (last item reached) or from the
  scroll-sentinel part's intersection effect, guarded by `pendingLoadMore !==
  props.collection`.

### 10. Contract fragment and invariants

`contract/collection.ts` exports `collectionContract({ itemRole, strategy, select:
"enter" | "space" | "both" })`, returning anatomy, actions and queries a component
contract spreads into its own (spec: Collection Contract Fragment). `@rind-ui/testing`
adds the `selectable` and `set-metadata` trait checks alongside the foundations'
generic invariants, and argument-class configurations via the runner's existing `props`
option.

### 11. Reference fixture (`packages/testing/fixtures/listbox`)

Machine states and events:

```
idle ──FOCUS──► focused ──BLUR──► idle
focused: NAVIGATE, HIGHLIGHT, POINTER_MOVE, TYPEAHEAD, SELECT, SELECT_ALL,
         CLEAR_SELECTION, DESELECT (internal transitions, actions only)
root:    COLLECTION.CHANGE → repairCollection · $sync:value · $reverted
entry(focused): highlightInitial · exit(focused): resetTypeahead
effects(focused): focusHighlighted (roving only)
```

Props: `strategy`, `selectionMode`, `selectionBehavior`, `focusableWhenDisabled`,
`loop`, `orientation`, `virtualized`, `scrollToIndex`. Uses `core/collection` (all
modules), `core/dom` (`item-registry`, `collection-layout`, `pointer-guard`, keyboard
normalisation from a11y-foundations), env capabilities `Scheduler`, `DomRoot`, `Clock`,
`CollectionLayout`, `Platform`, `Announcer`, `Locale`. Not published; no theme
stylesheet (fixtures are unstyled), stories in `apps/storybook` under "Internal".

## Risks / Trade-offs

- [Consumers create a new collection every render] → one O(n) build and a repair pass
  per render; documented `useMemo` recipe, dev warning when the collection identity
  changes on every commit for 10 commits with equal keys.
- [Static-part registration still depends on DOM order] → sorted once per commit,
  covered by an "insert before" scenario; data mode recommended for dynamic lists.
- [`"all"` sentinel complicates public value types] → only components with select all
  (Listbox, Grid List, Table, Tree) expose it; others never produce it.
- [Measured page moves differ between browsers and jsdom] → page moves are tested in
  browser mode; jsdom asserts the documented 10-item fallback.
- [Coupling to `add-a11y-foundations`] → it is implemented before this change; pure
  modules still take locale and platform as parameters so they stay testable in Node.
- [Apple announcements may double-speak on macOS Sequoia, which reads activedescendant
  changes] → kept as accessibility.md decides; revisited with real-device testing, a
  change to `messages`/platform detection only.
