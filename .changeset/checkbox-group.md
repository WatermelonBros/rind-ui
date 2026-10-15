---
"@rind-ui/core": minor
"@rind-ui/react": minor
"@rind-ui/testing": minor
"@rind-ui/theme": minor
---

Checkbox Group: a set of Checkboxes with one array `value` (controlled or not, set-equality
change detection), submitted as one entry per checked item under the group's `name`.
Parts: `Root`, `Label`, `Description`, `ErrorMessage`, and `Parent`, a select-all Checkbox
that is mixed for a partial selection and follows the APG cycle (select all, none, restore).
`required` means at least one item; disabled and read-only apply to the whole group; one
form reset answers for every item. Registers as one control in a Field.
`getCheckboxGroup`, `checkboxGroupContract` and `checkbox-group.css` (structural).
