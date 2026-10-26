---
"@rind-ui/core": patch
"@rind-ui/react": patch
"@rind-ui/solid": patch
"@rind-ui/svelte": patch
"@rind-ui/vue": patch
"@rind-ui/angular": patch
---

Color picker, color field and number input fixes from the cross-library audit:

- Color picker: an enclosing disabled or read-only Field, rind's Fieldset or a native `<fieldset disabled>` disables the picker and every child.
- Color picker: a read-only or disabled picker ignores autofill.
- Color field: a typed css colour with alpha (`rgba(…, 0.5)`, `rgb(… / 50%)`) sets the alpha when the field has `alpha`.
- Number input: a step, a large step or End never goes past an off-grid `max` (max 10.5, step 1 stops at 10), so the hidden input reports no range or step mismatch.
- Number input: Persian digits typed by the user are kept when the value is reformatted.
- Scroll area: a removed Content child is no longer observed.
