---
"@rind-ui/core": patch
---

Checkbox, Switch, Radio Group and Segmented Control: the hidden native input is named by its visible control (`aria-labelledby`), so checkers such as WAVE no longer report a missing form label. Assistive technology never reaches the input.
