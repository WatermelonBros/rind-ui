## Context

Research: [docs/research/json-tree-view.md](../../../docs/research/json-tree-view.md), whose
"Decisions" section this design adopts. Here: what the spec needs exactly, and the answers to
its open questions.

## Decisions

### 1. Node model

`jsonNodes(value, { expanded, groupSize, messages })` returns the visible tree as Tree View
collection items: `{ key, parentKey, hasChildren, type, label, depth }`. A container
(`object`, `array`, `map`, `set`, `error`) is a branch; its children are built only when its
key is in `expanded`. Keys are JSON Pointers (RFC 6901: `~` → `~0`, `/` → `~1`); the root
value's entries are the roots; a primitive root is one leaf with key `""`.

### 2. Types

`string`, `number` (incl. `NaN`, `±Infinity`, `-0`), `bigint`, `boolean`, `null`,
`undefined`, `object`, `array` (sparse: defined indexes only), `map`, `set`, `date` (ISO),
`regexp`, `error` (`name`, `message`, `stack`), `function`, `symbol`, `circular`, `range`,
and `instance` (any other object with a non-plain prototype: one leaf with its constructor's
name). Own enumerable string keys only.

### 3. Grouping

A container with more than `groupSize` (100) children shows range branches
`#first-last` (inclusive, over the defined indexes / entries), nested by `groupSize²`. Range
keys are `${pointer}#${first}-${last}`: never a valid property pointer.

### 4. Cycles

A container whose value is one of its ancestors' values is a leaf of type `circular`
(`messages.circular`). The same value elsewhere renders normally.

### 5. Text and names

`ItemText` renders `Key`, `Separator` (": ", read, so the name is "name: Ada"), `Value` or `Summary` and
`Preview`. The item's accessible name is its visible text: key, value, and for a container the
spoken summary (`messages.summary(type, count)`: "object, 4 entries") in a visually hidden span
while the glyph summary (`{4}`) is `aria-hidden`. `Preview` (first `maxPreviewItems` entries,
default 3) is `aria-hidden`. Strings are escaped (`\n`, `\t`, `"`) and quoted by the theme
(`data-quoted`), never clipped in the DOM.

### 6. Expansion

`defaultExpandedDepth` (1) applies to the first `data` only; later `data` keeps expansion by
key. `api.expandAll({ depth })` expands every container down to `depth` (default: one level
deeper than the deepest open container), stopping when 5000 nodes would be visible
(`maxExpandNodes`), so it can never materialise an unbounded value. Tree View's `*` expands
siblings as usual.

### 7. Copy

`Mod+C` on the focused item: the tree's native `copy` event, whose `clipboardData` gets the
text (synchronous, no permission); the optional `CopyTrigger` copies the highlighted item
through the Clipboard capability. Both report Clipboard's copy states and announcements. `copyFormat`: `"json"` (default: the subtree
serialised by `jsonStringify`, BigInt as digits, Map/Set as arrays of entries, a cycle → the
`error` state), `"value"` (a primitive's raw text), `"pointer"` (the key).

### 8. Attributes

Tree View's item attributes plus `data-type` (item and Value), `data-key` (the pointer),
`data-range` (group items), `data-empty` (empty containers), `data-quoted` (strings).

### 9. Open questions settled

- `expandAll` bounded as in §6. Search, editing, custom types: non-goals.
- BigInt from JSON text: a docs recipe (`JSON.parse` reviver with `context.source`), no helper.

### 10. Contract

Tree View's contract plus queries `nodeAt(pointer)` (the item's name), `valueText(pointer)`,
`summaryOf(pointer)`, `copyState`, and action `copy({ via: "keyboard" | "trigger" })`.
