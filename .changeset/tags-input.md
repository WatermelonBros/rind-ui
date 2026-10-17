---
"@rind-ui/core": minor
"@rind-ui/react": minor
"@rind-ui/testing": minor
"@rind-ui/theme": minor
---

Add Tags Input: a text input whose typed or pasted text becomes string tags. One creation path for Enter, delimiters (strings literal, RegExps, lists; caret at the end), paste splitting, blur `add` and `ADD`, with normalising, duplicates, `max` and `validate` (refusal keeps the draft, `data-refused`, `onRefuse`, an announcement); IME-safe keys; chips from the shared `input-chips` helpers with per-tag `disabled`; editing a tag in place; Clear; forms (one entry per tag, required, reset) and Field binding. The `getTagsInput` driver and `tags-input.css`. Suggestions come later, with Autocomplete.
