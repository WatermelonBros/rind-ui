## 1. Virtualization (moved from add-tree-view 5.3)

- [x] 1.1 Wire `TreeView.Tree` to the collection virtualizer (`scrollToIndex` on keyboard moves, ids stable across expand/collapse)
- [x] 1.2 Per-row selectors: only the previous and next highlighted rows re-render on a highlight move
- [x] 1.3 Virtualized fixture: End at 10,000 nodes, expand/collapse keeps ids, two-item re-render, 70k-node build benchmark
- [x] 1.4 Site example (virtualized tree); lint, typecheck, targeted tests; changeset
