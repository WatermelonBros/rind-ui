## Why

`add-tree-view` shipped without virtualization (its task 5.3): `TreeView.Tree` renders every
visible node. Trees of tens of thousands of nodes (file explorers, outlines) need the
virtualized rendering that design left for this follow-up (coordinator decision, 2026-10-18).

## What Changes

- Virtualized rendering for `TreeView.Tree` through the collection layer's virtualizer:
  `scrollToIndex` on keyboard moves, stable ids across expand/collapse, only the changed rows
  re-render on a highlight move.
- Tests: End at 10,000 nodes, expand/collapse keeps ids, a two-item re-render on a highlight
  move, a 70k-node build benchmark (as specified in add-tree-view task 5.3).

## Capabilities

### Modified Capabilities

- `tree-view`: virtualized rendering (the requirement text stays as specified in add-tree-view).

## Impact

core tree-view machine/connect, react `TreeView.Tree`, tests. No new dependency.
