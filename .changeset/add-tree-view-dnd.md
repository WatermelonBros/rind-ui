---
"@rind-ui/core": minor
"@rind-ui/react": minor
"@rind-ui/testing": minor
"@rind-ui/theme": minor
---

Tree View: moving nodes. `movable` (all, or a predicate) and `onMove(key, { parent, index, reason })`, with `moveNode(items, key, target)` to apply it. Keyboard: the outliner keys (Alt+Up / Down among siblings, Alt+Right into the folder above, Alt+Left out of its folder), focus kept, each move announced. Pointer: drag a row before / inside / after another (a closed folder opens after 700 ms), `TreeView.DropIndicator`, `data-dragging` and `data-drop-target`; never into its own subtree; the drag ends when its node is hidden. Core: `moveTarget`, `pointerTarget`, `moveNode`, `core/dom/tree-drag`. Contract: `moveNode`, `dragNode`. Theme: tree-view.css rules for the drag.
