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
