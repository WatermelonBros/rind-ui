## Context

See [tree-view-dnd.md](../../../docs/research/tree-view-dnd.md).

## Decisions

### 1. Targets (`tree-move.ts`, pure)

A target is `{ parent: string | null, index }`, where `index` is the position among the
parent's children **after** the moved node is removed (React Aria #8561).

- `moveTarget(tree, key, direction)`:
  - `up`: the previous sibling's index;
  - `down`: the next sibling's index + 1, minus 1 because of the removal;
  - `in`: the previous sibling as parent (when it is a branch), at its end;
  - `out`: the grandparent, right after the parent.

  It returns null when there is nowhere to go.
- `pointerTarget(tree, key, overKey, zone)` maps `before` / `inside` / `after` of the row
  under the pointer to a target. It returns null when the target is in the node's own subtree
  or the node itself.
- `moveNode(items, key, target)` is the immutable data helper: it removes the node and inserts
  it at the target.

### 2. Machine

Props `movable` (boolean, or a predicate) and `onMove`.

Events:
- `MOVE.KEY { key, direction }`: computes the target. When there is one, it calls `onMove`
  (`reason: "keyboard"`) and announces; otherwise it announces the refusal. The highlight
  stays on the key.
- `DRAG.START { key }`: when the key is movable, it enters `dragging` (a parallel flag in
  context: `drag: { key, target }`);
- `DRAG.OVER { target }`, `DRAG.END` (calls `onMove`, `reason: "pointer"`), `DRAG.CANCEL`;
- `TREE.CHANGE`: when the dragged key is no longer visible, the drag ends (React Aria
  #10599).

### 3. DOM

- Pointer drag of a row (only when movable): a 4 px threshold, or a 300 ms press on touch.
- The row under the pointer is found with `elementFromPoint` → `closest('[role=treeitem]')`.
  The zone is the pointer's position in the row: the top quarter, the middle half, the bottom
  quarter.
- Hovering a collapsed branch's inside zone for 700 ms expands it.
- Escape and `pointercancel` cancel. The listeners exist only during the gesture.

### 4. Connect

- Item: `data-dragging` on the dragged row, `data-drop-target` on the row of an inside target.
- `DropIndicator`: `aria-hidden`, positioned by `--rind-tree-drop-top` (px from the tree's
  top) and `--rind-tree-drop-level`, with `data-position`.
- The Tree's description gains `messages.moveInstructions` when movable.

### 5. Contract

- `moveNode(label, direction)`: Alt+arrow on the row;
- `dragNode(label, overLabel, zone)`: a pointer drag;
- the existing `items` query reads each visible row's name and level.
