---
"@rind-ui/core": minor
"@rind-ui/react": minor
"@rind-ui/testing": minor
"@rind-ui/theme": minor
---

Add Context Menu: a Menu opened from a region by right click, Control+click, long press (touch and pen) or the context-menu key, anchored at the point, re-anchored by a second right click in the region, with `openAt` for programmatic opening, the `getContextMenu` driver and `context-menu.css`. Press interactions: a long press can set a movement tolerance and a second pointer cancels it. Testing: parts gain `contextMenu()` and `longPress()`, and the DOM adapter takes `advanceClock` (a virtual clock for explicit waits only).
