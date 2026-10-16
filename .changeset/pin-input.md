---
"@rind-ui/core": minor
"@rind-ui/react": minor
"@rind-ui/testing": minor
"@rind-ui/theme": minor
---

Add Pin Input: one native input over presentational slots, so typing, paste, SMS and password-manager autofill, IME and screen readers work as for one field. Insertions are planned before they apply (filtering, NFKC, `sanitize`, separators dropped from pastes, a full paste replaces), the caret never leaves holes, `onValueComplete` and `autoSubmit` without focus moves, the input is the form control (`pattern`, `required`). The `getPinInput` driver, `Part.paste` in both adapters, and `pin-input.css`.
