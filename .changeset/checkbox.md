---
"@rind-ui/core": minor
"@rind-ui/react": minor
"@rind-ui/testing": minor
"@rind-ui/theme": minor
---

Checkbox: checked, unchecked or `indeterminate` (`aria-checked="mixed"`), controllable and
form-associated through a hidden native input (`name`, `value`, `uncheckedValue`, `form`,
`required`, form reset to the current `defaultChecked`). Parts: `Root`, `Control`,
`Indicator` (children may be a function of the state), `Label`, `Description`. Space
toggles; Enter submits the form. Shared `hidden-form-input` and `control-label` behaviour
for Switch and Checkbox Group. `getCheckbox`, `checkboxContract` and `checkbox.css`
(structural; forced colors map checked and mixed to `Highlight`).
