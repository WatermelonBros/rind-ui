---
"@rind-ui/core": minor
"@rind-ui/react": minor
"@rind-ui/testing": minor
"@rind-ui/theme": minor
---

Text Field gains passwords and search. `type="password"` adds `VisibilityTrigger` and `VisibilityIndicator` (a toggle with `aria-pressed` and one name in both states, caret kept across the reveal, hidden again on every form submit and unprevented reset, spellcheck and autocorrect off) and `visible` / `defaultVisible` / `onVisibleChange`. `type="search"` makes the input a searchbox with "Clear search" and one clear control. `escapeClears` (default on for search) clears with Escape only when there is something to clear, so an enclosing Dialog still closes on an empty field; `onSubmit` runs on Enter and never while an IME composes. The driver `getTextField` covers it all, located by the control's name (`{ label }`), with `textFieldKeyStepInvariants`; the styles are in `text-field.css`.
