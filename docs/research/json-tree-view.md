# JSON Tree View — research

Status: done · Wave: 3

A JSON Tree View shows a JavaScript value (a parsed API response, a store snapshot, a tool
call's arguments) as a tree the user can expand, collapse and read with the keyboard: each
object property and array element is a node showing its key, its value (or a short preview
of a nested value) and its type. Of the nine libraries only Ark/Zag ships one, as a thin
layer over its Tree View (`@zag-js/json-tree-utils` turns the value into tree nodes; Ark's
`JsonTreeView` renders them with the Tree View parts). The rest of the field is standalone
React and Vue viewers with no keyboard support and no tree semantics:
`react-json-view` (mac-s-g, unmaintained; continued as `@microlink/react-json-view`),
`react-json-tree` (Redux DevTools) and `vue-json-pretty`. rind-ui already owns the hard part:
Tree View (archived `add-tree-view`) with the APG tree, a flat DOM, set metadata from the
data, lazy children, virtualization and the collection's visible-node walk. This note
records how the others turn a value into a tree, the bugs that history shows, and the
decisions for `add-json-tree-view`, which is a Tree View over a JSON adapter, not a new
composite.

Builds on [tree-view.md](tree-view.md) (role, keys, focus, lazy children, virtualization,
its bug table), [collections.md](collections.md) (tree collection, keys), the `tree-view`
spec, [clipboard.md](clipboard.md) (the copy capability and its bug table),
[code-block.md](code-block.md) (token colours), and the cross-cutting notes
[accessibility.md](accessibility.md) §2 (names), §7 (announcements), §10 (hidden content)
and rules 4, 5, 7, 8, 29;
[assistive-tech-and-a11y-testing.md](assistive-tech-and-a11y-testing.md) "Tree / grid /
table"; [native-platform.md](native-platform.md) (`<details>` is not a tree).

Sources read (local shallow clones, 2026-10-26):

| Library | Files |
|---|---|
| Zag | `zag@4a2c1bb`: `packages/utilities/json-tree-utils/src/{json-to-tree,node-conversion,data-type,accessibility,types,shared}.ts`, `CHANGELOG.md`; `packages/machines/tree-view/src/tree-view.connect.ts` (branch and item props) |
| Ark | `ark@c7af88a`: `packages/react/src/components/json-tree-view/{json-tree-view-root,json-tree-view-tree,json-tree-view-node,json-tree-view-key-node,json-tree-view-value-node,use-json-tree-view,get-branch-value}.tsx/ts`, `examples/*`, `tests/json-tree-view.test.tsx`; `packages/solid/src/components/json-tree-view/`; `packages/{vue,svelte}/CHANGELOG.md` |
| react-json-view | `@microlink/react-json-view@ffd00ef`: `src/js/components/{DataTypes/Object,DataTypes/CircularReference,ArrayGroup,CopyToClipboard,VariableEditor,ObjectName}.js`, `helpers/{stringifyVariable,parseInput,util}.js` |
| react-json-tree | `redux-devtools@47a2bc3`: `packages/react-json-tree/src/{index,JSONNestedNode,JSONArrow,ItemRange,getCollectionEntries,JSONNode}.tsx/ts` |
| vue-json-pretty | `vue-json-pretty@42d534c`: `src/utils/index.ts` (`jsonFlatten`), `src/components/{Tree,TreeNode,Carets}/index.tsx` |
| rind-ui | `openspec/specs/tree-view/spec.md`, `core/src/collection/{tree,list,composite}.ts`, `docs/research/tree-view.md`, `docs/research/clipboard.md` |

Trackers searched (open and closed, 2026-10-26): chakra-ui/zag and chakra-ui/ark ("json",
"json tree", "JsonTreeView"), mac-s-g/react-json-view and microlinkhq/react-json-view (all
issues of the fork; the original by "large", "performance", "circular", "bigint",
"keyboard", "accessibility", "screen reader", "copy", "precision"), reduxjs/redux-devtools
("react-json-tree"), leezng/vue-json-pretty ("virtual", "large", "bigint", "big",
"number", "keyboard", "accessibility", "circular"). About 150 titles scanned, 35 opened and
read. Radix, Base UI, Headless UI, Ariakit, React Aria, Reka UI, Bits UI and Kobalte ship no
JSON viewer and have no open request for one.

## Pattern

- WAI-ARIA APG: [Tree View](https://www.w3.org/WAI/ARIA/apg/patterns/treeview/). A JSON
  viewer has no pattern of its own; it is a read-only tree whose nodes are properties. No
  selection and no checking are needed for reading. The APG "File directory treeview"
  example is the closest shape (branches = containers, leaves = primitives).
- Roles and attributes: those of Tree View, unchanged: `tree` (named) › `treeitem` siblings
  with `aria-level`, `aria-setsize`, `aria-posinset`, `aria-expanded` on containers only.
  The node's name is its visible text: key, separator, value or preview. No `aria-label`
  on a generic element (rule 4); see Accessibility.
- Keyboard: the APG tree keys (Tree View's map): Up/Down, Left/Right
  (collapse or parent / expand or first child), Home/End, `*` expands siblings, typeahead
  on keys. Nothing for Enter or Space by default (nothing to activate). Copy is
  `Mod+C` through the native `copy` event (see Decisions).

## How the others built it

| | Zag / Ark | react-json-view | react-json-tree | vue-json-pretty |
|---|---|---|---|---|
| Model | eager `jsonToTree` → node tree → Tree View collection | recursive components over the value | recursive components; children built on expand | `jsonFlatten` → one row per line (brackets included) |
| Tree semantics | `tree`/`treeitem`, nested `group` | none | none | none (carets `aria-hidden`) |
| Keyboard | Tree View keys, typeahead **off** | none | none | none |
| Node identity | hash of the key path joined with `.` | `namespace` array | key path array | path string `root.a[0]` |
| Circular values | global `visited` WeakSet | `[CIRCULAR REFERENCE]` row | ancestor list (`circularCache`) | hangs (vjp#108) |
| Big arrays | `groupArraysAfterLength` (100), one level of groups | `groupArraysAfterLength`, one level | nested ranges, `collectionLimit` 50, limit squared per level | virtual list, fixed row height |
| Types | 40+ (Map, Set, Date, BigInt, typed arrays, DOM, React elements, functions) | JSON + Date, function, NaN, regexp, big numbers | JSON + Map, Set, iterables, Date, functions | JSON only |
| Copy | none | per node, `JSON.stringify` | none | none |
| Edit | none | add, edit, delete | none | edit |
| Long strings | `collapseStringsAfterLength` (30) in the preview | toggle on click (`collapseStringsAfterLength`) | none | none |

### Zag.js / Ark UI

- Source: `json-to-tree.ts` (51 lines), `node-conversion.ts`, `data-type.ts` (1,652 lines,
  one entry per type: `check`, `node`, `description`, `previewText`, `previewElement`),
  `accessibility.ts`. Ark: `JsonTreeView.Root` (builds the collection with `useMemo([data])`),
  `JsonTreeView.Tree` (renders the root's children), `JsonTreeViewNode` (recursive: a
  `TreeView.Branch` for containers, `TreeView.Item` for leaves), `KeyNode`, `ValueNode`.
- API: `data`, `defaultExpandedDepth`, `maxPreviewItems` (3), `collapseStringsAfterLength`
  (30), `groupArraysAfterLength` (100), `showNonenumerable` (true), `quotesOnKeys`; on Tree,
  `arrow`, `indentGuide`, `renderValue(hastNode)`. Every Tree View prop passes through
  (`expandedValue`, `selectedValue`, `onExpandedChange`, …).
- Model: `getRootNode(data)` builds the **whole** node tree before rendering:
  `jsonToTree` walks every property of every object down to `MAX_DEPTH` (20). Each node
  is `{ value, type, keyPath, constructorName?, isNonEnumerable?, propertyDescriptor?,
  children? }`. Node identity is `hash(keyPath.join("."))` (a 32-bit DJB2 in base 36). The
  preview of a value is a HAST-like element tree (`{ type: "element", tagName, properties:
  { kind, nodeType }, children }`) that Ark renders as `span`s with `data-kind`
  (`brace`, `preview`, `constructor`, `colon`, …) and `data-type`.
- Notable:
  - **The JSON layer is an adapter over Tree View**: data in, tree collection out, every
    keyboard and expansion behaviour inherited. This is the right split and the one to keep.
  - **Expansion is keyed by path**, not by object identity, so a new `data` with the same
    shape keeps what was open.
  - A type registry (`dataTypes`, ordered, first `check` wins) makes the type list
    extensible and keeps each type's preview and description together.
  - Sparse arrays show only the defined indices (`Object.keys`), with `length` as a child.
  - `getAccessibleDescription` writes a sentence per node ("address: Object, expandable
    with 4 properties"; leaves: `name: "John"`; "circular reference").
  - Error `stack` strings get their own element (one line per frame).
- Problems (from the source, the changelogs and the tracker):
  - **Shared values are reported as circular.** `visited` is one WeakSet for the whole
    walk and nothing is removed when a branch is left, so an object referenced twice
    (`{ a: x, b: x }`, a normal DAG) shows `[Circular Reference]` the second time. The
    check must be against ancestors only (react-json-tree does that).
  - **Ids collide.** `keyPathToId` joins with `"."`, so the key `"a.b"` and the path
    `a` › `b` get the same id, and the same `value` in the collection. On top of that, a
    32-bit hash of the id can collide in a large tree and nothing detects it.
  - **Eager and unbounded.** The whole value is converted on every `data` change,
    including branches nobody opens. A 10 MB response is walked in full before the first
    paint. `MAX_DEPTH` turns deeper values into the **string** `"[Max Depth Reached]"`,
    indistinguishable from a real string.
  - **The accessible name replaces the text.** Ark puts the description in `aria-label`.
    On leaves it lands on the `treeitem`; on branches it lands on `BranchControl`, a
    generic `div` (rule 4 prohibits a name there). The spoken name differs from the
    visible text (WCAG 2.5.3 for voice control users) and is English-only, built in code
    with `"property"`/`"properties"` (rule 7).
  - **Devtools semantics by default.** `showNonenumerable: true` adds `length` to every
    array and `[[name]]` children for non-enumerable properties of plain objects: for a
    JSON response this is noise. The array's own `length` is a child row, not part of its
    summary.
  - **Interactive content in items.** The `renderValue` example renders an `<a href>`
    inside a `treeitem`, which tree-view.md rules out.
  - **Typeahead is off.** Ark sets `typeahead: false`, so a long object cannot be searched
    by key with the keyboard, though the APG recommends it.
  - Ark's `data-line` is `indexPath.reduce(sum) + 1`, which is not a line number
    (`[1, 0]` and `[0, 1]` both give 2).
  - React keys are child indexes (`key={index}`), so inserting a property re-mounts every
    following row.
  - Changelog fixes: the Vue and Svelte ports did not re-render when `data` changed and
    their `v-model`/`bind:` expansion did not sync ([ark#4153](https://github.com/chakra-ui/ark/issues/4153));
    `indent-guide` rendered nothing in Vue ([ark#4183](https://github.com/chakra-ui/ark/issues/4183));
    `RootProvider` forwarded the preview options to the DOM and rendered children twice.
    `groupArraysAfterLength` was added in 1.18.5 to cut DOM nodes.

### react-json-view (mac-s-g, microlink fork)

- Source: `DataTypes/Object.js` (381 lines) renders an object as a `div` with a clickable
  `span` brace and a recursive list of children; `ArrayGroup.js` splits big arrays into
  groups of `groupArraysAfterLength`; `VariableEditor.js` edits values in place;
  `CopyToClipboard.js` copies a node.
- API: `src`, `collapsed` (boolean or depth), `shouldCollapse(field)`,
  `collapseStringsAfterLength`, `groupArraysAfterLength`, `enableClipboard`,
  `onEdit`/`onAdd`/`onDelete`/`onSelect`, `displayDataTypes`, `displayObjectSize`,
  `quotesOnKeys`, `sortKeys`, `theme`, `bigNumber` (fork).
- Notable: the per-node copy button and the object size badge are what users ask for most;
  the fork added `bigNumber` (a class whose values are printed with `toString()`) after
  precision complaints.
- Problems:
  - No keyboard and no semantics at all: toggles are `span`s with `onClick`
    ([mac-s-g#355](https://github.com/mac-s-g/react-json-view/issues/355),
    [#454](https://github.com/mac-s-g/react-json-view/issues/454), open).
  - Copy: `JSON.stringify(value)` inside `try`, `""` on failure, and "copied" shown either
    way. A BigInt or a circular object copies an empty string while the checkmark appears.
    The fallback textarea is appended to `body` (the Chakra#414 modal bug of clipboard.md).
  - Eager render of every node; large inputs take seconds
    ([mac-s-g#235](https://github.com/mac-s-g/react-json-view/issues/235): 8,360 keys,
    ~15 s). The workaround in the thread is `shouldCollapse`, which only works because
    collapsed children are not rendered.
  - Grouping and collapse fight:
    [mac-s-g#363](https://github.com/mac-s-g/react-json-view/issues/363) (an array longer
    than the group size opens to its groups even when its depth says collapsed),
    [mac-s-g#346](https://github.com/mac-s-g/react-json-view/issues/346) (later groups
    cannot be collapsed), [microlink#92](https://github.com/microlinkhq/react-json-view/issues/92)
    (toggling one group toggles another),
    [microlink#90](https://github.com/microlinkhq/react-json-view/issues/90) (range labels
    "0 to 100, 100 to 200" for 200 items: the end is exclusive but reads inclusive).
  - Long strings: the collapse toggle sits on the text, so selecting part of a string
    toggles it and clears the selection
    ([mac-s-g#360](https://github.com/mac-s-g/react-json-view/issues/360)).
  - ISO-looking strings are turned into `Date`s automatically
    ([microlink#84](https://github.com/microlinkhq/react-json-view/issues/84)).
  - Instance ids from `Date.now()` collided between two viewers
    ([microlink#59](https://github.com/microlinkhq/react-json-view/issues/59)).

### react-json-tree (Redux DevTools)

- Source: `JSONNestedNode.tsx` renders a node and, only when expanded, its children through
  `getCollectionEntries`, which pages big collections into `ItemRange` nodes;
  `JSONArrow.tsx` is a `div` with `onClick`.
- API: `data`, `shouldExpandNodeInitially(keyPath, data, level)`, `collectionLimit` (50),
  `sortObjectKeys`, `postprocessValue`, `labelRenderer`, `valueRenderer`,
  `getItemString`, `isCustomNode`, `theme`, `invertTheme`.
- Notable:
  - **Children are built only when a node is expanded**: cost follows what is open, not
    the size of the value. This is the model rind-ui adopts.
  - **Circular detection by ancestors**: each child gets `circularCache: [...cache, value]`
    and is circular only if its value is one of its ancestors. A shared reference is shown
    twice, correctly.
  - **Nested ranges**: `getRanges` squares the limit until the ranges fit, so a
    1,000,000-item array opens to ranges of ranges (50 → 2,500 → …), never to 20,000
    siblings.
  - Iterables (Map, Set, generators) are walked lazily up to the limit, so an infinite
    iterable does not hang. Non-string Map keys become `{ "[key]", "[value]" }` entries.
- Problems:
  - No keyboard ([redux-devtools#527](https://github.com/reduxjs/redux-devtools/issues/527),
    open: users ask for the devtools Up/Down/Left/Right). No roles.
  - Sparse arrays longer than the limit crash with
    `Cannot read properties of undefined (reading 'to')`
    ([redux-devtools#1827](https://github.com/reduxjs/redux-devtools/issues/1827), open):
    ranges are computed over `length`, entries over the defined indices.
  - No full path in renderers
    ([redux-devtools#1546](https://github.com/reduxjs/redux-devtools/issues/1546), open);
    `keyPath` is reversed (`[key, ...parentPath]`).
  - `shouldExpandNode` ignored when props change on a mounted tree
    ([redux-devtools#468](https://github.com/reduxjs/redux-devtools/issues/468), closed
    unreproduced): initial expansion recomputed against stale state.
  - Large payloads still block the main thread without virtualization
    ([redux-devtools#1889](https://github.com/reduxjs/redux-devtools/issues/1889), open);
    a commenter notes the package relies on paging, not virtualization.
  - Maps once rendered empty in the DevTools serializer
    ([redux-devtools#496](https://github.com/reduxjs/redux-devtools/issues/496)).

### vue-json-pretty

- Source: `jsonFlatten` turns the value into one row per line, including opening and
  closing brackets (`arrayStart`, `arrayEnd`, `objectStart`, `objectEnd`), with `level`,
  `path` (`root.a[0]`, or `root["a b"]` without escaping quotes), `showComma`.
  `Tree/index.tsx` renders the rows, optionally in a fixed-height virtual list.
- API: `data`, `deep`, `pathCollapsible`, `virtual`, `height`, `itemHeight`,
  `dynamicHeight`, `selectableType` (radio/checkbox per row), `editable`, `showLineNumber`,
  `showLength`, `showDoubleQuotes`.
- Notable: the only one with virtualization and with a code-like layout (brackets on their
  own lines, commas, line numbers).
- Problems:
  - `jsonFlatten` of the whole value is the bottleneck: a 21 MB value stalls the page
    even with `virtual` ([vjp#138](https://github.com/leezng/vue-json-pretty/issues/138)).
  - A fixed `itemHeight` makes the virtual list jump with multi-line strings
    ([vjp#286](https://github.com/leezng/vue-json-pretty/issues/286)).
  - With virtualization, select-and-copy of the text cannot reach unmounted rows
    ([vjp#225](https://github.com/leezng/vue-json-pretty/issues/225), "expected").
  - Line numbers are selected along with the content
    ([vjp#256](https://github.com/leezng/vue-json-pretty/issues/256)).
  - String values were rendered as HTML (`{"error":"<h1>x</h1>"}` printed a heading)
    ([vjp#71](https://github.com/leezng/vue-json-pretty/issues/71)): an injection bug.
  - Circular objects hang the browser; the maintainer declined `toJSON()` support
    ([vjp#108](https://github.com/leezng/vue-json-pretty/issues/108)).

## Accessibility

Applying [accessibility.md](accessibility.md),
[assistive-tech-and-a11y-testing.md](assistive-tech-and-a11y-testing.md) and the Tree
View decisions:

- **It is a Tree View.** Role, flat DOM, set metadata, focus and keys are Tree View's,
  unchanged; the JSON layer only produces the collection and the item text. The VoiceOver
  and NVDA findings for flat trees in the tree-view manual protocol apply as they are.
- **Name = the visible text.** Each item's name is its `item-text` content: key, a
  separator and the value or the container's summary (`address: {4}`, `tags: [3]`,
  `age: 30`, `name: "John"`). No `aria-label` replacing it (Ark's): the spoken name matches
  what a voice control user reads (WCAG 2.5.3) and rule 4 is kept. Glyphs that read badly
  (`{`, `[`, `…`, `ƒ`) are `aria-hidden` and doubled by a visually hidden word from
  `messages` ("object, 4 properties", "array, 3 items"), through `core/dom/visually-hidden`
  (rule 29), so the summary is spoken in the component's language (rule 7).
- **Type is a description, not a name.** "string", "number", "null" are conveyed by the
  value's spelling (quotes, digits, `null`); the theme colours by type, but colour is never
  the only cue (WCAG 1.4.1): strings keep their quotes, `null`/`undefined`/`true`/`false`
  are words.
- **Keys and indexes.** Array elements are named by index (`0: "a"`); the index is text,
  not inferred from position, because `aria-posinset` starts at 1 and the index at 0, and
  sparse arrays skip indexes.
- **No interactive content in items** (tree-view spec). Values are text, never links or
  buttons; a URL is not auto-linked. Copy is not a button in the row: it is `Mod+C` on the
  focused item (the native `copy` event) and an optional Copy trigger outside the tree that
  acts on the highlighted node.
- **Long strings are clipped by CSS, not by code.** The full string stays in the DOM, so
  the accessible name, find-in-page and text selection all see it (react-json-view#360);
  the theme clips it to one line with an ellipsis. A JS-truncated string would give screen
  reader users no way to read the rest.
- **Announcements.** Expand/collapse is announced by the AT from `aria-expanded`. Copy
  results go through the Announcer ("Copied", "Copy failed"), as Clipboard does. Range
  groups ("[0 … 99]") are named with both ends inclusive ("items 0 to 99").
- **Forced colors and size.** As Tree View: a non-colour highlight cue, 24 px rows.
  Type colours fall back to `CanvasText` under `forced-colors`, which is acceptable because
  of the textual cues above.
- **Native platform.** No native JSON viewer. Firefox's built-in JSON viewer is a tree
  table with filtering; Chrome's devtools object view is the expected keyboard model
  (Up/Down/Left/Right, as redux-devtools#527 asks). `<details>` nesting is not a tree
  ([native-platform.md](native-platform.md)): no arrow keys, no typeahead.

## Bug history

"ZG" = chakra-ui/zag, "ARK" = chakra-ui/ark, "RJV" = mac-s-g/react-json-view, "MRJV" =
microlinkhq/react-json-view, "RDT" = reduxjs/redux-devtools (react-json-tree), "VJP" =
leezng/vue-json-pretty. Entries without a number come from the source (cited by file).

| Library | Issue | Symptom | Root cause | Fix / status | Lesson for rind-ui |
|---|---|---|---|---|---|
| ZG | `json-to-tree.ts` | an object referenced twice shows "[Circular Reference]" the second time | one `visited` WeakSet for the whole walk, never cleared on the way back | open (source) | circular = equal to an **ancestor** only; shared values render twice |
| ZG | `node-conversion.ts` | key `"a.b"` and path `a` › `b` are the same node | ids are the path joined with `"."`, then hashed (32-bit) | open (source) | keys are JSON Pointers (RFC 6901, `~0`/`~1` escapes): unique, readable, no hash |
| ZG | `json-to-tree.ts` | deep values appear as the string "[Max Depth Reached]" | eager walk capped at depth 20, sentinel stored as a string | open (source) | lazy materialisation: depth costs nothing until opened; no sentinel values |
| ZG / ARK | `json-tree-view-root.tsx` | big values are slow on every data change | the whole value is converted before render, branches nobody opens included | open (source) | build children only for expanded containers |
| ARK | `json-tree-view-node.tsx` | spoken name differs from the text; English only; name on a generic div for branches | description put in `aria-label`, built with English words in code | open (source) | name from visible text; summary words from `messages` (visually hidden) |
| ZG | `node-conversion.ts` (`showNonenumerable: true`) | `length` and `[[…]]` rows in plain JSON | devtools semantics by default | open (default) | own enumerable properties only; array length in the summary |
| ARK | `examples/render-value.tsx` | a link inside a treeitem | value renderer returns interactive content | example | values are text; development warning (tree-view spec) |
| ARK | `use-json-tree-view.ts` | no typeahead on keys | `typeahead: false` | open (by choice) | typeahead over the keys of visible nodes (APG) |
| ARK | `json-tree-view-node.tsx` (`data-line`) | wrong "line" numbers | sum of the index path | open (source) | no line numbers in the tree (see Open questions) |
| ARK | [#4153](https://github.com/chakra-ui/ark/issues/4153), changelog | Vue/Svelte: tree not updated when `data` changes; `v-model:expanded-value` stuck | adapters read `data` once; bindable not wired | fixed | every adapter reacts to a new `data` reference; contract test per framework |
| ARK | [#4183](https://github.com/chakra-ui/ark/issues/4183) | `indent-guide` renders nothing (Vue) | boolean prop only honoured with a custom slot | fixed | indentation from `aria-level` / `--level` in the theme; no per-row guide element |
| ARK | changelog (`RootProvider`) | preview options forwarded to the DOM; children rendered twice | provider spread its options | fixed | options never reach elements (connect owns the attributes) |
| RJV | [#355](https://github.com/mac-s-g/react-json-view/issues/355), [#454](https://github.com/mac-s-g/react-json-view/issues/454) (open) | not usable with a keyboard | `span` toggles, no roles | open | Tree View keys and roles |
| RDT | [#527](https://github.com/reduxjs/redux-devtools/issues/527) (open) | users want devtools arrow navigation | no keyboard model | open | APG tree keys are exactly the devtools keys |
| RJV | [#235](https://github.com/mac-s-g/react-json-view/issues/235) (open) | 8,360 keys take ~15 s to show | every node rendered | open (workaround `shouldCollapse`) | lazy children + virtualization from Tree View; benchmark scenario |
| RDT | [#1889](https://github.com/reduxjs/redux-devtools/issues/1889) (open) | large payloads block the UI | paging but no virtualization | open | both: lazy materialisation and Tree View's virtualized rendering |
| VJP | [#138](https://github.com/leezng/vue-json-pretty/issues/138) | 21 MB value stalls the page even virtualized | `jsonFlatten` of the whole value | closed | the walk itself must be lazy, not only the DOM |
| VJP | [#286](https://github.com/leezng/vue-json-pretty/issues/286) | virtual list jumps on multi-line strings | fixed `itemHeight` | closed | strings are one line (escaped `\n`, CSS clip); Tree View's virtualizer contract |
| VJP | [#225](https://github.com/leezng/vue-json-pretty/issues/225) | selecting text cannot reach unmounted rows | virtualization | "expected" | copy acts on the data (node or subtree), not on the DOM selection |
| RJV | [#363](https://github.com/mac-s-g/react-json-view/issues/363) (open), [#346](https://github.com/mac-s-g/react-json-view/issues/346) (open) | a long array opens to its groups when it should be collapsed; later groups cannot collapse | grouping applied before collapse; group state separate from the array's | open | groups are ordinary branches of the array, keyed by pointer + range, collapsed unless expanded |
| MRJV | [#92](https://github.com/microlinkhq/react-json-view/issues/92) | toggling one group toggles another | group identity not unique (cause not stated in the issue) | closed | group keys `"/items#0-99"`-style, unique per array and range |
| MRJV | [#90](https://github.com/microlinkhq/react-json-view/issues/90) | "0 to 100, 100 to 200" for 200 items | exclusive end printed as if inclusive | closed | labels with inclusive ends ("0 … 99"); spoken from `messages` |
| RDT | [#1827](https://github.com/reduxjs/redux-devtools/issues/1827) (open) | sparse array > 50 items crashes | ranges over `length`, entries over defined indices | open | ranges over the defined indices; sparse fixture above the group size |
| RJV | [#360](https://github.com/mac-s-g/react-json-view/issues/360) (open) | selecting part of a long string toggles it and clears the selection | toggle handler on the text | open | no toggle on strings; CSS clip; full text in the DOM |
| RJV | [#280](https://github.com/mac-s-g/react-json-view/issues/280), MRJV [#54](https://github.com/microlinkhq/react-json-view/issues/54), [#74](https://github.com/microlinkhq/react-json-view/issues/74), VJP [#275](https://github.com/leezng/vue-json-pretty/issues/275) | `123456789987654321` shown as `…320` | `JSON.parse` already lost the precision; the viewer cannot recover it | closed (use strings / `json-bigint`) | render `bigint` values exactly; document parsing with a reviver; never round-trip numbers |
| RJV | `CopyToClipboard.js` | BigInt or circular node copies `""` while "copied" shows | `JSON.stringify` throws, caught, empty string written, state set regardless | open (source) | own serializer: BigInt as digits, circular as an error; result decided by the write (clipboard.md) |
| RJV | `CopyToClipboard.js` | copy fails in a modal | fallback textarea appended to `body` | open (source) | reuse the Clipboard capability (`near` the trigger) |
| MRJV | [#84](https://github.com/microlinkhq/react-json-view/issues/84) | ISO-like strings shown as dates | automatic `new Date(string)` | closed (option requested) | strings stay strings; only `Date` objects are dates |
| VJP | [#71](https://github.com/leezng/vue-json-pretty/issues/71) | `"<h1>x</h1>"` rendered as a heading | value inserted as HTML | fixed | values are text nodes only; injection scenario |
| VJP | [#108](https://github.com/leezng/vue-json-pretty/issues/108) | circular value hangs the browser | no cycle check in the flatten | closed, declined | ancestor check (above) |
| RDT | [#1546](https://github.com/reduxjs/redux-devtools/issues/1546) (open), MRJV [#91](https://github.com/microlinkhq/react-json-view/issues/91) (open), RJV [#392](https://github.com/mac-s-g/react-json-view/issues/392) (open) | no way to get or copy a node's full path | path not exposed (or reversed) | open | the node key **is** its JSON Pointer; "copy path" is a copy format |
| RDT | [#468](https://github.com/reduxjs/redux-devtools/issues/468) | initial expansion ignored after props change | initial expansion recomputed per mount | closed, unreproduced | `defaultExpandedDepth` applies once; later data keeps the user's expansion by key |
| MRJV | [#59](https://github.com/microlinkhq/react-json-view/issues/59) | two viewers interfere | instance id from `Date.now()` | fixed | ids from the root id (rule 3) |
| RJV | [#454](https://github.com/mac-s-g/react-json-view/issues/454) comment | maintainers asked for roving focus and expanded state for SR | — | open | Tree View already does this |

## Known pitfalls

- **Eager conversion.** Every viewer that converts the whole value first (Zag, vue-json-pretty)
  is slow on big payloads, with or without a virtual DOM. Only children of expanded nodes
  may be built, and the visible-node walk must cost O(visible), not O(value).
- **Cycles versus sharing.** A global "seen" set reports shared references as cycles
  (Zag). Only an ancestor is a cycle. A cyclic node is a leaf labelled "circular" (from
  `messages`) that cannot be expanded.
- **Ambiguous paths.** Joining keys with `.` or `[]` collides on keys that contain those
  characters (Zag, vue-json-pretty). JSON Pointer escapes are the standard answer.
- **Numbers.** Precision is lost in `JSON.parse`, before the viewer. The viewer renders what
  it is given exactly (`bigint` as digits, `-0` as `-0`, `NaN`/`Infinity` as words) and the
  docs show how to keep big integers (strings or a reviver).
- **Grouping vs collapse.** Range groups are branches like any other: collapsed by default,
  keyed uniquely, labelled with inclusive ends, computed over defined indexes (sparse
  arrays), nested when one level of groups is still too many (react-json-tree).
- **Copy.** `JSON.stringify` throws on BigInt and cycles and drops `undefined`, functions
  and Map/Set contents. A copy must use the component's own serializer and report failure.
- **Text, not HTML.** Keys and values are text nodes; a value renderer gets values, not
  markup (vjp#71).
- **Long strings.** Truncation must not remove text from the DOM or put a toggle on it.
- **Data identity.** Adapters must react to a new `data` reference (ark#4153); in-place
  mutation is not observed (documented: treat `data` as immutable).

## Testing notes

- **Node**: the adapter is pure. `jsonTreeCollection(value, expanded)` is tested
  directly: keys, levels, set sizes, summaries, groups, cycles, sparse arrays, BigInt, `-0`,
  `NaN`, Map with object keys, Set, Date, `undefined` in objects and arrays, keys `""`,
  `"a.b"`, `"a/b"`, `"~"`. A property test: for random JSON, every visible node's key
  resolves back to its value with a JSON Pointer lookup, and keys are unique.
- **Performance budget** (Vitest bench, Node): building the visible collection for a 10 MB
  value with depth-1 expansion touches only the top-level entries. Expanding one branch of
  a 1,000,000-item array builds its range nodes, never the items.
- **Tree View contract**: the JSON view reuses the `tree-view` contract and driver
  (`expand`, `collapse`, `items()`, `isExpanded`), plus queries `nodeAt(pointer)`,
  `summaryOf(name)`, and the action `copy({ format })`.
- **Browser (three engines)**: axe on the examples (crisp, juicy, bare); Mod+C copies
  through the native `copy` event (`Part.copySelection()` already exists in the contract
  env); the real clipboard is read back only in Chromium (clipboard.md).
- **Adapters**: one test per framework that a new `data` reference re-renders and keeps the
  expansion of keys that still exist (ark#4153); Solid and Angular included.
- **Manual protocol**: VoiceOver and NVDA read "name: "John"" and "address, object, 4
  properties, collapsed, level 1, 1 of 5"; nothing is read twice (the visible glyph plus the
  hidden word).

## Decisions

- **A Tree View, not a new composite.** `add-json-tree-view` adds a JSON adapter in core
  (`json-tree/`) that produces a tree collection and the item text, and parts that render
  Tree View's parts. Keyboard, focus, expansion, virtualization, the contract and the
  driver come from `tree-view`, unchanged. No new machine: the JSON view uses Tree View's
  machine with selection `none` by default (selection and checking stay available, because
  they are Tree View props).
- **Lazy materialisation.** The adapter builds the collection from the value and the
  expanded keys: it descends only into expanded containers; a closed container is a branch
  (`hasChildren`) whose children are not built. Expanding rebuilds the visible part
  synchronously. This does not use `onLoadChildren` (no loading state, no announcement):
  the adapter, not a loader, provides children. Cost per expand is the size of what becomes
  visible. Tree View's virtualized rendering applies unchanged.
- **Keys are JSON Pointers** (RFC 6901): `""` is the root value, `/address/street`,
  `/tags/0`, `/a~1b` for key `"a/b"`, `/~0` for key `"~"`. Range groups get keys outside the
  pointer grammar (`/items#0-99`), so they can never collide with a property. Expansion is
  controlled by these keys, so it survives a new `data` with the same shape. The pointer is
  also the "path" users ask for.
- **Roots**: the top-level value's entries are the tree's roots (`aria-level` 1), no
  synthetic root node (ark#3438). A primitive top-level value renders one leaf.
- **Values**: JSON types plus the JS values a viewer meets in practice: `undefined`,
  `bigint` (digits, `n` suffix only in the theme's `::after`), `NaN`, `±Infinity`, `-0`,
  `Date` (ISO string), `Map` (entries; non-string keys shown as `[key]`/`[value]` pairs like
  react-json-tree), `Set` (indexed entries), `RegExp`, `Error` (`name`, `message`, `stack`),
  sparse arrays (defined indexes only, holes counted in the summary). Functions, symbols,
  DOM nodes and class instances render a one-line leaf with their type (no expansion of
  internals). Own enumerable properties only; no `showNonenumerable`. A `getEntries` hook
  can extend the type list later (open question).
- **Cycles**: a node whose value is one of its ancestors is a leaf with
  `data-type="circular"` and the text from `messages.circular`. Shared values render
  normally.
- **Large containers**: `groupSize` (100). A container with more children than `groupSize`
  shows range branches with inclusive ends, nested by `groupSize²` when needed
  (react-json-tree), computed over defined indexes.
- **Item text** (parts inside `item-text`): `Key` (property name or index; quotes are a
  theme choice, `data-quoted`), `Separator` (`:`, `aria-hidden` when the visually hidden
  summary already reads), `Value` (`data-type`: `string | number | bigint | boolean | null |
  undefined | object | array | map | set | date | regexp | error | function | circular |
  range`), `Summary` for containers (`{4}`, `[3]`, `Map(2)`; glyphs `aria-hidden`, the
  spoken form from `messages`), `Preview` (optional first entries, `maxPreviewItems` 3,
  `aria-hidden` because the children carry the same text when opened). Text nodes only;
  `renderValue(value, node)` may return text or non-interactive elements (development
  warning for focusables, from Tree View).
- **Strings**: escaped (`\n`, `\t`, `"`), one line, clipped by the theme with
  `text-overflow: ellipsis`; the full string is in the DOM and the name.
- **Copy**: `Mod+C` on the tree copies the focused node through the native `copy` event,
  and an optional `CopyTrigger` part outside the items copies the highlighted node. Both use
  the Clipboard capability and its copy state (`idle | copying | copied | error`,
  announced). Formats: `"json"` (the subtree serialized by the component: BigInt as digits,
  `undefined` dropped as `JSON.stringify` does, cycle → `error`, Map/Set as arrays of
  entries), `"value"` (a primitive's raw text, no quotes), `"pointer"` (the key). Default
  `"json"`.
- **Expansion defaults**: `defaultExpandedDepth` (1) applies to the first collection only;
  later `data` keeps the user's expansion by key. Tree View's `expandAll()` would
  materialise the whole value: the JSON view bounds it (`expandAll({ depth })`, default the
  current depth + 1) and the spec decides the cap; `*` expands siblings as in Tree View.
- **Typeahead** on: over the visible nodes' keys (APG).
- **Props**: `data`, `defaultExpandedDepth`, `groupSize`, `maxPreviewItems`, `renderValue`,
  `messages`, plus every Tree View prop (`expandedValue`, `onExpandedChange`, selection,
  `dir`, `lang`, virtualization).
- **`data-*`**: Tree View's item attributes plus `data-type` on the item and the Value
  part, `data-key` (the pointer), `data-range` on group items, `data-empty` on empty
  containers.
- **Contract**: Tree View's fragment plus `nodeAt(pointer)`, `valueText(name)`,
  `summaryOf(name)`, `copy({ format, via: "keyboard" | "trigger" })`, `copyState`.
- **Theme**: `json-tree-view.css` on the Tree View stylesheet: type colours from the code
  block token set (strings, numbers, keys, null/boolean), monospaced item text, indentation
  from `--level`, string clipping, range and circular styles, forced-colors fallbacks.
- **Deliberately different from the others, and why**:
  - Lazy materialisation (Zag and vue-json-pretty convert everything first).
  - JSON Pointer keys (Zag hashes an ambiguous dotted path).
  - Ancestor-only cycle detection (Zag flags shared values).
  - The visible text is the name (Ark replaces it with an English `aria-label`).
  - Typeahead on (Ark turns it off).
  - Own enumerable properties only (Zag shows non-enumerables by default).
  - Copy reports failure and serializes BigInt (react-json-view copies `""` and says
    "copied").
  - No line numbers and no brackets on their own rows: it is a tree, not a code block
    (vue-json-pretty is a line view; that is Code Block's job).

## Open questions

- **Line view.** A code-like layout (brackets on their own lines, commas, line numbers) is
  what vue-json-pretty users expect. It is not a tree (closing-bracket rows are not nodes).
  If needed, it belongs to Code Block with folding, not here.
- **Search/filter.** Tree View's filter keeps ancestors of matches; for JSON it would need
  to search unexpanded (unmaterialised) branches, which defeats laziness for big values.
  Deferred until a consumer asks; typeahead covers keys of visible nodes.
- **Editing** (react-json-view's add/edit/delete): out of scope; it needs interactive
  content in rows, which the tree pattern rules out (a treegrid or a form).
- **Custom types** (`getEntries` / a type registry like Zag's `dataTypes`): wait for the
  second consumer.
- **BigInt from JSON text.** `JSON.parse` revivers with `context.source` keep big integers
  where supported; whether the docs ship a helper (`parseJson(text)`) or only a recipe is
  decided with the spec.
- **Flat-tree speech for very wide objects** (thousands of keys at one level, grouped):
  verify on VoiceOver and NVDA that range branches read well ("items 0 to 99, collapsed").
