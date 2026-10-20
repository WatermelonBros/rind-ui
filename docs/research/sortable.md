# Sortable (drag-and-drop reordering) — research

Reordering a list (tasks, playlist tracks, tabs, form fields, dashboard cards) by dragging
an item to a new place. Three requirements:
- a **pointer** drag with a clear drop position and auto-scroll;
- an equivalent **keyboard** move that lands on positions, not pixel offsets;
- a **screen-reader** experience that says what was picked up, where it is now and where it
  was dropped.

Dragging between lists, file drops and trees come later; they need the same session model.

Sources read (October 2026):
- React Aria `packages/react-aria/src/dnd` (`DragManager.ts`, `useDraggableCollection.ts`,
  `useDroppableCollection.ts`, `DropTargetKeyboardNavigation.ts`, `ListDropTargetDelegate.ts`,
  `useAutoScroll.ts`) and its tracker;
- dnd-kit (`@dnd-kit/core`, `@dnd-kit/sortable`, the experimental `@dnd-kit/dom`) tracker;
- Pragmatic drag and drop (Atlassian) tracker and accessibility guidance;
- rind-ui's research for Grid List, Tabs and Collections (DnD deferred there).

## How the others built it

### React Aria (`useDragAndDrop` on ListBox, GridList, Table, Tree)

- A **drag session** (`DragManager`) is a document-level manager:
  - every valid drop target is registered;
  - on a keyboard or virtual drag, everything outside the valid targets gets `aria-hidden`;
  - keys are captured on the document (Escape cancels, Tab cycles targets, Enter drops);
  - it announces the start by modality: "Started dragging. Press Tab to navigate to a drop
    target…".
- Collections render **drop indicators** between items, which are virtual buttons for
  screen readers ("Insert between Apple and Banana"). Arrow keys move between them
  (`DropTargetKeyboardNavigation`).
- The API: `getItems`, `onReorder(e: { keys, target: { key, dropPosition: "before" |
  "after" | "on" } })`, `onInsert`, `onRootDrop`, `renderDropIndicator`.
- Bugs and requests:
  - #3220 (open): drag help text in `aria-describedby` is read only in NVDA / JAWS forms mode;
  - #10599 (open): unmounting the drag source mid keyboard drag left document listeners
    installed, so every key was swallowed with focus on body, and Escape was the only exit;
  - #10423 (open): the first drag of a row by its button handle does not reorder;
  - #9739, #10738 (open): dragging cannot be restricted to a handle;
  - #5704 (open): drag or drop cannot be disabled per item;
  - #7449, #8162 (open): drag one item regardless of selection; custom keys for the drag;
  - #10437, #6492 (open): keyboard drop indicators are not scrolled into view;
  - #10597 (open): the indicator is offset when an ancestor scrolls;
  - #5366 (open): tabs cannot be reordered;
  - #9192 (open): sections in GridList DnD.

### dnd-kit

- Sensors (pointer, touch, keyboard), collision detection, and a sortable preset with
  strategies. Announcements and screen-reader instructions come through a live region.
- #2106 (open): the KeyboardSensor moves by **pixel offsets** (25 px or 10 px), not between
  targets, so it is inoperable for blind users and nothing meaningful is announced.
- #1858 (closed): announced positions did not update after the first move.
- #1750 (closed): live-region content lingered after the drag.
- #2118 (open): a keyboard drag left pending "locks out" the mouse.
- #1991 (open): the keyboard position is one frame behind.
- #1960 (open): modifiers break with the keyboard sensor.
- #2070, #1992, #1756 (open): auto-scroll scrolls the wrong element, is slow on mobile, or
  fails in sticky containers.
- #1955 (open): drag does not work on some Android devices.
- #1963 (open): HMR or remounting during a drag leaves stale sources.
- #2008, #1940 (open): removing the source breaks sorting (`removeChild` errors).

### Pragmatic drag and drop

- Native HTML5 DnD underneath, with a guideline that recommends an **action menu** ("Move up,
  Move down, Move to top / bottom") as the accessible alternative instead of a keyboard drag.
- #165 (open): Escape cancel is not observable. #14 (open): Firefox on Android.

### Not shipped

Radix, Base UI, Headless UI, Ariakit, Kobalte, Reka, Melt, Bits, Zag / Ark.

## Accessibility

- **WCAG 2.5.7 Dragging Movements**: every drag needs a single-pointer alternative. The
  keyboard move must also work by pointer: a menu, or buttons in the handle's place.
- **Positions, not pixels** (dnd-kit #2106): a keyboard move goes one position at a time and
  says where: "Apple, position 3 of 5".
- **Announcements that track the state** (dnd-kit #1858, #1750), politely and keyed so that
  they replace one another:
  - picked up: "Picked up Apple, position 2 of 5. Arrow keys move, Space drops, Escape
    cancels.";
  - moved: "Position 3 of 5";
  - dropped: "Apple dropped at position 3 of 5";
  - cancelled: "Apple returned to position 2 of 5".
- **Instructions where they are read** (React Aria #3220): in the handle's name or
  description, not only in `aria-describedby`. The handle is a button named "Reorder Apple",
  described by "Space to pick up".
- **A session that cannot trap** (React Aria #10599, dnd-kit #2118):
  - listeners live on the handle, not the document;
  - blur, unmounting the source or a pointer press elsewhere cancels;
  - focus stays on the handle as the item moves.
- **The DOM order is the order**: the item moves in the list (the consumer's `onReorder`
  reorders the data). A visual-only preview that disagrees with the reading order is used
  only during a pointer drag.

## Bug history (the patterns)

- Pixel-based keyboard moves (dnd-kit #2106).
- Stale announced indices (dnd-kit #1858) and lingering live text (#1750).
- Sessions that outlive their source and swallow keys (React Aria #10599, dnd-kit #2118,
  #1963, #2008).
- No handle-only drag (React Aria #9739, #10738); no per-item disable (#5704).
- Auto-scroll scrolling the wrong element or too slowly (dnd-kit #2070, #1992, #1756);
  indicators not scrolled into view (React Aria #10437, #6492).
- First drag not reordering (React Aria #10423).

## Decisions

1. **A standalone Sortable**, not a GridList feature. Parts:
   - `Root`, which takes the ordered `items` keys and `onReorder`;
   - `Item` (`value`);
   - `Handle` (a button);
   - `Indicator` (the drop line).

   It wraps any list markup: GridList rows, tabs, a plain `ul`. Moving between lists and
   Tree DnD are later changes on the same session model.
2. **Keyboard on the handle**:
   - Space or Enter picks the item up; the arrows (Up / Down, or Left / Right with
     `orientation="horizontal"`) move it one position, reordering live through
     `onReorder`;
   - Home / End move it to the first / last position;
   - Space or Enter drops; Escape cancels and puts it back at the start position;
   - blur or Tab drops where it is (the order has already changed live, so a drop needs no
     extra step).

   Focus stays on the handle, which moves with the item.
3. **Alt+Arrow** moves an item one position without picking it up, the quick move of many
   editors. Handle buttons are the single-pointer alternative: the consumer can render
   "Move up" / "Move down" through `Sortable.MoveButton`, so no drag is required.
4. **Pointer**:
   - pointerdown on the handle, or on the item with `handle={false}`; a 4 px threshold, or
     a 300 ms long press on touch;
   - the dragged item follows the pointer through a CSS transform (`--rind-sortable-x` and
     `-y`, `data-dragging`);
   - the target position comes from the items' midpoints along the axis, shown by the
     Indicator (`data-position`, `--rind-sortable-indicator-top` / `-left`);
   - drop calls `onReorder` once; Escape cancels;
   - the scroll container auto-scrolls near its edges, at a speed proportional to the
     distance, on rAF.
5. **`onReorder(keys, { key, from, to, reason })`** gives the new key order, a single
   source of truth. Controlled `items` only, as the consumer owns the data.
6. **Announcements** (`messages`, polite, one key per root) for pick up, move, drop and
   cancel, with positions from the current order.
7. **Disabled items** (`disabled` on Item) cannot be picked up, and items can still move past
   them.
8. **Machine**: states `idle` / `moving` (keyboard) / `dragging` (pointer). The start order is
   kept for Escape. If the source unmounts mid-session, the drag is cancelled.
