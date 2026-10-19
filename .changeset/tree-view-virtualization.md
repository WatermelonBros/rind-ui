---
"@rind-ui/react": minor
---

Tree View: virtualized rendering. `TreeView.Root` takes `virtualized` and `scrollToIndex` (the index in the visible list, called on keyboard moves instead of `scrollIntoView`); `TreeView.Tree` takes `indexes` (the virtualizer's window) and `TreeView.useVisibleRows()` gives the row count and the indexes to keep rendered (the highlighted row). Node state gains `index`. Each row subscribes to its own state: a highlight move re-renders only the two rows involved (keep the `Tree` render function stable). A highlighted row that mounts after the scroll takes focus.
