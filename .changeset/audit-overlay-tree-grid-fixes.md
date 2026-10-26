---
"@rind-ui/core": patch
---

Overlay, tree view, grid list and tour fixes from the cross-library audit:

- Overlays: a released layer stays known as exiting until its parts finish their exit animations. A press on a closing modal's fading backdrop no longer dismisses the layer beneath it (react-spectrum#10291).
- Dismiss: on iOS, a short tap that gets no `click` (backdrop, page text) still dismisses once the click is overdue (radix#4207).
- Scroll lock: on iOS, sub-pixel touch moves from a stationary tap are no longer cancelled, so taps inside modals keep their click (reka-ui#3054).
- Tree view: collapsing a branch whose lazy load failed lets the next expand retry the load.
- Tree view: moving a node into a collapsed branch opens that branch, so the node stays visible and focused.
- Grid list: in a wrapped grid, ArrowUp on the first row and ArrowDown on the last row keep the highlight in place instead of moving sideways.
- Tour: arrow keys on a native radio, or inside a radio group, slider, tabs, menu, listbox, grid or tree, stay with that widget.
