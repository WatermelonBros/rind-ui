---
"@rind-ui/core": patch
"@rind-ui/react": patch
"@rind-ui/solid": patch
"@rind-ui/svelte": patch
"@rind-ui/vue": patch
"@rind-ui/angular": patch
---

Tabs, radio group, toggle group, checkbox and accordion fixes from the cross-library audit:

- Tabs, Radio Group, Segmented Control and Toggle Group items own their `id`. A consumer `id` is ignored with a development warning, so the panel's name, the item labels and the roving focus keep working. A `CRITICAL` entry `"!name"` marks such an attribute.
- Radio Group: a press on an item's label checks and focuses its radio when the control is a substituted, non-labelable element.
- Tabs: a disabled root leaves the tab list as the one tab stop.
- Angular Checkbox and Switch: Enter submits the hidden input's form, so the `form` prop is honoured.
- Accordion: modified keys (Ctrl/Cmd+Home, Alt+Arrow) on a trigger stay the browser's.
