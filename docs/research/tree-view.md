# Tree View — research

Status: done · Wave: 3

A hierarchical list of nodes the user can expand, collapse, move through with the
keyboard and optionally select or check: file explorers, outlines, category filters,
sidebar navigation. Keys, selection, typeahead, tree collections and repair are
[collections.md](collections.md) and `add-collections`; this note covers what is
tree-specific: the role and DOM shape, expansion, lazy children, tri-state checking,
links, and what the pattern deliberately cannot contain. Grid List (interactive rows) is
the sibling note, [grid-list.md](grid-list.md).

Sources: shallow clones read 2026-10-14 (paths repo-relative): `zag` @ `055a34f` —
`packages/machines/tree-view/src/{tree-view.machine,tree-view.connect,tree-view.types}.ts`,
`utils/{expand-branch,checked-state}.ts`; `ark` @ `4529383` — `packages/react/src/components/tree-view`;
`reka-ui` @ `a3629f8` — `packages/core/src/Tree/{TreeRoot,TreeItem,TreeVirtualizer}.vue`;
`react-spectrum` @ `e04377c` — `packages/react-aria/src/tree/{useTree,useTreeItem}.ts`,
`packages/react-aria/src/gridlist/useGridListItem.ts`, `packages/react-aria-components/src/{Tree,NavigationTree}.tsx`.
APG [Tree View pattern](https://www.w3.org/WAI/ARIA/apg/patterns/treeview/) (fetched
2026-10-14). Reado `src/components/organisms/FileTree.tsx` + `fileTree/*` (read-only).
Bug history: `gh search issues` and a full title scan (`gh api repos/<r>/issues`) of
react-spectrum, zag, ark, reka-ui, headless-tree, react-arborist for `Tree`, `TreeView`,
`treegrid`, `TreeItem`; each cited issue was opened and read.

## Pattern

- WAI-ARIA APG: [Tree View](https://www.w3.org/WAI/ARIA/apg/patterns/treeview/) (and the
  [treegrid](https://www.w3.org/WAI/ARIA/apg/patterns/treegrid/) when rows need interactive
  content — see Decisions).
- Roles and attributes: `tree` (named) › `treeitem`; `aria-expanded` on parent nodes only
  ("end nodes must omit it, because including it would make them sound like parents");
  `aria-multiselectable` on the tree; `aria-selected` **or** `aria-checked`, "use one, not
  both" across the tree; `aria-level`, `aria-setsize`, `aria-posinset` "required on each
  node when the full node set isn't in the DOM" (virtualization, lazy children);
  `aria-current` is not part of the APG pattern but is how a navigation tree marks the
  current page (the APG navigation example uses `<a role="treeitem">`).
- Keyboard (vertical tree, APG): Right on a closed node opens it, on an open node moves to
  the first child, on an end node nothing; Left on an open node closes it, on a closed or end
  node moves to the parent, on a root nothing; Down/Up next/previous visible node without
  opening or closing; Home/End first/last visible node; Enter the default action (for
  parents often open/close; in a single-select tree without selection-follows-focus,
  selection); type-ahead (recommended for all trees); `*` expands all siblings. Multi-select
  (recommended model, no modifier needed to navigate): Space toggles selection, Shift+Down/Up
  moves and toggles, Shift+Space selects from the last selected, Ctrl+Shift+Home/End, Ctrl+A.
  Focus entry: the selected node, else the first node (multi-select: the first selected).

## How the others built it

### Ark UI / Zag

- Source: `zag/packages/machines/tree-view/src/*` (machine 692 lines, connect 529).
- API: `createTreeCollection({ rootNode, nodeToValue, nodeToChildren })` (dummy root
  required — ark#3438); parts `Root`, `Label`, `Tree`, `Branch`, `BranchControl`,
  `BranchTrigger`, `BranchIndicator`, `BranchText`, `BranchContent`, `BranchIndentGuide`,
  `Item`, `ItemText`, `ItemIndicator`, `NodeCheckbox`, `NodeRenameInput`. Controllables
  `expandedValue`, `selectedValue`, `focusedValue`, `checkedValue`; `selectionMode`
  (`single` default | `multiple`), `expandOnClick` (default `true`), `typeahead`,
  `canRename`/`onRenameComplete`, `loadChildren({ node, valuePath, indexPath, signal })`
  with a per-node `loadingStatus` map and `AbortController`s aborted on machine exit,
  `scrollToIndexFn` for virtualization.
- State model: states `idle` | `renaming`; navigation is one event per key
  (`NODE.ARROW_DOWN`, `BRANCH_NODE.ARROW_RIGHT`, `SIBLINGS.EXPAND`, …) with the shift/ctrl
  flags on the event; the visible nodes are a `computed` over a `visit({ skip })` walk of the
  collection and the expanded values, re-walked per keystroke.
- Notable: DOM is nested (`Tree` › `Branch` › `BranchContent role="group"` › items); the
  focus target is the node element (`tabIndex: focused ? 0 : -1`); `*`, `Cmd+A`, F2 rename;
  lazy children with abortable loads and `aria-busy`; tri-state checking through
  `toggleBranchChecked`; `aria-current="true"` on the selected item **and** `aria-selected`;
  `scrollToIndexFn` + `raf` focus for virtual lists. No `aria-setsize` / `aria-posinset`
  (only `aria-level`).
- Problems: focus re-entry went to the selected node even when hidden, so Tab skipped the
  tree (zag#1751, #1874); F2 default-on rename trapped navigation (zag#2760); shift-arrow
  selection cycled when `loop` was on (zag#2028); focused node not scrolled into view
  (zag#2596); inputs in items lost keys (zag#1627); a mandatory dummy root (ark#3438);
  parents not selectable by documentation gap (ark#2976).

### React Aria Components

- Source: `react-aria/src/tree/useTree.ts` (6 lines: `useGridList` + `role="treegrid"`),
  `useTreeItem.ts`, `gridlist/useGridListItem.ts`, RAC `Tree.tsx`, `NavigationTree.tsx`.
- API: `Tree` › `TreeItem` › `TreeItemContent` (render-prop for `isExpanded`, `hasChildItems`,
  `level`, `selectionMode`) with a `Button slot="chevron"` and `Checkbox slot="selection"`
  inside; `expandedKeys`/`defaultExpandedKeys`/`onExpandedChange`; `selectionMode`,
  `selectionBehavior`; `onAction`; `renderEmptyState`; `TreeLoadMoreItem` row; drag and drop;
  `disallowEmptySelection`; `keyboardNavigationBehavior` (`arrow` | `tab`, since 1.19);
  `NavigationTree` + `NavigationTreeItem` (links, `selectedRoute`, `data-current`,
  `data-current-ancestor`, selection forced to `none`).
- State model: `useTreeState` over a flattened `TreeCollection.withExpandedKeys`; the
  keyboard delegate walks visible rows; expansion keys handled in
  `useGridListItem.handleTreeExpansionKeys` (Right/Left, mirrored in RTL, and only when the
  row itself is focused — `allowsArrowNavigation` opens it to row children).
- Notable: **RA's Tree is a treegrid** (`role=treegrid` › `row` (`aria-level`, `aria-expanded`
  only when `hasChildRows`, `aria-posinset`, `aria-setsize`) › `gridcell`), a single-column
  grid, so a row may hold buttons, checkboxes and text fields; the maintainers' answer to
  "your keys differ from the APG tree" is exactly that (RA#9918). The expand chevron is a
  `role=button` (`excludeFromTabOrder`, `preventFocusOnPress`) labelled "Expand"/"Collapse"
  + the row name. Rows with `onAction == null`, no link and `selectionMode none` toggle on
  press/Enter. Flat DOM (rows are siblings; level via `aria-level`).
- Problems: nested interactive content fights the grid keys (RA#7552 typeahead steals input
  focus, RA#8112/#4674 space eaten); chevron trapped Tab (RA#8111); two clicks to expand when
  controlled (RA#8263); `hasChildItems` without rows not expandable (RA#10659); focus on
  empty tree (RA#10660); `autoFocus` with a selected key under a collapsed parent
  (RA#10645); falsy keys dropped (RA#9991); `'all'` expanded keys crash (RA#8615); no
  cascade selection (RA#6589, #9072); Autocomplete cannot filter a Tree (RA#10664); 70k-item
  performance (RA#9626).

### Reka UI

- Source: `reka-ui/packages/core/src/Tree/{TreeRoot,TreeItem,TreeVirtualizer}.vue`, `utils.ts`.
- API: `TreeRoot` (`items`, `getKey`, `getChildren`, `v-model`, `expanded`, `multiple`,
  `selectionBehavior`, `propagateSelect`, `bubbleSelect`, `loop`, `dir`, `disabled`), a
  scoped slot of `flattenItems`; `TreeItem` per flattened item; `TreeVirtualizer`.
- State model: items are flattened by the root (`flattenItems(items, level, parent)`) with
  `aria-setsize`/`aria-posinset` computed from the sibling array; roving focus (`RovingFocusGroup`),
  typeahead through the shared `useTypeahead`; `isKeyDownInFormField` skips `input`,
  `textarea`, `select`, contenteditable (so inline rename works).
- Notable: `role=tree` on a `ul`, `role=treeitem` (flat, no `group`), `aria-level`,
  `aria-setsize`, `aria-posinset`, `aria-expanded` only when `hasChildren`; tri-state through
  `propagateSelect` (parent selects descendants) and `bubbleSelect` (children set the parent
  indeterminate/checked); `data-indent`.
- Problems: deep reactive watch on the selection stalls the main thread (reka#2962); a tree in
  an accordion lost roving focus (reka#1997); parent indeterminate only one way until
  `bubbleSelect` (reka#1458); no disabled items until asked (reka#2528); no async children
  (reka#1379), no treegrid (reka#1866), virtualizer needs fixed item height (reka#1561).

### Others (read for ideas, not in the matrix)

- **headless-tree** (lukasbach): framework-agnostic "features" composed over a flat item
  list; focus held in a `focusedItem` state defaulting to the first item; hotkeys feature
  with a key map; `aria-expanded` missing until reported (ht#171), shift-range start wrong
  (ht#176), focus broke under dynamic row heights (ht#87), search limited to expanded nodes
  (ht#190).
- **react-arborist**: virtualized, rows rendered by the consumer, drag and drop built in;
  `Meta+Click` only for multi-select on Windows (arborist#303), no way to name the tree until
  asked (arborist#325), whole-tree focus after clicking empty space (arborist#233), checkbox
  and indeterminate state still a tracking issue (arborist#352).
- **Primer / MUI X**: not mined (search rate limit); the cascade-checkbox model is the same
  as Reka's `propagateSelect`/`bubbleSelect`.

## Accessibility

Apply [accessibility.md](accessibility.md) and
[assistive-tech-and-a11y-testing.md](assistive-tech-and-a11y-testing.md) ("Tree / grid /
table").

- **Role choice is the central a11y decision.** `tree`/`treeitem` children are not
  presentational, but interactive descendants of a `treeitem` break the tree's own keys
  (Space typed into an input, typeahead stealing focus, Tab trapped in a chevron) and AT
  support for nested focusables is poor. The two honest answers are RA's (a single-column
  `treegrid`, so rows may contain controls) and APG's (a plain `tree`, no controls inside).
  We ship the APG tree and **no interactive content in an item**, because the expand
  indicator and the checkbox can be presentational (`aria-hidden`) with pointer handlers on
  the row and the state carried by `aria-expanded`/`aria-checked`. Rows that need a menu
  button or an inline edit belong to the treegrid — Table's expandable rows (`add-table`) or
  Grid List — not here. A development warning flags a focusable descendant (same check as
  link-navigation's "Interactive Content Warning"). Note on [ZG#3431](https://github.com/chakra-ui/zag/issues/3431):
  the cross-cutting note summarises it as "Zag shipped a treegrid"; read, it is a feature
  request ("Every consumer forced to hand-roll treegrids, one of the most mistake-prone APG
  patterns"), closed 2026-10-10 with a pointer to the v2 tree view. The lesson stands (treegrid
  is easy to get wrong) but nothing shipped from it.
- **Flat versus nested DOM.** APG nests children in a `group`; RA and Reka render a flat list
  with `aria-level`/`aria-setsize`/`aria-posinset`. Flat is the only shape a virtualizer can
  produce, it makes the visible-node walk trivial, and ARIA defines level semantics for it.
  Cost: some AT announce group item counts ("3 items") only for nested groups. This is
  **unverified on real hardware** and is the first item of the manual protocol (VoiceOver
  macOS/iOS with Safari and Chrome, NVDA + Firefox/Chrome, JAWS, TalkBack): a prototype with
  both shapes, behind the connect layer, before the spec is frozen.
- **Selection vs check.** `aria-selected` for selectable trees, `aria-checked` (with `mixed`)
  for checkable ones, never both (APG). In a checkable tree the highlight is not selection.
- **Names.** The tree is named (Label part / `aria-label`); each item is named by its text,
  not by indicators or badges (`aria-hidden` on presentation parts); the Reado file tree's
  status badges (`role=img` with a label) are acceptable inside a treeitem as non-interactive
  descriptions and should use `aria-describedby`, not the name.
- **Busy and announcements.** A lazily loading branch gets `aria-busy`; the result is
  announced through the announcer ("Loading {name}", "{n} items loaded") because focus does
  not move. Expansion is announced by the AT from `aria-expanded` on the focused item; to be
  verified on VoiceOver (Safari), which is known to be inconsistent for `aria-expanded`
  changes on the focused element.
- **Focus rules**: one Tab stop (the highlighted visible node; never a node hidden by a
  collapsed ancestor — zag#1751/#1874); DOM focus on the row (roving), so the focus ring is
  the row; Home/End/PageUp/PageDown `preventDefault` (RA#10720).
- **Forced colors, target size**: selected and highlighted rows need a non-colour cue under
  `forced-colors` (border or `SelectedItem`/`Highlight` system colours); rows ≥ 24 px tall
  (WCAG 2.5.8) and the indicator hit area ≥ 24 × 24 through `--rind-hit-area`; indentation
  never carries meaning alone (level is in `aria-level`). RTL mirrors Left/Right and the
  chevron.
- **Native platform** ([native-platform.md](native-platform.md)): no native tree. `<details>`
  nesting is a disclosure tree (Collapsible-based), not the tree pattern; it has no arrow
  navigation, typeahead or selection. `<a>` is native for links (right click, middle click:
  RA#7985).

## Bug history

Open and closed. "RA" = adobe/react-spectrum, "ZG" = chakra-ui/zag, "ARK" = chakra-ui/ark,
"RK" = unovue/reka-ui, "HT" = lukasbach/headless-tree, "AR" = brimdata/react-arborist.

| Library | Issue | Symptom | Root cause | Fix / status | Lesson for rind-ui |
|---|---|---|---|---|---|
| RA | [#9918](https://github.com/adobe/react-spectrum/issues/9918) closed | Left/Right on a leaf or open node move to a checkbox instead of the APG child/parent | Tree is a treegrid: Left/Right traverse row children | Closed: "implements TreeGrid ... to enable interactive content" | Our tree has no row children, so APG keys apply unchanged (scenarios) |
| RA | [#9546](https://github.com/adobe/react-spectrum/issues/9546) closed | Left on a leaf/collapsed node does nothing, so collapsing up needs many ArrowUp | Collapse key only collapsed | Parent navigation added | Collapse on leaf/closed moves to parent (collections rule, scenario) |
| RA | [#3719](https://github.com/adobe/react-spectrum/issues/3719) closed | Windows Narrator reaches only the mounted nodes of a virtualized tree | Virtualization removes nodes from the AX tree | Closed, no change | `aria-level/setsize/posinset` always; document the limit; manual protocol |
| RA | [#8111](https://github.com/adobe/react-spectrum/issues/8111) closed | Tab stuck on the chevron of a non-selectable branch | Expand button got `tabindex=0` | Fix: `excludeFromTabOrder` | Indicator is never focusable (not a button) |
| RA | [#10659](https://github.com/adobe/react-spectrum/issues/10659) closed | Branch with `hasChildItems` but no rows: no `aria-expanded`, cannot expand (lazy) | Expandability derived from rendered rows | Closed: supply empty `items` | `isBranch` accessor, independent of loaded children (scenario) |
| RA | [#10660](https://github.com/adobe/react-spectrum/issues/10660) closed | Focus on the empty tree; rows arrive; ArrowDown does nothing | Empty-state props replaced the collection focus handlers | Fixed | Empty tree: container is the Tab stop and the first arrival is reachable (collections) |
| RA | [#10645](https://github.com/adobe/react-spectrum/issues/10645) open | `autoFocus` with a selected key under a collapsed parent focuses the tree; ArrowDown skips row 1 | First selected key not checked for visibility | Open | Tab stop / initial highlight chosen among visible nodes only (scenario) |
| RA | [#8709](https://github.com/adobe/react-spectrum/issues/8709) open | With `disallowEmptySelection` touch users stay in selection mode forever | Mode exit = empty selection | Left to the app | Touch toggling follows collections; no implicit mode, so nothing to exit |
| RA | [#6589](https://github.com/adobe/react-spectrum/issues/6589) open, [#9072](https://github.com/adobe/react-spectrum/issues/9072) closed dup | No parent/child cascade; parents "feel unrelated"; should the value include parents? | Not implemented; apps patch the package | Open | Built-in tri-state `checkable` with leaf-only values (scenarios) |
| RA | [#6442](https://github.com/adobe/react-spectrum/issues/6442) closed, [#9758](https://github.com/adobe/react-spectrum/issues/9758) closed | Items cannot reach tree state; no sibling position for connector lines | Collection hidden behind internal state | `collection` via render-prop state | Item render context exposes `level`, `posInSet`, `setSize`, `isLast`, `parentKey` |
| RA | [#7985](https://github.com/adobe/react-spectrum/issues/7985) closed | Link items cannot be right-clicked as links | Row is a `div`, no anchor | Explained: roles of tree children | `<a role="treeitem" href>` is valid; render a real anchor |
| RA | [#8615](https://github.com/adobe/react-spectrum/issues/8615) closed | `expandedKeys="all"` crashes (`.has` missing) | One code path missed the sentinel | "Not supported" | No `"all"` sentinel for expansion; `expandAll()` action instead |
| RA | [#8263](https://github.com/adobe/react-spectrum/issues/8263) open | Controlled expansion needs two clicks after load | Row remounted on first interaction | Open | Row identity stable across controlled updates (browser test) |
| RA | [#7552](https://github.com/adobe/react-spectrum/issues/7552) closed | Typeahead steals focus from an input inside an item | Collection handled key events from descendants | Duplicate of grid edit mode | Keys from editable targets ignored (scenario) |
| RA | [#7372](https://github.com/adobe/react-spectrum/issues/7372) open | `selectionMode=none`: Space does not trigger `onAction` | Space = selection only | Open | Space has no action; Enter activates (APG); documented |
| RA | [#9626](https://github.com/adobe/react-spectrum/issues/9626) closed | 70k-item tree: 300–500 ms per click, focus rerenders all | State changes re-render every row | Not reproduced fully | Per-item selectors (collections): a move re-renders two rows |
| RA | [#8725](https://github.com/adobe/react-spectrum/issues/8725) closed | Expand all in a big tree crashes the page | Children given outside `items`, so all nodes built eagerly | Use `items` | Data-driven collection; expansion bounded by visible nodes (benchmark) |
| RA | [#8179](https://github.com/adobe/react-spectrum/issues/8179) closed | Virtualized tree scrollbar jumps when expanding | `display:flex` on the tree defeated estimated heights | Reporter's CSS | Theme: no flex on the tree; row height token; recipe |
| RA | [#9991](https://github.com/adobe/react-spectrum/issues/9991) closed | Items with key `0` or `""` vanish | Falsy check on keys | Fixed | `key != null`; test with `"0"` and `""` |
| RA | [#1525](https://github.com/adobe/react-spectrum/issues/1525) closed | Expanding in uncontrolled mode did not rebuild the collection: no prev/next keys, keyboard dead on new children | Collection cache not keyed by `expandedKeys` | Fixed | Visible collection derived from expanded keys (collections); expand scenario |
| RA | [#10664](https://github.com/adobe/react-spectrum/issues/10664) open | Autocomplete does not filter a Tree | Tree ignored the selectable-collection context | Open | `filter` keeps ancestors of matches (collections tree derivation; scenario) |
| RA | [#10204](https://github.com/adobe/react-spectrum/issues/10204) closed | Unslotted Checkbox in a portalled dialog under a TreeItem throws | Slot context leaked through React tree | Fixed | No context-slot magic; indicator parts are explicit |
| RA | [#9572](https://github.com/adobe/react-spectrum/issues/9572) closed | Tree in a popover in a modal: selecting closes the modal when the popover animates out | Press-start selection + exit animation click-through | Explained | Selection on press up for popup uses (`shouldSelectOnPressUp` option) |
| RA | [#10276](https://github.com/adobe/react-spectrum/issues/10276) open | `aria-disabled` not forwarded, so a focusable disabled item is impossible | Prop filtered | Open | `focusableWhenDisabled` emits `aria-disabled` |
| ZG | [#1751](https://github.com/chakra-ui/zag/issues/1751) closed | Re-entering the tree focuses the selected node, even inside a collapsed branch: Tab skips the tree | Tab stop = selection regardless of visibility | Fixed | Tab stop is a visible node (scenario) |
| ZG | [#1874](https://github.com/chakra-ui/zag/issues/1874) closed | Collapse the parent of the focused/selected child, Tab away, Shift+Tab: tree unreachable | Same | Duplicate of #1751 | Same scenario, repair to the visible ancestor |
| ZG | [#2028](https://github.com/chakra-ui/zag/issues/2028) closed | Shift+Down at the end wrapped and inverted the selection; Ctrl+Up/Down do nothing | Looping tree + APG "recommended" multi-select model | Loop disabled for trees | `loop` default false for trees; recommended model, alternative model not shipped |
| ZG | [#2596](https://github.com/chakra-ui/zag/issues/2596) closed | Focused node not scrolled into view | Focus did not scroll in a custom container | Fixed | Scroll on navigation only (collections) with `block: nearest` |
| ZG | [#2760](https://github.com/chakra-ui/zag/issues/2760) closed | F2 locked navigation inside the node | Rename on by default | Opt-in `canRename` | No built-in rename; unknown keys bubble (scenario) |
| ZG | [#1787](https://github.com/chakra-ui/zag/issues/1787) closed | Programmatic `select` ignored single mode | Appended instead of replacing | Fixed: last value wins + warn | Single-mode selection never exceeds one key, even controlled |
| ZG | [#1627](https://github.com/chakra-ui/zag/issues/1627) closed | Input inside an item only accepts "a" | Typeahead preventDefault on every character | Fixed | Ignore keys from editable targets (scenario) |
| ZG | [#2582](https://github.com/chakra-ui/zag/issues/2582) closed | `collection.filter` removed the `children` key of a branch with no matches | Mutated node shape | Fixed | Filter returns branches with `children: []` retained as branches (isBranch survives) |
| ZG | [#3431](https://github.com/chakra-ui/zag/issues/3431) closed | "Every consumer forced to hand-roll treegrids" | No treegrid in Zag | Closed with a v2 pointer | Out of scope here; Grid List / Table own treegrid (Decisions) |
| ARK | [#3438](https://github.com/chakra-ui/ark/issues/3438) closed | A flat top level needs a dummy root node | Collection model requires one root | "Use a dummy root for now" | Tree collection takes a list of roots (collections `createTreeCollection`) |
| ARK | [#2976](https://github.com/chakra-ui/ark/issues/2976) closed | "Cannot select nodes that have children" | Branch click only toggled | Docs / `expandOnClick` | Branch press selects *and* (option) expands; both documented |
| ARK | [#2532](https://github.com/chakra-ui/ark/issues/2532) closed | `defaultSelectedValue` froze the selected state | Default treated as controlled | Fixed | Controllable `value`: default is initial only (foundations) |
| ARK | [#4181](https://github.com/chakra-ui/ark/issues/4181) closed | F2 shows the rename input but does not focus it (Vue) | Focus effect ran before render | Fixed | Rename is consumer-owned; Tree restores focus to the row when asked (`focusItem`) |
| RK | [#1458](https://github.com/unovue/reka-ui/issues/1458) closed | Parent indeterminate only when selecting parent first, then a child | One-directional propagation | `bubbleSelect` added | Derived tri-state: parent state is a function of leaves, both directions (scenario) |
| RK | [#1997](https://github.com/unovue/reka-ui/issues/1997) closed | Roving focus broke for a Tree inside an Accordion | Nested roving groups | Closed | Own the Tab stop in the machine, not a shared roving DOM group |
| RK | [#2962](https://github.com/unovue/reka-ui/issues/2962) open | Deep watch on the selection model freezes large trees | Deep reactive traversal of node objects | Open | Keys only in the snapshot; no node objects in state (collections) |
| RK | [#2528](https://github.com/unovue/reka-ui/issues/2528) closed | Cannot disable tree items | Missing prop | Added | Per-node `disabled`; subtree not implied (scenario) |
| RK | [#1379](https://github.com/unovue/reka-ui/issues/1379) open | No async children | `getChildren` is synchronous | Open | `onLoadChildren` with status, once per branch (scenario) |
| RK | [#1866](https://github.com/unovue/reka-ui/issues/1866) open | Request: `treegrid` | Tree only | Open | Not here; pointer to Table/Grid List |
| RK | [#1561](https://github.com/unovue/reka-ui/issues/1561) open | Virtualizer: no dynamic heights/animation | Fixed-size virtualizer | Open | We ship no virtualizer; contract + recipe |
| HT | [#171](https://github.com/lukasbach/headless-tree/issues/171) closed | `aria-expanded` missing | Not emitted | Fixed after a contributor PR | Contract invariant: expandable ⇔ `aria-expanded` present |
| HT | [#176](https://github.com/lukasbach/headless-tree/issues/176) closed | Shift-click range started from the last selected item | Anchor was the last selection | Reworked (maintainer; user still saw old behaviour) | Internal anchor (selection-model) — already specified |
| HT | [#148](https://github.com/lukasbach/headless-tree/issues/148) closed | `focusedItem` state `null` but first item focused; arrows dead until selected | Focus state defaults to first item; keys attached to selection | Explained | One highlighted-key source of truth; arrows work from the tab stop |
| HT | [#87](https://github.com/lukasbach/headless-tree/issues/87) closed | Keyboard focus stops with dynamic row heights | Virtualizer measured rows; next row not mounted | Closed | Navigation on data, scroll through `scrollToIndex`, then focus on mount (collections) |
| HT | [#190](https://github.com/lukasbach/headless-tree/issues/190) closed | Search only found expanded nodes | Search over visible nodes | Fixed | Typeahead is over visible nodes (APG); filter is over all loaded nodes with auto-expand — different features |
| AR | [#303](https://github.com/brimdata/react-arborist/issues/303) closed | Multi-select used `metaKey` only: broken on Windows | Platform assumed | PR | Platform `mod` from the environment (selection-model) |
| AR | [#233](https://github.com/brimdata/react-arborist/issues/233) open | Clicking empty space then Shift focuses the whole tree | Container focusable and key handler on it | Open | Container is focusable only when empty; clicks on blank space highlight the nearest/current row |
| AR | [#325](https://github.com/brimdata/react-arborist/issues/325) closed | No way to name the `role=tree` | Hardcoded attributes | Added | Tree requires a name; `aria-label`/`aria-labelledby` forwarded; dev warning |
| AR | [#291](https://github.com/brimdata/react-arborist/issues/291) closed | Selection background cut off when scrolled horizontally | Row narrower than content | Consumer renders the row | Theme: rows `min-inline-size: fit-content` on a scroller; recipe |
| AR | [#352](https://github.com/brimdata/react-arborist/issues/352) open | Checkbox selection with indeterminate parents still a tracking issue | Not built in | Open (title only; not opened further) | Confirms the demand for built-in tri-state |

## Known pitfalls

- **Tab stop vs visibility** (ZG#1751, #1874, RA#10645): every "initial or restored focus"
  rule (selected, first selected, last highlighted) must be evaluated over the *visible*
  collection, and a highlight that becomes hidden repairs to the nearest visible ancestor.
- **Keys inside items** (RA#7552, ZG#1627, #2760, reka's `isKeyDownInFormField`): the tree
  ignores events whose target is an editable element or whose key is not in its map, and
  never `preventDefault`s a key it does not handle (Reado binds F2, Delete, ⌘C/X/V itself).
- **Expandability is not "has loaded children"** (RA#10659, ZG#2582): an empty or unloaded
  branch is still a branch.
- **Cascade state must be derived, not stored per click** (RK#1458, RA#6589).
- **Virtualization**: AT reaches only mounted nodes (RA#3719) and the scroll height changes
  when expanding (RA#8179); `aria-setsize` and `aria-posinset` are not optional.
- **Safari / VoiceOver**: `aria-expanded` changes on the focused element and treeitem level
  announcements vary by browser; verified only by the manual protocol.
- **Pointer vs keyboard expand**: the chevron click must not move DOM focus off the row and
  must not select (RA's `preventFocusOnPress`).

## Testing notes

- Props classes: single, multiple, none; `toggle` / `replace`; checkable; lazy; links; RTL;
  virtualized; disabled items; empty. Fixtures: three levels, a leaf at root, an empty
  branch, a branch whose only child is disabled, a lazily loaded branch with a failing and a
  succeeding loader, keys `"0"` and `""`, duplicate item names in different folders.
- Driver: find nodes by accessible name or by name path (`["src", "index.ts"]`) because
  names repeat across folders; `expand`, `collapse`, `check` need the node visible, so the
  driver expands ancestors through the keyboard path first.
- Expansion is observable through `aria-expanded`; busy through `aria-busy`; announcements
  through the recording announcer. Lazy loading uses a controllable loader in the fixture
  (resolve, reject, never resolve).
- Hard to test: real AT output for flat trees (manual protocol); scroll-into-view in a
  virtualized fixture (browser mode).

## Decisions

- **Parts**: `Root`, `Label`, `Tree` (`role=tree`), `Item` (the `treeitem`, leaf or branch),
  `ItemIndicator` (expand chevron, `aria-hidden`, pointer toggles expansion), `ItemCheckbox`
  (presentational check indicator, `aria-hidden`), `ItemText`, `Loading` (visual while a
  branch loads; `aria-hidden`), `Empty`. No `Branch`/`BranchContent`: the DOM is flat.
- **Role and shape**: `tree` › `treeitem` siblings, flat, with `aria-level`, `aria-setsize`,
  `aria-posinset` on every item and `aria-expanded` on branches only. No interactive
  content inside an item (APG). Treegrid is out of scope.
- **Data**: a tree collection (`createTreeCollection`), rendered through a render function
  over the **visible** nodes (virtualization-ready). Static nested JSX is deferred (open
  question).
- **Machine**: states `idle` | `focused` (as Listbox); collection events plus `EXPAND_SIBLINGS`,
  `EXPAND_ALL`, `COLLAPSE_ALL`, `CHECK`, `ACTION`, `CHILDREN.REQUESTED/SETTLED`,
  `FOCUS_ITEM`. Controllables: `value` (selection), `expandedValue`, `checkedValue`.
- **Keyboard**: APG keys; `*` expands siblings; typeahead over visible nodes; Space selects /
  toggles (or toggles the check); Enter = link → `onAction` → selection → toggle expansion;
  Shift+Arrow / Shift+Space / Ctrl(⌘)+A in multiple mode; `loop` false; unknown keys bubble.
- **Selection**: `none` | `single` | `multiple`, `toggle` | `replace` (collections); `checkable` is
  a separate axis (`aria-checked`) and excludes selection. Checked values are leaves only
  when propagation is on.
- **Lazy children**: node `hasChildren` flag + `onLoadChildren(key, { signal })`, status per key
  (`loading` | `error`), `aria-busy`, once per branch (collection-model "Trees"), retry after
  error on the next expand, abort on collapse/unmount, polite announcements.
- **Links**: `href` on an item renders `<a role="treeitem">` through link-navigation
  (`current` → `aria-current`); documented caution that site navigation prefers a disclosure
  navigation.
- **`data-*`**: collection item attributes + `data-expanded`/`data-state`, `data-branch`,
  `data-level`, `data-loading`, `data-error`, `data-checked`/`data-indeterminate`,
  `data-current`, `data-selection-mode`.
- **Contract**: collection fragment (`itemRole: "treeitem"`, roving) + actions `expand`,
  `collapse`, `toggle`, `check`, `expandSiblings`, `act`; queries `items()`, `isExpanded`,
  `expandedNames()`, `isBusy`; traits `composite-roving`, `disclosure` (branch ↔ `aria-expanded`
  only; no controls element), `selectable`, `set-metadata`.
- **Deliberately different**: APG tree not RA's treegrid; flat DOM unlike Zag/Ark; no rename,
  no drag and drop in this change; checked values are leaves; `loop` false; focus rule over
  visible nodes; no `"all"` sentinel for expansion; no `Branch`/`BranchContent` parts.

## Open questions

- Flat versus nested (`group`) DOM on real AT — manual protocol before implementation.
- Static nested JSX items (RAC `TreeItem` children): do we need it, or is data + render
  function enough (Reado's tree is data)?
- Whether `aria-expanded` on the focused item is announced by VoiceOver Safari without an
  extra announcement.
- Select all in a tree: visible nodes only (decided) — confirm with Reado's multi-select use.
- `Meta`/`Ctrl` handling for pointer multi-select is platform `mod` (AR#303); confirm on
  touch with the toggle rule.
