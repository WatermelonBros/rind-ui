---
"@rind-ui/react": patch
"@rind-ui/solid": patch
"@rind-ui/svelte": patch
"@rind-ui/vue": patch
"@rind-ui/angular": patch
---

Toggle Group, Checkbox Group, Menu and Navigation Menu triggers follow a native `<fieldset disabled>` (and rind's Fieldset, for the triggers): `data-disabled`, no hover state, no tab stop on a disabled button, and a trigger never opens.
