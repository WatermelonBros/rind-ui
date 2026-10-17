---
"@rind-ui/core": patch
"@rind-ui/react": patch
---

Combobox: the popup is shown in the top layer (`popover="manual"`) where the Popover API exists, so page content laid out after the combobox never covers it or takes its presses; it stays in place in the DOM. The site's Empty-state example no longer starts open.
