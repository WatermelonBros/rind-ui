---
"@rind-ui/core": patch
"@rind-ui/react": patch
"@rind-ui/solid": patch
"@rind-ui/svelte": patch
"@rind-ui/vue": patch
"@rind-ui/angular": patch
---

Field, text field, tags input, pin input, prompt input and color area fixes from the cross-library audit:

- Field: after a form reset, a value that fails `validate` still sets the native validity, so the form cannot submit it.
- Text Field: a parent's change to a controlled value is reported to the Field, so its error, its custom validity and `data-filled` follow.
- Pin Input, Tags Input and Prompt Input: a form reset, a parent's value, an API change and a draft cleared by a send are no longer user changes. They keep server errors, and a successful send no longer shows "Please fill out this field".
- Field.Label rendered as another element (`render={<span/>}`, a child snippet, a directive on a span) still names the control through `aria-labelledby`, and a press on it focuses the control.
- Tags Input: a read-only or disabled input ignores a paste with delimiters. The textbox carries `aria-required`.
- Pin Input: a custom `pattern` no longer turns into a native `pattern` that rejects valid codes (`/[a-f0-9]/i`, `/^[A-Z]$/`). `pattern` is documented as BMP-only.
- Text Field: Enter in a Textarea is a new line, never `onSubmit`.
- Color Area: an enclosing disabled or read-only Field, rind's Fieldset and a native `<fieldset disabled>` disable it, pointer drags included.
