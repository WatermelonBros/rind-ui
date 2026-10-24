---
"@rind-ui/core": patch
"@rind-ui/react": patch
---

Positions measured from the page (floating content, the tour's spotlight, a sortable drag and its indicator, swipe offsets, the table of contents' marker) are now right inside a CSS-zoomed page or container: lengths measured in viewport pixels are divided by the element's effective zoom (`currentCSSZoom`) before they are written to its style. `cssZoom(el)` is exported from `@rind-ui/core`.
