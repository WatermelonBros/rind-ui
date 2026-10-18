## Why

File explorers, outlines, category filters and sidebars need a tree: expand and collapse,
APG keys, typeahead, selection or tri-state checking, lazily loaded branches. The bug
history repeats the same failures in every library: the Tab stop landing on a node hidden
by a collapsed parent (zag#1751, #1874), typeahead and Space stolen from inputs (RA#7552,
zag#1627), unexpandable empty or unloaded branches (RA#10659), one-directional parent
indeterminate state (reka#1458), keys that diverge from the APG because the tree is really a
treegrid (RA#9918). Reado's `FileTree` makes several of them (no `aria-level`/roving focus,
buttons beside treeitems, no Right/Left child/parent moves) and will migrate.

Research: [tree-view](../../../docs/research/tree-view.md) (sources, Bug history,
Accessibility, Decisions) · [collections](../../../docs/research/collections.md) ·
[grid-list](../../../docs/research/grid-list.md) (the interactive-rows sibling) ·
[accessibility](../../../docs/research/accessibility.md) ·
[assistive-tech-and-a11y-testing](../../../docs/research/assistive-tech-and-a11y-testing.md)
("Tree / grid / table") · [native-platform](../../../docs/research/native-platform.md)

**Depends on** `add-foundations` and `add-a11y-foundations` (archived: runtime,
controllables, contracts, drivers, press, keyboard, announcer, quirks, invariants),
`add-collections` (tree collection, selection, navigation, typeahead, roving composite,
async and virtualization contract, collection contract fragment, traits), `add-listbox`
(selection rules and item parts conventions), `add-link` (link-navigation for `href` items)
and `add-theme-system`.

## What Changes

- `@rind-ui/core`: the `tree-view` machine, connect and contract; expansion and checked
  values as controllables; tri-state checking derived from leaves; lazy branch loading with
  status; `*`, expand all and collapse all.
- `@rind-ui/react`: `TreeView.Root`, `Label`, `Tree`, `Item`, `ItemIndicator`, `ItemCheckbox`,
  `ItemText`, `Loading`, `Empty`.
- `@rind-ui/testing`: `getTreeView` driver and model-based coverage.
- Theme stylesheet (tier-3 `--rind-tree-view-*` tokens), stories, docs page.

## Capabilities

### New Capabilities

- `tree-view`: the Tree View component — anatomy, flat `tree`/`treeitem` ARIA shape with
  set metadata, keyboard and pointer behaviour, selection and checking, lazy children,
  links, announcements, data attributes, contract and driver.

### Modified Capabilities

None.

## Non-goals

- Re-specifying keys, tree collections, navigation, selection rules, typeahead, repair,
  virtualization or set metadata (`add-collections`).
- Interactive content inside an item, and the treegrid pattern (Table's expandable rows,
  Grid List): see the research note's role decision.
- Drag and drop, inline rename (F2) and clipboard commands: consumer-owned; the tree lets
  unhandled keys bubble so they compose.
- Static nested JSX items (data collection plus render function only), nested `group`
  DOM, expand/collapse animation, indent guides as parts (CSS from `data-level`).
- A virtualizer, data fetching, search/filter UI.
- Horizontal orientation; framework adapters other than React; fx.

## Impact

- New code: `packages/core/src/components/tree-view/{tree-view.machine,tree-view.connect,
  tree-view.contract,tree-view.messages,tree-view.check}.ts`, `packages/react/src/tree-view/*`,
  `packages/testing` driver, `packages/theme/src/tree-view.css`, stories, generated docs.
- Public API: `tree-view` machine/connect/contract, `TreeView` parts, `getTreeView`.
- No new runtime dependency. Reado: `FileTree` migrates (design, Migration Plan).
