## Why

Tree View can browse, select, check and lazy-load, but it cannot move nodes. File explorers,
outlines and category editors need that. The one library that ships tree drag and drop,
React Aria, has a history of:
- off-by-one root reorders (#8561);
- impossible drops near expanded or first rows (#9841, #10638);
- a keyboard trapped when the dragged node's ancestor collapses (#10599).

Research: [tree-view-dnd](../../../docs/research/tree-view-dnd.md)

Depends on: `add-tree-view`, `add-sortable` (pointer drag, announcements model).

## What Changes

- Tree View gains `movable` and `onMove(key, { parent, index, reason })`.
- Keyboard follows the outliner model: Alt+Up / Alt+Down move among siblings, Alt+Right
  indents into the previous sibling branch, Alt+Left outdents after the parent. Focus stays
  on the moved node, and each move is announced.
- Pointer: drag a row; the zones of the row under the pointer give before / inside / after;
  a hovered collapsed branch expands after 700 ms; Escape cancels; never into its own
  subtree.
- `TreeView.DropIndicator` part; `data-dragging` and `data-drop-target` on rows.
- Pure `moveTarget`, `pointerTarget` and `moveNode` in core.
- Contract actions `moveNode` and `dragNode`; docs, site example and theme rules.

## Impact

- Modified capability `tree-view`. No breaking change: moving is off unless `movable`.
