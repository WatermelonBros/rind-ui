# Tree View drag and drop — research

Moving nodes in a tree: files between folders, outline items, nested categories. A node can go
before or after a sibling at any level, or inside a branch. A node can never move into its own
subtree. On top of [Sortable](sortable.md) (positions, announcements, sessions that cannot trap),
a tree adds:
- **levels**: indent and outdent;
- the "**inside**" target;
- collapsed branches, which may need to open while dragging.

Sources read (October 2026):
- React Aria `dnd/DropTargetKeyboardNavigation.ts` (the tree traversal of drop positions) and
  `TreeDropTargetDelegate`;
- its tracker;
- rind-ui's Tree View (`core/components/tree-view`, a flat list of `treeitem` rows) and
  Sortable.

## How React Aria built it

- The Tree is a `treegrid` with a drag button (`slot="drag"`) in each row. The drop targets
  are `before` / `on` / `after` each item. The keyboard walks them in tree order: after an
  item come its children (if expanded), then the parent's next sibling.
- `onMove(e: { keys, target: { key, dropPosition } })`.
- Bugs:
  - #8561 (closed): a top-level reorder moved the item two slots instead of one, by mouse and
    keyboard (an off-by-one between "after A" and "before B");
  - #9841 (open PR): a child could not move before its single root parent, and the drop
    produced an invalid id (an internal content node taken as a target);
  - #10638 (closed): the target was the row's hidden content node at the top edge of an
    expanded first row, or below an empty expanded folder, so root-level drops were
    impossible;
  - #10599, #10623 (open): collapsing the dragged node's ancestor during a keyboard drag
    trapped the page's keyboard;
  - #10650 (open): focus is lost when the focused row is collapsed away;
  - #10597 (open): the indicator is offset when an ancestor scrolls a virtualized tree.

## Our constraint

rind-ui's Tree View is a `tree` of `treeitem` rows, and **a treeitem cannot contain controls**
(Tree View docs). There is no drag button in a row. The keyboard route is the **outliner
model** found in outliners and editors:

- **Alt+Up / Alt+Down**: move the focused node before its previous sibling / after its next
  sibling;
- **Alt+Right**: indent, making the node the last child of its previous sibling, if that
  sibling is a branch;
- **Alt+Left**: outdent, placing the node right after its parent at the parent's level.

Every move keeps focus on the moved node, so it can be repeated, and is announced: "README moved
into src, position 2 of 3, level 2". The tree's description gains "Alt with the arrows moves
the item."

## Pointer

A row dragged by pointer gets a drop target from the pointer's position over the row under
it:
- the top quarter means `before`;
- the middle half means `inside`, when the row is a branch (otherwise `before` / `after`
  by half);
- the bottom quarter means `after`. The bottom of an expanded branch with children means
  `inside` at index 0, because "after" it would put the node after its whole subtree, away
  from where the line is drawn (the React Aria #10638 family).

Hovering a collapsed branch (`inside`) for 700 ms expands it. Escape cancels. Moving into its
own subtree is never offered: the row shows no target.

## Decisions

1. **Pure targets** (`core/components/tree-view/tree-move.ts`). `moveTarget(tree, key,
   direction)` returns `{ parent: key | null, index }` or null, and `pointerTarget(tree, key,
   over, zone)` does the same for a pointer. `moveNode(items, key, target)` is the data helper
   consumers apply. Every target is validated against the subtree, and indexes count the final
   siblings: the moved node is removed before inserting (React Aria #8561).
2. **Tree View props**:
   - `onMove(key, { parent, index, reason: "keyboard" | "pointer" })`; the consumer updates
     `items`;
   - `movable` (boolean, or a predicate per key) turns moving on.
3. **Machine events**:
   - `MOVE.KEY { key, direction }` computes the target, calls `onMove` and announces;
   - pointer: `DRAG.START { key }`, `DRAG.OVER { target | null }`, `DRAG.END`, `DRAG.CANCEL`;
   - the session ends if the dragged node leaves the visible tree (React Aria #10599).
4. **Parts**:
   - `TreeView.DropIndicator`: `aria-hidden`, positioned at the target row and level by
     CSS variables (`--rind-tree-drop-top`, `--rind-tree-drop-level`), with
     `data-position="before" | "after" | "inside"`;
   - rows carry `data-dragging` and `data-drop-target` (inside).
5. **Announcements** (polite, keyed) after keyboard moves and drops: "{label} moved {before
   X | after X | into X}, position {i} of {n}, level {l}"; a refused move says why ("Cannot
   move further up").
