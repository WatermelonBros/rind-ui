---
"@rind-ui/core": patch
"@rind-ui/react": patch
"@rind-ui/solid": patch
"@rind-ui/svelte": patch
"@rind-ui/vue": patch
"@rind-ui/angular": patch
---

Select, menu and navigation menu fixes from the cross-library audit:

- Select: browser autofill that matches no option (or lands on a multiple or read-only select) no longer stays in the hidden input. The input is re-synced, so `required` keeps working.
- Select: a read-only select ignores autofill.
- Select: inside a Field, the trigger's `aria-describedby` keeps its own Select.Description and the consumer's ids after the Field's.
- Select: a native `<fieldset disabled>` around the trigger disables the select (radix#2417).
- Menu and menubar: arrow keys follow the trigger's nearest `[dir]`, the same direction placement uses. The positioner falls back to the locale's direction instead of `ltr`.
- Context menu: Tab in a non-modal menu on a focusable region moves on from the row the menu opened on, not into the region.
- Navigation menu: a panel opened and closed with the keyboard no longer blocks hover on its trigger.
- Angular context menu: a bound `tabindex` on the trigger is read after the first render.
