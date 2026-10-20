## Why

Reordering by drag (tasks, tracks, tabs, fields, cards) is requested across libraries, but
the implementations fail keyboard and screen-reader users:
- keyboard moves by pixel offsets (dnd-kit #2106);
- announced positions are stale (dnd-kit #1858);
- a drag session that outlives its source swallows every key (React Aria #10599);
- there is no handle-only drag (React Aria #9739) and no per-item disable (#5704);
- tabs cannot be reordered at all (React Aria #5366).

None of the nine headless libraries ships a reorderable list outside React Aria's
collections.

Research: [sortable](../../../docs/research/sortable.md)

Depends on: `add-foundations` (environment, scheduler), `add-a11y-foundations` (announcer,
modality), `add-theme-system`.

## What Changes

- A public **Sortable** in `@rind-ui/core` (machine, connect, contract, messages, meta;
  `core/dom/sortable-drag.ts`) and `@rind-ui/react`. Parts: `Root`, `Item`, `Handle`,
  `Indicator`, `MoveButton`.
- Keyboard on the handle:
  - Space / Enter picks up;
  - arrows, Home and End move one position or to an end, reordering live;
  - Space / Enter drops, Escape restores, blur or Tab drops;
  - Alt+Arrow moves without picking up.
- Pointer drag from the handle (or the whole item), with a threshold, a long press on
  touch, a drop indicator at the midpoint position, auto-scroll and Escape to cancel.
- `onReorder(keys, details)` with the new order; controlled `items`.
- Pick up, move, drop and cancel are announced with positions from the current order.
- Disabled items, horizontal orientation, and move buttons as the single-pointer
  alternative.
- `getSortable` driver, theme stylesheet, site examples (a task list, reorderable tabs),
  docs page.

## Impact

- New capability `sortable`. Grid List, Tabs and Tree View reorder by composing it.
