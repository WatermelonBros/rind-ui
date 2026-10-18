---
"@rind-ui/core": patch
"@rind-ui/react": patch
"@rind-ui/testing": minor
---

Range Date Field fixes:
- Select all + Backspace in a partial end clears both ends.
- An invalid pair marks every segment `aria-invalid`.
- `DateField.Description` (and the Field's error) describe the group and the first start segment.
- The range contract adds the invariants other-end-untouched, value-is-derived and hidden-never-focused.
- `@rind-ui/testing` adds `dateRangeStepInvariants` (the onValueChange count).
