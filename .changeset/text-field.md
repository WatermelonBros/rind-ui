---
"@rind-ui/core": minor
"@rind-ui/react": minor
"@rind-ui/testing": minor
"@rind-ui/theme": minor
---

Text Field: a native input or textarea with a controllable value (`onValueChange` with
reason, native event and composition flag), IME-safe handling, a ClearTrigger that keeps
focus and clears through one `input` event, a CharacterCount (hard `maxLength` or soft
`max`, announced near the limit), and autosize (`field-sizing: content` or a side-effect-free
measured fallback). `TextField.Root` is a Field when standalone and joins an enclosing one
(the shared `FieldHost` helper). `buildTextFieldMachine(preset)` for presets,
`textFieldContractFor(scope)`, `getTextField`, `text-field.css`, and an Autosize guide.
