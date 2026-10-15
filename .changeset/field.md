---
"@rind-ui/core": minor
"@rind-ui/react": minor
"@rind-ui/testing": minor
"@rind-ui/theme": minor
---

Field: one form control with a Label, Description and ErrorMessage, validated by one
engine (sources in order: `invalid`, external errors, native constraints, `validate`;
native validity as the source of truth; submit / blur / change modes; native and aria
behaviours; async validation with stale-result dropping and debounce; touched, dirty,
filled; reset; focus on the first invalid control in tree order with a focus ring; polite
announcements once per message). The `field-control` binding for control authors
(`useFieldControl`, `mergeFieldProps`), `constraintValidity` as an environment capability,
`focusSafely` with an optional modality, `getField` with `.control()` composition,
`field.css`, and the "Implementing field-control" guide.
