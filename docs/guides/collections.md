# Collections

Listbox, Select, Combobox, Menu, Tabs, Tree View and every other component that shows a
set of items share one collection layer in `@rind-ui/core`: a key-based model of the items,
selection, navigation, typeahead and the props of the collection parts. A component spreads
these pieces into its machine; it never re-implements them.

## The model

A collection is immutable and built once, in O(n); lookups and moves are O(1).

```ts
import { createListCollection, toKey } from "@rind-ui/core"

const countries = createListCollection({
  items: data,
  getKey: (c) => c.code,
  getText: (c) => c.name, // typeahead, filtering, announcements, form labels
  getKeywords: (c) => c.aliases, // filters only, never typeahead
  isDisabled: (c) => c.closed,
  getSection: (c) => ({ key: c.continent, label: c.continentName }),
})

countries.get(toKey("it"))?.textValue // "Italy"
countries.keyAfter(toKey("it")) // the next item, sections skipped
```

- **Keys** are strings branded as `CollectionKey` inside core; component props take plain
  strings. A duplicate key throws in development (naming both items) and is skipped in
  production.
- **Indexes** count items only: sections are not items, are never navigable or selectable,
  and are not counted in `aria-setsize`.
- **Derivations** (`filter`, `insert`, `remove`, `move`) return new collections, renumbered;
  a section left without items is dropped.
- **Trees**: `createTreeCollection({ roots, getChildren, hasUnloadedChildren, … })` gives
  parent, children, depth and sibling position, and `visible(expandedKeys)` the collection
  without collapsed descendants.

### Filtering

`createFilter(locale)` matches the text value or any keyword, ignoring case and diacritics
("ecole" finds "École"):

```ts
const filter = createFilter("fr")
const results = countries.filter((node) => filter.contains(node, query))
```

### Memoise the collection

A new collection instance is a collection change: the machine repairs the highlight
against it. Build it once per data change; in development a warning names the component
when it receives a new instance with the same keys ten renders in a row.

```tsx
const collection = useMemo(() => createListCollection({ items, getKey, getText }), [items])
```

## Collections are props, not state

The machine receives the collection as a prop (`onProps: { collection: "COLLECTION.CHANGE" }`,
compared by identity) and keeps only keys in its snapshot: the highlighted key, the
selection, the range anchor, expanded keys. Item parts select their own state by key, so a
highlight move re-renders two items, whatever the size of the list. A closed Select shows
its label from the collection data: no item part has to be mounted.

Static item parts (`<Tabs.Trigger value="a">`) produce the same model: each part registers
at commit time and the root receives one collection per commit, in document order. Before
they register (server render, first paint) the item whose key is selected is the tab stop.

## Selection

`selectionMode` is `none`, `single` or `multiple`; `selectionBehavior` is `toggle` (each
press adds or removes) or `replace` (a press replaces, mod+press toggles, Shift+press
extends). Touch and screen-reader presses toggle in `replace` mode, since those users have
no modifier keys.

- Ranges start from an internal anchor, never from the controlled value or the highlight,
  so a parent that passes a new array on every change keeps Shift ranges working, and a
  second Shift+press replaces the range instead of adding to it.
- Select all (mod+A) is a sentinel that covers items not loaded yet.
- No user action selects a disabled item; a controlled value that contains one is rendered
  as given.
- A collection change never deselects: filtered-out or unloaded items stay selected and
  keep their label.

## Navigation and focus

Machines receive logical moves (`next`, `previous`, `first`, `last`, `page-next`,
`page-previous`, `expand`, `collapse`); horizontal arrows are mirrored in right-to-left
text. Every search for the next item stops after one pass, so an all-disabled list cannot
hang.

| Strategy | DOM focus | Used by |
|---|---|---|
| `roving` | on the highlighted item (`tabindex="0"`, others `-1`) | everything without a text field |
| `active-descendant` | stays on the input or list (`aria-activedescendant`) | Combobox, Autocomplete, Command, Tags Input |

A roving collection is exactly one Tab stop: the highlighted item, else the first selected
navigable item, else the first navigable item, else the list itself. A disabled composite is
no Tab stop at all.

When the highlighted item leaves the collection, the highlight moves to the next surviving
item in the previous order, else the previous one; in roving mode focus follows it and never
falls to `<body>`. Repair is driven by data, so a virtualized item that scrolls out does not
move the highlight.

Navigation, typeahead and programmatic highlights scroll the item into view with the
smallest scroll; opening a popup on its selected item centres it. Pointer highlights and
collection changes never scroll. A pointer move whose coordinates did not change (content
scrolled under a resting pointer) is ignored.

On Apple platforms where VoiceOver does not read `aria-activedescendant` changes
(the `vo-activedescendant` quirk), active-descendant components announce keyboard
highlights through the announcer: the section and its option count when the section
changes, the item text and its selected state.

## Typeahead

Typing a printable character searches item text values (never keywords) with the
component's locale, ignoring case and diacritics. Repeating one letter cycles through the
items that start with it; a growing query stays on an item that still matches. Space
continues a search in progress instead of selecting. The search ends after the typeahead
timeout (1000 ms by default, set on the provider or per component), when nothing matches, or
when focus leaves; the timeout is measured with the environment's clock, so there is no
timer to clean up.

## Async loading and virtualization

Collection components accept `loading` (`idle`, `loading`, `loading-more`, `error`) and
`onLoadMore`, called once per collection instance when navigation reaches the last item.
While loading, the list carries `aria-busy="true"` and `data-loading`.

rind-ui ships no virtualizer. A virtualized component takes `virtualized` and
`scrollToIndex({ index, key, reason, align })` instead of scrolling an element, and exposes
the persisted keys your virtualizer must keep mounted (the highlighted item), so
`aria-activedescendant` and roving focus always point at a rendered element. Items carry
`aria-posinset` and `aria-setsize` from the whole collection.

With TanStack Virtual:

```tsx
const persisted = usePersistedKeys() // the component's persisted keys
const virtualizer = useVirtualizer({
  count: collection.size,
  getScrollElement: () => scrollRef.current,
  estimateSize: () => 32,
  rangeExtractor: (range) => {
    const indexes = new Set(defaultRangeExtractor(range))
    for (const key of persisted) {
      const index = collection.get(key)?.index
      if (index !== undefined) indexes.add(index)
    }
    return [...indexes].sort((a, b) => a - b)
  },
})

<Root collection={collection} virtualized scrollToIndex={({ index, align }) =>
  virtualizer.scrollToIndex(index, { align: align === "center" ? "center" : "auto" })}
/>
```

## Collection parts and attributes

| Part | Attributes |
|---|---|
| list | `role`, `data-orientation`, `data-loading`, `data-empty`, `aria-multiselectable`, `aria-busy` |
| item | `data-key`, `data-highlighted`, `data-selected`, `data-disabled`, `data-focus-visible` (keyboard and typeahead highlights), `aria-selected` (always `true` or `false` when selectable), `aria-disabled`, `aria-posinset`, `aria-setsize`; trees add `aria-level` and `aria-expanded` |
| section | `role="group"` labelled by its section label |
| section-label | the label, not an item |

## Testing a collection component

`collectionContract({ itemRole })` is the contract fragment every collection component
spreads into its own: the anatomy (`list`, `item`, `section`, `section-label`), the actions
`highlight`, `choose`, `toggle`, `chooseRange`, `selectAll` and `typeahead` (each with a
keyboard implementation) and the queries `items`, `highlighted`, `selected`, `disabled` and
`focusedItem`. The `selectable` and `set-metadata` traits check that `aria-selected` follows
the selection and never the highlight, that no step selects a disabled item, and that
`aria-setsize` equals the collection's item count.
