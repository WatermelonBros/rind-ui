---
"@rind-ui/core": minor
"@rind-ui/react": minor
"@rind-ui/testing": minor
"@rind-ui/theme": minor
---

Button: one `onPress` per activation from every input with its modality, `onPressStart` /
`onPressEnd`, a pending state that keeps focus, swaps `submit` to `button` and announces
`messages.pending` when focused, and `getButton` with `press` / `pressWithSpace`. Shared
button-like rules for every button-like part (`buttonLikeProps`: native by default with
`type="button"`, `<a href>` delegated to link-navigation, generic elements with role and
tabIndex, disabled and `focusableWhenDisabled`, `elementInfo`, a fieldset-disabled tracker
following every ancestor fieldset). Press interactions now keep the native Enter and Space
activation of submit and reset buttons, so a form submits or resets once.
