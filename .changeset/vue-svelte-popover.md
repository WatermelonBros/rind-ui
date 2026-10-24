---
"@rind-ui/vue": minor
"@rind-ui/svelte": minor
"@rind-ui/testing": patch
---

Vue and Svelte: Popover, with a Portal and the layer context the overlays share (outside
presses, Escape and focus return follow the nesting). `canonicalHtml` rounds measured lengths
to whole pixels, drops an empty `style` and treats a generated `data-value` as one token, so
two renders of one component compare equal across engines.
