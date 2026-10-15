# Collections (`core/collection`) — research

Status: done · Infrastructure (first needed by Wave 1: Select, Menu / Context Menu,
Segmented Control, Tabs, Radio / Toggle Group)

Shared infrastructure for every component that shows a set of items and lets the user
move through them and pick some: lists and trees, keys, selection, keyboard navigation,
the focused or highlighted item, typeahead, disabled items, sections, async loading,
filtering and the hooks a virtualizer needs. It answers open question 6 of
[machine-runtime.md](machine-runtime.md) (large collections in immutable snapshots).

Paths below are relative to shallow clones read on 2026-10-14: `zag/` (chakra-ui/zag
@ `055a34f`), `react-spectrum/` (@ `e04377c`; the real sources live under
`packages/react-stately/src` and `packages/react-aria/src`, read with `git show HEAD:`),
`ariakit/` (@ `2c9bbc2`), `base-ui/` (@ `5b53c6c`), `radix/` (@ `1e3759d`),
`headlessui/` (@ `eea57cf`), `reka-ui/` (@ `a3629f8`), `kobalte/` (@ `675b4a1`),
`bits-ui/` (@ `fd10616`).

## Who needs it

| Component | Items from | Focus strategy (accessibility.md §4.2) | Selection | Extra |
|---|---|---|---|---|
| Listbox | data | roving | none / single / multiple | sections, typeahead, virtualization, async |
| Select | data | roving in the popup | single (multiple later) | sections, typeahead, virtualization |
| Combobox, Autocomplete, Command | data | active-descendant (DOM focus in the input) | single / multiple / none | filtering, async, virtualization, Apple announcements |
| Tags Input | data (suggestions) + tags | active-descendant | multiple | filtering |
| Menu, Context Menu, Menubar | static parts (data allowed) | roving | none, checkbox / radio items | typeahead, submenus, sections |
| Tabs, Toolbar, Toggle Group, Radio Group, Segmented Control | static parts | roving | single / multiple (toggle group) / none | orientation, RTL, no typeahead (Radio: optional) |
| Navigation Menu | static parts | roving between triggers | none | — |
| Pagination | static parts | none: plain Tab order (navigation links, not a composite; add-pagination design §5) | none | — |
| Tree View | data (tree) | roving | none / single / multiple | expand / collapse, lazy children, typeahead |
| Tag Group | data | roving | none / single / multiple | removal moves focus |
| Grid List, Table | data | roving (cells/rows) | multiple, select all | grid navigation, virtualization (wave 3) |

Two observations drive the design. First, everything selectable or long (Select,
Combobox, Listbox, Tree, Table, Tag Group) already has its items as **data** in the
consumer's hands. Second, the static composites (Tabs, Toolbar, Radio, Toggle Group,
Menu) are short lists written by hand in JSX, where asking for an `items` array would
be hostile. Every library ends up serving both cases; the ones that serve them with two
different models (Zag: `ListCollection` for Select, DOM queries for Menu and Tabs; Headless
UI: DOM registration plus a separate `virtual` mode) duplicate navigation logic and bugs.

## Pattern

- WAI-ARIA APG: [Listbox](https://www.w3.org/WAI/ARIA/apg/patterns/listbox/),
  [Menu and Menubar](https://www.w3.org/WAI/ARIA/apg/patterns/menubar/),
  [Tree View](https://www.w3.org/WAI/ARIA/apg/patterns/treeview/),
  [Tabs](https://www.w3.org/WAI/ARIA/apg/patterns/tabs/),
  [Toolbar](https://www.w3.org/WAI/ARIA/apg/patterns/toolbar/),
  [Radio Group](https://www.w3.org/WAI/ARIA/apg/patterns/radio/),
  [Combobox](https://www.w3.org/WAI/ARIA/apg/patterns/combobox/),
  [Grid](https://www.w3.org/WAI/ARIA/apg/patterns/grid/); the cross-pattern rules are in
  APG ["Developing a Keyboard Interface"](https://www.w3.org/WAI/ARIA/apg/practices/keyboard-interface/)
  (managing focus in composites, typeahead, disabled items).
- Roles and attributes the collection layer must be able to produce: `option`,
  `menuitem` / `menuitemcheckbox` / `menuitemradio`, `treeitem`, `tab`, `radio`, `row`,
  `gridcell`; `group` + `aria-labelledby` for sections (`presentation` header);
  `aria-selected` (explicit `true`/`false` on every selectable item), `aria-checked`
  (menu / radio / toggle items), `aria-disabled`, `aria-multiselectable`,
  `aria-activedescendant`, `aria-setsize` / `aria-posinset` (virtualized or filtered
  sets), `aria-level` / `aria-expanded` (trees), `aria-busy` while loading,
  `aria-orientation`.
- Keyboard the layer implements (logical keys, accessibility.md §6): Next / Previous
  (arrows per orientation, mirrored in RTL for horizontal), First / Last (Home / End),
  Page Next / Previous (PageDown / PageUp), Expand / Collapse (tree), typeahead
  (printable characters), Space / Enter select (component decides), Shift + move extends
  the selection, Shift + click selects a range, mod + A selects all, mod + click toggles
  (when `selectionBehavior` is `replace`).

## How the others built it

### Zag.js / Ark UI

- Source: `zag/packages/utilities/collection/src/{list-collection,tree-collection,grid-collection,selection,selection-map,types}.ts`
  (2,235 lines); users `machines/{select,combobox,listbox,tree-view,menu,async-list}`.
- API shape: `new ListCollection({ items, itemToValue, itemToString, isItemDisabled, groupBy, groupSort })`;
  string values; immutable-ish (`copy`, `append`, `remove`, `filter` return new
  instances). `TreeCollection({ rootNode, nodeToValue, nodeToChildren, nodeToChildrenCount })`
  with index paths. `GridCollection` chunks a list into `columnCount` rows. `Selection`
  extends `Set<string>` with `selectionMode` (`none | single | multiple | extended`).
- State model: the collection is a **prop**, not context. Machines keep
  `highlightedValue` and `value` (string arrays) in context. A change of collection is
  detected with `track([() => prop("collection").toString()])`, which stringifies every
  item on every render (`select.machine.ts:142`, `combobox.machine.ts:181`).
  Virtualization: a `scrollToIndexFn({ index, immediate, getElement })` prop the
  machine calls instead of `scrollIntoView` (`listbox.machine.ts:250`). Menu, Tabs,
  Radio and Toggle Group do not use the collection at all; they query DOM items.
  Typeahead (`dom-query/src/typeahead.ts`, `ListCollection.search`) uses a 350 ms
  timeout with a global `setTimeout` and a mutable `refs` buffer.
- Notable: `selection-map.ts` keeps the selected *items* in a map so they survive a
  filter that removes them from the current collection (combobox). `scrollToIndexFn`
  is the cleanest virtualization hook of all libraries: the machine knows the index,
  the consumer's virtualizer knows how to scroll. `async-list` is a machine for
  load / sort / filter with `AbortSignal`.
- Problems: `indexOf` is `findIndex` (O(n)) unless grouping is on, so arrow navigation
  is O(n) per key press and `getValueRange` O(n²). `Selection.canSelect` reads
  `selectionMode !== "none" || !disabled`, which lets disabled items be selected in every
  mode but `none` (`selection.ts:44`, should be `&&`). `getNextValue` walks past the
  end when the tail is disabled. Tree `expandedValue` is an array searched with
  `includes`. Two navigation implementations (collection vs DOM) diverge per component.

### React Aria / React Stately (and Kobalte, its Solid port)

- Source: `react-stately/src/{collections,list,tree,selection,virtualizer,layout}/*`,
  `react-aria/src/{selection/{useSelectableCollection,useSelectableItem,useTypeSelect,ListKeyboardDelegate,DOMLayoutDelegate}.ts,collections/{CollectionBuilder.tsx,BaseCollection.ts,Document.ts},virtualizer/*}`;
  Kobalte mirrors the same files in `kobalte/packages/core/src/{list,selection}`.
- API shape: a `Collection<Node<T>>` interface keyed by `Key` (string | number):
  `getKeyBefore/After`, `getFirstKey/LastKey`, `getItem`, `getChildren`; nodes carry
  `type` (`item | section | header | loader | separator`), `textValue`, `index`,
  `level`, `parentKey`, `prevKey/nextKey`. `ListCollection` builds a linked list over a
  `Map` once, so navigation is O(1). RAC builds the collection by rendering JSX children
  into a hidden fake `Document` (`CollectionBuilder.tsx`, `Document.ts`) and reading the
  result through `useSyncExternalStore`: static JSX and data arrays produce the same
  model.
- Selection (`SelectionManager.ts`): `selectionMode: none | single | multiple`,
  `selectionBehavior: toggle | replace`, `disallowEmptySelection`, `disabledKeys` +
  `disabledBehavior: selection | all`; selected keys are `Set<Key> | "all"` (select all
  works on unloaded or filtered items); `Selection` remembers `anchorKey` and
  `currentKey` for Shift ranges. `select()` toggles instead of replacing when the press
  came from touch or a screen reader ("virtual"), because those users have no modifier
  keys. `withCollection` keeps a `fullCollection` so select all includes filtered-out
  items (Autocomplete).
- Navigation: `KeyboardDelegate` (`getKeyBelow/Above/LeftOf/RightOf`, `getKeyPageAbove/Below`,
  `getFirstKey/LastKey`, `getKeyForSearch`). Page keys measure DOM rects through a
  `LayoutDelegate` (`DOMLayoutDelegate.ts`) and fall back to first / last when the list
  does not scroll. Focus repair (`useListState.ts`, `useFocusedKeyReset`): when the
  focused key disappears, walk **forward in the previous collection** to the first key
  that still exists and is enabled, else backward, else focus the collection.
- Typeahead (`useTypeSelect.ts`): 1000 ms, `Intl.Collator` prefix comparison on
  `textValue`, search from the focused key then from the top, Space inside a search is a
  character (captured before the item's own Space handler), Ctrl / Meta / Alt ignored,
  reset when nothing matches.
- Virtualization: own `Virtualizer` with layouts (`ListLayout`, `GridLayout`,
  `TableLayout`), `persistedKeys` keeps the focused item mounted, DOM reordering
  deferred until scrolling stops ("DOM order … matters for assistive technology users").
  `aria-posinset`/`aria-setsize` only when virtualized (`useOption.ts:130`).
- Notable: the most complete model; keys over indexes everywhere; text value separate
  from rendered content; the touch / virtual toggle rule; focus repair from the old
  collection.
- Problems: hook-shaped and React-only; the hidden-document builder is the most complex
  code in the repo (SSR special path, strict-mode guards, portal into a fake DOM) and a
  long tail of bugs (see Bug history). `at(idx)` spreads all keys (O(n)).

### Ariakit

- Source: `ariakit/packages/ariakit-components/src/{collection/collection-store,composite/composite-store}.ts`,
  `ariakit-react-components/src/composite/{composite,composite-item,composite-typeahead,composite-hover,composite-renderer}.tsx`.
- API shape: items **register from the DOM** (`id`, `element`, `disabled`, `rowId`,
  `children` text). `renderedItems` are sorted with `sortBasedOnDOMPosition`; an
  `IntersectionObserver` re-sorts them when elements move (`collection-store.ts:217–250`).
  `CompositeStore`: `activeId` (`null` = the composite element itself), `virtualFocus`
  (activedescendant) vs real focus, `orientation`, `rtl`, `focusLoop`, `focusWrap`,
  `focusShift` (grid), `moves` counter.
- Notable: one composite with a `virtualFocus` switch, the active item always carries
  `data-active-item`; the cleanest statement of the roving / activedescendant duality.
  `CompositeRenderer` virtualizes; typeahead falls back from rendered items to all items
  when the list is virtualized. Typeahead window 500 ms.
- Problems: DOM order as the source of truth needs re-sorting heuristics (#3285 constant
  re-sorts on scroll, #3914 a frame of stale derived state); controlled items and
  registered items live in two maps with a private shared lookup.

### Base UI (and Floating UI React)

- Source: `base-ui/packages/react/src/internals/composite/list/{CompositeList.tsx,useCompositeListItem.ts}`,
  `floating-ui-react/hooks/{useListNavigation,useTypeahead}.ts` (963 + 240 lines).
- API shape: **index-based**. Items register an element and label into
  `elementsRef` / `labelsRef` arrays, re-sorted by document position; navigation moves an
  `activeIndex`; `disabledIndices`. Typeahead resets after 750 ms and cycles repeated
  letters.
- Notable: hard-won platform workarounds in comments — WebKit fires zero-delta
  `mousemove` when the list scrolls under a stationary pointer, which moved the
  highlight during keyboard navigation (#4002); Chrome fires ArrowDown twice while
  composing; navigation ignored while the popup animates out; `scrollIntoView` missing
  in jsdom. A consumer who controls `activeIndex` can decline a navigation, and the hook
  reconciles instead of drifting.
- Problems: indexes go stale when items are inserted before the active one; the list
  re-sort observes common parents for moves (`CompositeList.tsx:94–131`), complexity
  that exists only because order comes from the DOM.

### Radix (and Reka UI, Bits UI)

- Source: `radix/packages/react/{collection/src/collection.tsx,roving-focus/src/roving-focus-group.tsx}`;
  `reka-ui/packages/core/src/{Collection/Collection.ts,shared/useTypeahead.ts}`;
  `bits-ui/src/lib/internal/{roving-focus-group,data-typeahead.svelte,dom-typeahead.svelte}.ts`.
- API shape: `createCollection` registers item refs in an ordered dictionary sorted by
  `compareDocumentPosition`; `RovingFocusGroup` keeps `currentTabStopId`, `loop`,
  `orientation`, `dir`; the group itself is the tab stop until an item is focused and
  redirects focus (`roving-focus-group.tsx:173–200`). Reka queries
  `[data-reka-collection-item]` and sorts by `querySelectorAll` order. Typeahead 1000 ms
  (Radix, Reka). Bits UI splits typeahead in two: one over data, one over DOM.
- Notable: tiny; registration only at commit ("never includes items from renders React
  discards", `collection.tsx:121`); `focusFirst(candidates)` tries each candidate until
  focus actually moves.
- Problems: no data model at all, so no virtualization, no sections in navigation, no
  selection beyond what each component rebuilds; the group's `tabIndex` depends on
  registered items, which caused #3077 (FocusScope skipped the group before items
  registered).

### Headless UI

- Source: `headlessui/packages/@headlessui-react/src/components/{listbox,combobox}/*-machine.ts`,
  `utils/calculate-active-index.ts`.
- API shape: a reducer machine; options register `dataRef`s and are sorted by an
  optional `order` or by DOM node (`combobox-machine.ts:121–124`); separate `virtual`
  mode (`{ options, disabled }` + TanStack Virtual) with index-based active option.
  Typeahead: lower-case `startsWith` on `textValue`, no locale awareness.
- Problems: two models (registered vs virtual) with separate code paths; when the active
  option unregisters, the active index resets to the first option
  (`combobox-machine.ts:539–547`, "seems like a fine default"); value equality through a
  `by` prop.

## Accessibility

Applies [accessibility.md](accessibility.md) §4 (focus), §6 (keyboard), §9 (i18n) and
[assistive-tech-and-a11y-testing.md](assistive-tech-and-a11y-testing.md) causes B, C, H
and I, and the combobox / listbox / tree rows of §1.4.

- **One tab stop.** Roving: exactly one item has `tabIndex=0` (the highlighted item, else
  the first selected, else the first focusable item); active-descendant: only the input
  or container is tabbable and items are never focusable (`tabIndex` absent or `-1`).
  With no focusable item at all (empty, or every item disabled without
  `focusableWhenDisabled`) the container is the tab stop so the widget stays reachable
  and announces its empty state.
- **Strategy per component** is fixed by accessibility.md §4.2: active-descendant only
  where DOM focus must stay in a text field (Combobox, Autocomplete, Command, Tags Input,
  Mentions); roving everywhere else. The item always carries `data-highlighted`, and
  `data-focus-visible` is computed for the virtually focused item where
  `:focus-visible` cannot apply.
- **VoiceOver and `aria-activedescendant`** (cause B): on Apple platforms
  active-descendant composites announce the highlighted item's text (plus its section
  label when the section changes, and "selected" state) through the injected announcer;
  never elsewhere. The id in `aria-activedescendant` must belong to a rendered element
  with an allowed role inside the element named by `aria-controls` (invariant 7 of the
  assistive-tech note).
- **Explicit selection state** (cause I): every selectable item renders
  `aria-selected="true"` or `"false"` (never absent; VO reads every option as selected
  otherwise — HUI#1599, RX#1907); `aria-selected` follows the *selection*, never the
  highlight (ZG#2947); multi-select listboxes use `aria-multiselectable="true"` and
  `aria-selected`, not `aria-checked` on `option` (VO ignores it). Menus use
  `aria-checked` on `menuitemcheckbox` / `menuitemradio`.
- **Names.** Items take their name from content; `textValue` is the typeahead text and
  the announcement text, not an `aria-label` (WebKit 209279 reads labelled options as
  "text"). Phrasing content (`span`) inside options (TalkBack, BU#4435). Section headers
  label their `group` with `aria-labelledby`; the header itself is `presentation`-free
  text, not an option.
- **Set metadata.** `aria-posinset` / `aria-setsize` are emitted when the DOM holds only
  part of the set (virtualization, lazy loading, filtering with unrendered rows) and are
  computed from the *current* collection in the same render, so `posinset ≤ setsize`
  always holds (RA#10711, AK#6301). Trees emit `aria-level`, `aria-setsize`,
  `aria-posinset` per sibling set and `aria-expanded` on branches only.
- **Disabled items** stay perceivable: rendered, `aria-disabled="true"`, skipped by
  arrow keys unless `focusableWhenDisabled` (APG recommends focusable disabled items in
  menus and listboxes so users discover them); never selectable; never activated.
- **Focus loss** (accessibility.md §4.3): removing, filtering out or collapsing the
  focused item moves focus to the next surviving item in the previous order, else the
  previous, else the container — never `<body>`.
- **Keyboard and i18n.** Machines see logical keys; horizontal arrows flip only in RTL
  (rule 17); typeahead and filtering use `Intl.Collator(locale, { usage: "search",
  sensitivity: "base" })`; key handlers ignore `isComposing` / `keyCode 229` (rule 18);
  Shift + arrow / click ranges, mod (⌘ on Apple, Ctrl elsewhere) + A / click.
- **Screen readers do not send keys** (cause J) and a virtual press is a bare click
  (cause A): selection from a touch or virtual press toggles in multiple mode (RA
  `SelectionManager.select`), and a focus with no key never selects (rule 13 of the
  assistive-tech invariants — Tabs with automatic activation select on *arrow*, not on
  SR focus).
- **Loading** sets `aria-busy="true"` on the list; the loading row is not an option and
  is not counted in `aria-setsize` (RA counts only items and sections).
- **Native platform** ([native-platform.md](native-platform.md) §7, §9): `focusgroup`
  (Chromium only) and customizable `<select>` are avoided; roving stays in
  `core/collection`. Nothing native gives typeahead over custom items, disabled-item
  skipping, sections, virtualization or activedescendant.
- **Forced colors / motion**: highlight must be visible without colour alone
  (`data-highlighted` lets the theme add an outline under `forced-colors: active`);
  scrolling an item into view is instant (`behavior: "auto"`), never smooth when
  `reducedMotion()` is true.

## Bug history

Method: `gh search issues` over adobe/react-spectrum, chakra-ui/zag, chakra-ui/ark,
ariakit/ariakit, mui/base-ui, radix-ui/primitives, tailwindlabs/headlessui and
unovue/reka-ui. Terms: typeahead, keyboard navigation, disabled, scrollIntoView,
virtualization, performance, order, dynamic items, selection / shift / select all,
focus lost / removed, activedescendant, VoiceOver, sections, setsize. About 60 issues
were read in full with their PRs. Rows are grouped by theme. Assistive-tech bugs
already listed in the assistive-tech note (ZG#2947, HUI#1599, RX#1907, BU#4435) are
not repeated here.

| Library | Issue | Symptom | Root cause | Fix / status | Lesson for rind-ui |
|---|---|---|---|---|---|
| Ariakit | [#1747](https://github.com/ariakit/ariakit/issues/1747) closed | Item inserted first ends up last; wrong item auto-focused | Mount-order append; IntersectionObserver re-sort unreliable | PR #1748 | Order comes from data; static parts sorted by document position once per commit |
| Headless UI | [#1834](https://github.com/tailwindlabs/headlessui/issues/1834) closed | Tab inserted before the current one opens the wrong panel | Tabs and panels paired by index across two registries | PR #1837 (keep active by identity) | Pair parts by key; selection is a key |
| Headless UI | [#3898](https://github.com/tailwindlabs/headlessui/issues/3898) open | 3.5 s per keystroke with 1,000 options (quadratic) | Per-option register dispatch × per-option store subscriptions + re-sort each time | PR #3899 open (batching) | One registration flush per commit; items subscribe by key |
| React Spectrum | [#7635](https://github.com/adobe/react-spectrum/issues/7635) closed | Dynamic menu section hangs the tab | Duplicate ids in the collection | Usage error | Duplicate keys are a dev error; walks are bounded |
| Radix | [#4136](https://github.com/radix-ui/primitives/issues/4136) open | Fast ArrowRight in Tabs dropped under load | Next item focused in `setTimeout`; next key reads stale DOM focus | PR #4159 open | Highlight updates synchronously in the model; the next key reads the model |
| Headless UI | [#3856](https://github.com/tailwindlabs/headlessui/issues/3856) open | Removing items while open crashes on next key | `activeItemIndex` not adjusted on unregister | PR #3857 open | Keys, never indexes, for the highlight |
| Base UI | [#3818](https://github.com/mui/base-ui/issues/3818) closed | Async combobox clears the value when its item is not in `items` | Mirrored `<select>` dropping values without an option | PR #3824 | Selection survives the item being absent from the current collection |
| Base UI | [#4764](https://github.com/mui/base-ui/issues/4764) closed | Controlled object values not shown selected, selectable twice | `Object.is` equality on recreated objects | Consumer passes `isItemEqualToValue` | Primitive keys via `getKey`; no object equality |
| Reka UI | [#1317](https://github.com/unovue/reka-ui/issues/1317) closed | 500-item combobox lags 1–2 s while filtering | Per-item deep-equal `find` (O(n²)) | Removed in v2 | Key → node map; O(1) per-item lookups |
| Zag | [#1947](https://github.com/chakra-ui/zag/issues/1947) closed | Preset value never shown when the collection loads later | Value → item sync only on value change | Fixed | Derive selected items/labels from (selection, collection) on either change |
| Reka UI | [#2904](https://github.com/unovue/reka-ui/issues/2904) closed | Virtual rows keep stale `aria-setsize` / `posinset` after filter | Rows keyed by virtual index; memo deps incomplete | PR #2905 | Virtual rows keyed by item key; ids from key |
| React Spectrum | [#1358](https://github.com/adobe/react-spectrum/issues/1358) closed | Tabbing an ActionGroup with disabled keys freezes the page | Unbounded "next enabled" loop | PR #1359 | Every walk stops after one cycle; all-disabled returns none |
| React Spectrum | [#6616](https://github.com/adobe/react-spectrum/issues/6616) closed | Removing a tag next to disabled tags crashes | Infinite loop in focus repair | PR #6621 | Repair uses the same bounded, disabled-aware walker |
| React Spectrum | [#9990](https://github.com/adobe/react-spectrum/issues/9990) closed | ArrowDown briefly focuses a disabled item, then focus is lost | Delegate and item disagreed on disabled state | PR #9997 | One source of disabled state, on the collection node |
| React Spectrum | [#10633](https://github.com/adobe/react-spectrum/issues/10633) open | Disabled selected tab makes the tablist unreachable | Focus target = selected key without disabled check; every tab `-1` | PR #10702 (uncontrolled only) | Exactly one focusable tab stop always; invalid target falls back to first enabled |
| Base UI | [#5524](https://github.com/mui/base-ui/issues/5524), [#1733](https://github.com/mui/base-ui/issues/1733) closed | Disabled items highlighted by arrows | Deliberate (APG: discoverable disabled items) | Won't fix; option discussed (#5139) | `focusableWhenDisabled` is an explicit policy; `aria-disabled`, not native `disabled` |
| Zag | [#953](https://github.com/chakra-ui/zag/issues/953) closed | `loop` ignored; highlight snaps back to top | Loop flag not honoured + `pointerleave` cleared highlight while scrolling | PR #954 | Loop is one navigation option; pointer leave during keyboard nav is ignored |
| Ariakit / Radix | [AK#6299](https://github.com/ariakit/ariakit/issues/6299), [RX#468](https://github.com/radix-ui/primitives/issues/468) closed | RTL arrows go to the wrong end / not mirrored | Container handler ignored `rtl`; Tabs lacked `dir` | AK PR #6454; RX PR #497 | Logical direction resolved by one function for every handler |
| Base UI | [#4160](https://github.com/mui/base-ui/issues/4160) closed | Virtual grid wraps to the first *rendered* item | Looping over mounted elements | PR #4164 | Navigation runs on the data model only |
| Headless UI | [#1046](https://github.com/tailwindlabs/headlessui/issues/1046) → [#1090](https://github.com/tailwindlabs/headlessui/issues/1090) closed | Repeated letter stuck on first match; the fix made "Bob" bounce | Search from 0; then always after current even for growing queries | PRs #1051, #1098 | Repeated char cycles after current; growing query searches from current inclusive |
| React Spectrum | [#8919](https://github.com/adobe/react-spectrum/issues/8919) open, [#1111](https://github.com/adobe/react-spectrum/issues/1111) closed | Same letter does not cycle; items without `textValue` unreachable | Current item included in search; missing text | Open | Cycling rules are spec scenarios; dev warning for missing text |
| React Spectrum | [#851](https://github.com/adobe/react-spectrum/issues/851) closed | Space while typing "Item 10" selects | Space handled as select during a search | PR #869 | Space joins a search in progress |
| Radix | [#4097](https://github.com/radix-ui/primitives/issues/4097) closed | Typeahead never accumulates in production builds | `/* @__PURE__ */` side-effect IIFE stripped by minifier | PR #4106 | No side-effect IIFEs; test built output |
| Base UI | [#2608](https://github.com/mui/base-ui/issues/2608) closed | After a value reset, typeahead jumps to the second match | Session not reset when focus left the composite | PR #2618 | Typeahead buffer resets on timeout, blur and value reset |
| Base UI | [#5776](https://github.com/mui/base-ui/issues/5776) open | Typing on a closed trigger selects a disabled item | Closed-state path skipped the disabled check | Open | One matcher for open and closed paths |
| Ariakit | [#6347](https://github.com/ariakit/ariakit/issues/6347), [#3567](https://github.com/ariakit/ariakit/issues/3567) closed | Typeahead lands on disabled offscreen items / cannot reach unrendered items | Separate paths for mounted vs placeholder items; rendered-only search | PRs #6425, #4212 | Typeahead searches collection data, then asks the virtualizer to scroll |
| React Spectrum | [#7947](https://github.com/adobe/react-spectrum/issues/7947), [#9543](https://github.com/adobe/react-spectrum/issues/9543) closed | Controlled `new Set()` breaks Shift+click and ⌘A | Anchor stored on the `Selection` value object | "Pass the set back unchanged" | Anchor lives in machine context, never on the controlled value |
| React Spectrum | [#10147](https://github.com/adobe/react-spectrum/issues/10147) open | Shift ranges fail in multi-select Picker | Selection flattened to `Key[]` each render, anchor lost | PR reverted | Same: adapters cannot lose the anchor because they never hold it |
| Zag | [#3347](https://github.com/chakra-ui/zag/issues/3347) closed | Shift+click range wrong with highlight on hover | Anchor read from the highlight | Commit 9a21994 | Highlight, focus, anchor and selection are separate state |
| Ariakit | [#1672](https://github.com/ariakit/ariakit/issues/1672) open, [#7795](https://github.com/ariakit/ariakit/issues/7795) | Removing the focused item sends focus to `body` | Deletion indistinguishable from unmount (Suspense, virtualization) | Open; workaround `move(next() ?? previous())` | Repair from *data* (key left the collection), not from DOM unmounts |
| Zag | [#1999](https://github.com/chakra-ui/zag/issues/1999) closed | After Delete, highlight moves but Delete no longer works | Highlight and DOM focus diverged | Fixed | Repair moves highlight and DOM focus together |
| React Spectrum | [#3910](https://github.com/adobe/react-spectrum/issues/3910) closed, [#9031](https://github.com/adobe/react-spectrum/issues/9031) open | Selected item scrolled into view only sometimes / undone by repositioning | Scroll inferred from focus events; overlay resize resets scroll | PR #6527; #9031 open | Scroll is an explicit step after open and after layout settles |
| Radix / Headless UI | [RX#2440](https://github.com/radix-ui/primitives/issues/2440), [HUI#3845](https://github.com/tailwindlabs/headlessui/issues/3845) open | Appending items (infinite scroll) jumps to the active item | Scroll-to-active on every collection change | Open | Scroll only on navigation intent, never on collection change |
| Ariakit | [#7628](https://github.com/ariakit/ariakit/issues/7628) closed | Far move in variable-size virtual list ends offscreen | Scroll to estimated offset, not re-checked after measuring | PR #7765 | `scrollToIndex` contract asks the virtualizer, which owns measurement |
| Radix / Ark | [RX#2602](https://github.com/radix-ui/primitives/issues/2602) closed, [ARK#3021](https://github.com/chakra-ui/ark/issues/3021) closed | Select slow with ~90 items even while closed; virtualized Select still renders every `<option>` | Items mounted while closed to feed the native select and value label | "Use a combobox" | Labels and form values from collection data, never from mounted items |
| React Spectrum | [#10731](https://github.com/adobe/react-spectrum/issues/10731) open | Every ListBoxItem re-renders on each parent render | Unstable context objects | Open | Per-key selectors; stable context |
| Zag / React Spectrum | [ZG#2936](https://github.com/chakra-ui/zag/issues/2936) closed, [RA#10326](https://github.com/adobe/react-spectrum/issues/10326) open | Arrowing a combobox / autocomplete silent in VoiceOver | VO ignores activedescendant changes; fallback only in some hooks | Zag: Apple announcer; RA open | Announcer fallback lives in the shared composite module |
| React Spectrum / Ariakit | [RA#10126](https://github.com/adobe/react-spectrum/issues/10126), [AK#6663](https://github.com/ariakit/ariakit/issues/6663) closed | CJK input never auto-highlights / Korean syllables broken | `insertCompositionText` ignored; refresh during composition | PRs #10156, #6664 | No highlight or focus changes mid-composition; commits count as input |
| React Spectrum | [#9556](https://github.com/adobe/react-spectrum/issues/9556), [#10711](https://github.com/adobe/react-spectrum/issues/10711) open | `posinset=2` for the first option with sections; "14 of 2" after filter | Index counts section nodes; filter keeps stale indexes | PR #10717 open | Item index counts items only and is renumbered by every derivation |
| Ariakit | [#6301](https://github.com/ariakit/ariakit/issues/6301) closed | Ungrouped items after a group get `posinset > setsize` | Off-by-group arithmetic | PR #6426 | Unit-test position arithmetic on mixed group/leaf sets |
| React Spectrum | [#5839](https://github.com/adobe/react-spectrum/issues/5839) open | VO counts the section header as an option, group name not read | Unclear; structure-level | Open | Section structure checked with real VO (manual protocol) |
| Zag / Base UI / Reka | [ZG#3255](https://github.com/chakra-ui/zag/issues/3255), [ZG#3273](https://github.com/chakra-ui/zag/issues/3273), [BU#4002](https://github.com/mui/base-ui/issues/4002), [RK#2100](https://github.com/unovue/reka-ui/issues/2100) closed | Keyboard / typeahead scroll lets the item under the resting cursor steal the highlight | Scroll under a stationary pointer fires (zero-delta in WebKit) pointer moves; fixed per component | Zag per-component guards (listbox missed), BU PR #5265 | One guard in the shared item pointer handler: ignore zero-delta moves and pointer highlight during a keyboard session |

## Known pitfalls

1. **Order from the DOM.** Radix, Ariakit, Base UI, Headless UI and Reka sort registered
   elements by document position and then need observers or re-sorts for moved,
   portalled or conditionally rendered items. A data collection has an order by
   construction; only the static-parts mode needs a DOM sort, once per commit.
2. **Indexes instead of keys.** Base UI and Headless UI virtual mode track an
   `activeIndex`; an insertion before the active item silently changes the highlight.
3. **O(n) where it hurts.** Zag's `indexOf` per arrow key and `toString()` per render;
   React Aria's `at()`. 10k-item lists must navigate in O(1) and detect change by
   reference.
4. **Highlight repair on change.** Every library reset to the first item at least once
   when the highlighted item was removed or filtered; the correct rule is React Aria's
   walk forward in the previous order.
5. **Pointer vs keyboard highlight.** Scrolling the list under a stationary pointer
   (WebKit zero-delta `mousemove`, Base UI #4002) or highlighting on `pointerenter` steals
   the keyboard highlight; pointer highlights must never scroll.
6. **Selection vs highlight confusion** (`aria-selected` on the highlighted option).
7. **Disabled items** selectable through range, select all or typeahead because only the
   click path checked `disabled` (Zag `canSelect`).
8. **Typeahead**: too-short timeout (350 ms), no Space continuation, matching on
   rendered text including icons, no locale awareness, firing during IME composition,
   global timers that survive unmount.
9. **Virtualization**: the active item unmounted (activedescendant to nothing), set
   metadata missing, and Home / End impossible without the full key list.
10. **SSR**: DOM-registered collections are empty on the server, so the roving tab stop
    and selected label are wrong until hydration.

## Testing notes

- **Pure modules first.** Collection, selection, navigation and typeahead are pure
  functions over immutable data plus a clock; every scenario runs in the `node` project
  with no DOM, including 10k-item performance checks.
- **jsdom** lacks layout: page keys cannot measure, `scrollIntoView` is a polyfill no-op
  (`@rind-ui/testing/setup`). The environment's layout capability therefore falls back to
  a fixed page size when it cannot measure; browser mode tests real paging and scrolling.
- **Model-based tests** cannot enumerate every key: the oracle owns the collection (same
  props), so a path step "NAVIGATE next" is checked against the oracle's
  `highlightedKey`. Generated paths need argument classes: first item, last item,
  disabled neighbour, section boundary, empty collection, all disabled.
- **Driver surface** (shared by every collection component's contract): actions
  `highlight(name)`, `press(key)` via the environment, `type(text)` for typeahead,
  `choose(name)`, `chooseRange(from, to)`, `toggle(name)`, `selectAll()`; queries
  `highlighted()`, `selected()`, `items()`, `isDisabled(name)`, `focusedItem()`.
  `isFocused()` already treats the `aria-activedescendant` target as focused
  (testing.md (a)).
- **Invariants** worth generic checks: one tab stop; activedescendant target valid;
  explicit `aria-selected`; `posinset ≤ setsize`; `data-highlighted` on exactly one item
  or none; selection never contains a disabled key added by a user action.
- **Screen readers**: Apple announcements and section announcements need the virtual
  screen reader / manual protocol (assistive-tech note §2.6–2.8); the contract asserts
  the announcer log only.

## Decisions

### Data model

- **Keys.** `CollectionKey` is a branded `string` (`string & { readonly [keyBrand]: true }`).
  Numbers are converted once by the consumer's `getKey`; one primitive type keeps maps,
  ids and form values simple (Zag uses strings; React Aria's `string | number` forced
  `String(key)` in every id). Keys are unique per collection; a duplicate is a
  development error naming the key and both items.
- **One immutable `Collection<T>`** for every component. Built from data with
  `createListCollection({ items, getKey, getText, isDisabled, getSections? })` or
  `createTreeCollection({ root, getKey, getText, isDisabled, getChildren, hasChildren? })`.
  Nodes are `item | section` (a separator is a part, not a node). Indexes (key → node,
  prev / next links, item index, item count) are built once per instance, so
  `get`, `next`, `previous`, `indexOf` and `has` are O(1). Derivations (`filter`,
  `insert`, `remove`, `move`, `visible(expandedKeys)` for trees) return new instances.
- **Static parts** (Menu, Tabs, Toolbar, Radio, Toggle Group…) produce the *same*
  `Collection`: the adapter registers item parts at commit and sorts them once per commit
  by document position (`core/dom`), then passes the resulting collection to the machine
  like any data collection. The machine never sees DOM order. Data mode is required for
  virtualization, filtering, async loading and trees.
- **Text value** is explicit: `getText(item)` (data) or the item part's `textValue` prop,
  defaulting to the rendered text for static parts. Typeahead, filtering, announcements
  and the hidden native `<select>` read it; a dev warning fires when it is missing and the
  item content is not plain text.

### Collections and snapshots (machine-runtime open question 6)

- The collection is **never copied into context or the snapshot.** It is a prop
  (`props.collection`), resolved at view time like any prop. The snapshot holds only
  keys: `highlightedKey`, the selected keys (a controllable value), `anchorKey`,
  `expandedKeys` (trees, controllable), the typeahead buffer and the reference to the
  last collection seen (a pointer, used to repair the highlight).
- Change is detected **by reference** through `onProps: { collection: "COLLECTION.CHANGE" }`
  — never by stringifying (Zag). Consumers keep the collection stable (`useMemo`); a new
  instance per render costs one O(n) index build and one repair pass, not a re-render of
  every item.
- Parts read through selectors by key: an item subscribes to
  `isHighlighted(key)` / `isSelected(key)` / `isDisabled(key)`, so moving the highlight
  re-renders two items, selecting one re-renders the changed items only.
- Selected keys are a `ReadonlySet<CollectionKey> | "all"` internally; the component's
  public value type (single `string | null`, `string[]`) maps onto it.

### Selection model

- `selectionMode: "none" | "single" | "multiple"`; `selectionBehavior: "toggle" | "replace"`
  (replace = desktop-style list: click replaces, mod + click toggles, Shift extends);
  `disallowEmptySelection`; `disabledBehavior: "all" | "selection"`.
- Operations: `select(key, { modality, shift, mod })`, `toggle`, `replace`,
  `extend(toKey)` from the anchor (replacing the previous range, not accumulating),
  `selectAll` (`"all"` sentinel, includes filtered-out and not-yet-loaded items),
  `clear`. Touch and virtual presses toggle in multiple mode.
- Disabled keys are never added by a user action — click, range, select all or
  typeahead-select. Controlled values may contain them (the consumer's decision).
- Collection changes never prune the selection: a filtered-out or not-yet-loaded item
  stays selected, and its last known item is kept for labels (Zag `selection-map`).
  Removing an item on purpose (Tag Group) deselects it explicitly.

### Navigation and focus

- Pure functions over a collection: `next`, `previous`, `first`, `last`, `pageNext`,
  `pagePrevious`, with `loop`, `disabledBehavior` / `focusableWhenDisabled`, and for trees
  `parent`, `firstChild`, `expand`, `collapse` over the visible collection. Grid
  navigation (two dimensions) is deferred to Grid List / Calendar, behind the same
  `NAVIGATE` event.
- Page targets come from an injected layout capability (measured rects in the browser,
  React Aria's algorithm); without measurement (Node, jsdom) the page step is 10 items.
- One composite module emits per-item and container props for both strategies
  (`focusStrategy: "roving" | "active-descendant"`), chosen by the component, not by the
  consumer.
- Highlight sources: `keyboard | typeahead | pointer | programmatic`. Only non-pointer
  *navigation* scrolls into view (`block: "nearest"`, instant) — never a collection
  change (RX#2440, HUI#3845); pointer highlight happens on real pointer movement
  (zero-delta moves ignored, BU#4002) and is suppressed while a keyboard session is
  active, in one shared item handler (ZG#3255 / #3273 were fixed per component and one
  was missed).
- Labels and native form values (hidden `<select>`) come from collection data, so a
  closed Select mounts no items (RX#2602, ARK#3021).
- Repair on `COLLECTION.CHANGE`: keep the highlighted key if it still exists and is
  focusable; else the next surviving focusable key in the previous order, else the
  previous one, else none (roving: container becomes the tab stop). Focus follows in
  roving mode only if focus was inside the composite.

### Typeahead

- `core/collection/typeahead.ts`, pure: `(state, input, collection, now) → { state, key }`.
  1000 ms window measured with an injected clock (no timer to cancel); a repeated single
  character cycles through matches starting *after* the highlighted item, unless the full
  string matches; a growing multi-character query searches from the highlighted item
  *inclusive* (HUI#1046 → #1090); Space joins a search in progress (RA#851);
  Ctrl / Meta / Alt and composing events are ignored; matching is a locale-aware prefix
  match on `textValue` over the whole collection (not the rendered subset, AK#3567),
  wrapping; disabled items are skipped unless focusable, on every path (open, closed
  trigger) through one matcher (BU#5776); no match resets the buffer and leaves the
  highlight; the buffer also resets on blur and on a value reset (BU#2608).

### Async, filtering, virtualization

- **Async**: rind-ui does not fetch. The consumer passes `loading: "idle" | "loading" |
  "loading-more" | "error"` and `onLoadMore`; the list emits `aria-busy` and
  `data-loading`, and `onLoadMore` fires at most once per collection instance when the
  highlight or the scroll sentinel reaches the end. Trees: `hasChildren` without
  children triggers `onLoadChildren(key)` once on expand.
- **Filtering**: `collection.filter(predicate)` keeps sections with surviving items;
  `createFilter(locale)` gives `startsWith` / `contains` on `textValue` with the search
  collator. The component owns the query; the collection change repairs the highlight.
- **Virtualization contract** (no virtualizer shipped): the machine calls the consumer's
  `scrollToIndex({ index, key, reason })` instead of scrolling an element; the view
  exposes `persistedKeys` (highlighted and focused keys) that the consumer's virtualizer
  must keep mounted; items emit `aria-setsize` / `aria-posinset` when the component is
  told it is virtualized. Ids are derived from root id + key, so an item re-mounted by
  the virtualizer gets the same id.

### Contract and invariants

- Collection contract fragment reused by component contracts (actions and queries listed
  in Testing notes); new traits `selectable` (explicit `aria-selected` / `aria-checked`,
  single mode ≤ 1 selected, equals the oracle's selection) and `set-metadata`
  (`1 ≤ posinset ≤ setsize`), on top of foundations' `composite-roving` /
  `composite-activedescendant`.

### Deliberately different from the others, and why

| Others | rind-ui | Why |
|---|---|---|
| DOM registration as source of order (Radix, Ariakit, Base UI, HUI, Reka) | Data collection; static parts sorted once per commit into the same model | No observers, works in Node and SSR, virtualization-ready |
| Two models: data for Select, DOM for Menu / Tabs (Zag, HUI) | One `Collection` for both | One navigation implementation, one bug surface |
| Index-based highlight (Base UI, HUI virtual) | Keys everywhere | Insertions do not move the highlight |
| Collection change via `toString()` (Zag) | Reference identity + repair pass | O(1) detection; consumers memoize |
| Hidden-document collection builder (RAC) | Commit-time registration for static parts only | A fraction of the code; data mode covers the hard cases |
| Typeahead timer per component (350–1000 ms) | One module, 1000 ms, clock-based buffer | Accessibility.md §6; no timer cleanup |
| `string \| number` keys (React Aria) | Branded string keys | One type for maps, ids and forms |

## Open questions

None that change the specs. Deferred to the components that need them: grid (2D)
navigation (Grid List, Calendar, Table), drag-and-drop reordering (RAC), the
`Combobox` hierarchical-state question (machine-runtime §6.1).
