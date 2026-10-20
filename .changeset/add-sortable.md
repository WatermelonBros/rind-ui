---
"@rind-ui/core": minor
"@rind-ui/react": minor
"@rind-ui/testing": minor
"@rind-ui/theme": minor
---

Sortable: reorder a list by pointer, keyboard or buttons. A handle per item ("Reorder Apple"): Space picks up, arrows / Home / End move by position with a live reorder and focus kept, Space drops, Escape restores, Alt+arrow moves one place; `MoveButton` is the single-pointer alternative. Pointer drags from the handle (or the item) with a threshold, a long press on touch, a midpoint drop indicator and edge auto-scroll; `onReorder(keys, { key, from, to, reason })` with controlled `items`. Announcements carry positions from the current order; the session ends when its item leaves `items`. Core: `reorder`, `core/dom/sortable-drag`. Testing: `getSortable`. Theme: `sortable.css`.
