---
"@rind-ui/core": minor
"@rind-ui/react": minor
"@rind-ui/testing": minor
---

Calendar range mode gains drag selection: press a day, drag, release. The preview follows the pointer, a drag out of the grid keeps the last day, Escape cancels, and a release on the anchor keeps it (a click still starts a range). A touch drags only after `dragDelay` (default 200 ms) held still, and the page does not scroll while dragging. `data-dragging` on the root and grids; `onValueChange` reason `"DRAG"`; the contract action `dragRange(start, end)`. The DOM layer adds `createCellDrag` and exports `trackPointer`.
