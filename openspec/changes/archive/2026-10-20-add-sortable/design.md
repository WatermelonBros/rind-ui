## Context

See [sortable.md](../../../docs/research/sortable.md).

## Decisions

### 1. Machine (`sortable.machine.ts`)

The props carry `items` (keys, in order), `disabled` keys, `orientation` and `onReorder`.

States:
- `idle`;
- `moving`: a keyboard pick-up. The context holds `active` and `start` (the order at
  pick-up), for Escape;
- `dragging`: a pointer drag. The context holds `active`, `start` and `target`, the index
  the indicator shows.

Events:
- `PICK { key, modality }`;
- `MOVE { by }` for ±1, `MOVE.TO { index }` for Home / End;
- `QUICK { key, by }` for Alt+Arrow and the move buttons, which move once from idle;
- `DROP`, `CANCEL`;
- `DRAG.START { key }`, `DRAG.OVER { index }`, `DRAG.END`;
- `ITEMS.SYNCED` (onProps `items`): when the active item has left `items` (removed,
  filtered), the session ends. This is decided on the data, not on unmount timing, which
  development re-runs of effects make unreliable.

`reorder(order, key, to)` is pure: it removes the key and inserts it at `to`. Disabled keys
cannot be picked or quick-moved, but can be passed.

Keyboard moves call `onReorder(next, { key, from, to, reason: "keyboard" })` on each step.
Escape calls it once more with the start order (`reason: "cancel"`). A pointer drag calls it
once on drop (`reason: "pointer"`).

### 2. Announcements

Polite, under the key `sortable-<id>`, so each one replaces the last (dnd-kit #1750):
- pick up: "Picked up {label}, position {i} of {n}. Arrow keys move, Space drops, Escape
  cancels.";
- move: "Position {i} of {n}";
- drop: "{label} dropped at position {i} of {n}";
- cancel: "{label} returned to position {i} of {n}";
- quick move: "{label} moved to position {i} of {n}".

Labels come from the Items, registered by their `label` prop or their text content.
Positions always come from the current order (dnd-kit #1858).

### 3. Pointer (`core/dom/sortable-drag.ts`)

- It starts on a pointerdown on the handle, or on the item when the handle is the item.
  The drag begins after a 4 px move, or after a 300 ms press on touch, which keeps page
  scrolling on touch; until then nothing is prevented.
- During the drag:
  - the pointer delta is exposed as `--rind-sortable-x` / `-y` on the active item;
  - the target index is computed from the other items' rects, measured at the start and
    shifted by scroll: the last item whose midpoint along the axis is before the pointer;
  - the indicator's offset is the gap before the target item, relative to the Root.
- Auto-scroll: when the pointer is within 48 px of the scroll container's edge, the
  container scrolls on rAF at a speed proportional to the depth into that band (dnd-kit
  #1992). Only the container that holds the list scrolls (dnd-kit #2070).
- Escape and `pointercancel` cancel. The listeners are attached on start and removed on
  end, never kept on the document (React Aria #10599).

### 4. Connect

Parts:
- Root: `data-orientation` and `data-state`; `position: relative`.
- Item:
  - `data-value`, `data-index`;
  - `data-active` (picked up or dragged), `data-dragging` (pointer);
  - `data-disabled`, `data-drop-before` / `data-drop-after`;
  - during a drag, an inline `transform` from the variables.
- Handle:
  - a button named `messages.handleLabel(label)` ("Reorder Apple") and described by
    `messages.instructions`;
  - `aria-pressed` while the item is picked up;
  - `data-active`, `touch-action: none`.
- Indicator: `aria-hidden`, shown while dragging, with `--rind-sortable-indicator`
  (px along the axis).
- MoveButton (`direction: "up" | "down"`): a button named by `messages.moveUp` /
  `moveDown`, `aria-disabled` at the ends.

### 5. Contract

Located by the Root's name. Actions:
- `pickUp(label)`, `move(steps)`, `drop()`, `cancel()`;
- `quickMove(label, steps)`, by Alt+Arrow or the move buttons;
- `drag(label, steps)`, a pointer drag over `steps` items.

Queries: `order` (the item labels in DOM order), `active`, `pressed`.

### 6. Theme

`sortable.css`, family `decoration`:
- the handle's grip glyph, drawn with CSS dots when empty, and a `grab` cursor;
- the active item raised with a shadow;
- the dragging item at 0.9 opacity with a grabbing cursor;
- the indicator as an accent line;
- reduced motion: no transitions;
- forced colours.
