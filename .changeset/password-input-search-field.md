---
"@rind-ui/core": minor
"@rind-ui/react": minor
"@rind-ui/testing": minor
"@rind-ui/theme": minor
---

Add Password Input and Search Field, two Text Field presets built from one typed `buildTextFieldMachine`. Password Input: a toggle button with `aria-pressed` and one name in both states, caret kept across the reveal, hidden again on every form submit and unprevented reset, spellcheck and autocorrect off. Search Field: `type="search"`, Escape clears only when there is something to clear (so an enclosing Dialog still closes on an empty field), Enter calls `onSubmit` and never while an IME composes, one clear control. Drivers `getPasswordInput` and `getSearchField`, `searchFieldStepInvariants`, the contract locator `{ label }`, `password-input.css` and `search-field.css`.
