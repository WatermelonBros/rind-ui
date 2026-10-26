---
"@rind-ui/core": patch
"@rind-ui/react": patch
"@rind-ui/solid": patch
"@rind-ui/svelte": patch
"@rind-ui/vue": patch
"@rind-ui/angular": patch
---

Menubar: a menu's content rendered inside the bar (without Menu.Portal) logs a development warning. A menubar may only own its items, so `role="menu"` among its children fails axe `aria-required-children`.
