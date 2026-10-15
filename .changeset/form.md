---
"@rind-ui/core": minor
"@rind-ui/react": minor
"@rind-ui/testing": minor
"@rind-ui/theme": minor
---

Form: a native `<form>` that validates every Field on a submit attempt (native `invalid`
events grouped into one attempt), focuses the first invalid Field in tree order once,
holds a submission for pending async checks and requests it again with the same
submitter, maps server `errors` to Fields by exact name, announces one summary for two or
more invalid Fields, calls `onFormSubmit` with typed values, exposes `validate(name?)`,
and keeps server errors through React 19's automatic action reset. Fields take the Form's
defaults and let it lead attempts; async results are cached per input. `getForm`,
`Part.scoped()`, `data-name` on Field roots, `form.css`.
