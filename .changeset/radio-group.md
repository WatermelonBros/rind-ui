---
"@rind-ui/core": minor
"@rind-ui/react": minor
"@rind-ui/testing": minor
"@rind-ui/theme": minor
---

Radio Group: one choice out of several with a roving single tab stop. Arrow keys move and
check (every arrow whatever the orientation, mirrored in RTL); focus alone never checks. Parts:
`Root`, `Label`, `Description`, `ErrorMessage`, `Item`, `ItemControl`, `ItemIndicator`,
`ItemLabel`, `ItemDescription`. One native radio input per item shares the group's `name`;
`readOnly`, `required`, `invalid`, `disabled` and `focusableWhenDisabled` apply to the whole
group, and the group registers as one control in a Field.
`getRadioGroup`, `radioGroupContract` and `radio-group.css` (structural, forced-colors aware).
