---
"@rind-ui/core": minor
"@rind-ui/react": minor
"@rind-ui/testing": minor
"@rind-ui/theme": minor
---

Add Combobox: a text input with a listbox popup. Filtering (locale-aware, or off with `filter: null`), auto highlight with a typing pause before the active descendant, inline completion, IME-safe keys, Enter/Escape/Tab and the commit rules for typed text (exact match, empty, custom values), async results with `itemsQuery` and an abort signal per text change, the empty state, multiple selection with chips (the shared `input-chips` helpers), forms (hidden inputs, reset, autofill, required), Field binding and label activation. The `getCombobox` driver, `comboboxTraits`, and `combobox.css`. The machine runtime now processes an event an action sends after its step (a scheduler callback) at once; `FormInputDecl.values` names the values a hidden input mirrors.
