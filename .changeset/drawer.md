---
"@rind-ui/core": minor
"@rind-ui/react": minor
"@rind-ui/testing": minor
"@rind-ui/theme": minor
---

Drawer: a Dialog at an edge of the viewport, swipeable away and between snap points (with a handle that cycles them), nested drawers with background indent metadata, a keyboard inset, the `drawer` contract and `getDrawer` driver, and the theme stylesheet. New shared pieces:
- `trackSwipe` (the `swipe-gesture` capability: discrete events, movement as CSS variables);
- `Part.drag` in both test adapters;
- `dialogPieces`, so dialog-family machines compose the Dialog's graph.

A transition's declared `reason` now also names the controllable changes its actions write.

Behaviour changes:
- `DialogCloseReason` gains `"swipe"` (the Drawer's).
- A transition's declared reason now also applies to the controllable writes of its actions. Dialog and Alert Dialog keep their `details.reason` for every close path (covered by their machine tests).
- Press: a pointer press no longer cancels when focus moves to an ancestor of the pressed part. This is WebKit's mousedown on a focused button.

