## Context

Research: [docs/research/editable.md](../../../docs/research/editable.md) ("Decisions"). v1 keeps
the draft in the context with an `onDraftChange` callback (no controlled draft).

## Decisions

### 1. Machine

States `preview | edit`, bound to the controllable `edit` (`edit`, `defaultEdit`,
`onEditChange`); `value` controllable (`value`, `defaultValue`, `onValueChange`). Context:
`draft`, `saved`. Events: `EDIT { reason }` (preview → edit: `saved` and `draft` = value),
`DRAFT { draft }`, `SUBMIT { reason }` (value = draft, → preview), `CANCEL { reason }` (draft =
saved, → preview), `RESET` (form reset: value = defaultValue). Disabled and read-only never
enter edit. Every change of `edit` and `value` carries its `reason` in the details.

### 2. Activation

`activationMode`: `click` (default: a press on the Preview), `dblclick`, `focus` (focusing the
Preview enters edit: allowed but not default), `none` (only the EditTrigger and the API). Enter
and Space on the Preview always activate (it is a button), whatever the mode.

### 3. Submit and cancel

Input keys: Enter submits (in a textarea, Ctrl/⌘+Enter; Enter is a newline); Escape cancels;
nothing while composing. Outside press (pointer down or focus landing outside the Root, through `dom/inside-watch`,
tracked only while editing; Tab-ing away never leaves edit open with the focus elsewhere): `submitMode` `both` or `blur` → submit, `enter` or `none` → cancel. Focus
leaving the window is not outside. SubmitTrigger and CancelTrigger submit and cancel.

### 4. Focus

Entering edit focuses the Input (and selects it with `selectOnFocus`, default true); leaving
edit focuses the Preview, unless the focus moved elsewhere (an outside press).

### 5. Accessibility

Preview: a `button` named by the Label and its value (`aria-labelledby` = Label + Preview),
showing the value or `placeholder`. Input: labelled by the Label. Triggers: buttons named from
`messages` (`edit`, `submit`, `cancel`) plus the Label.

### 6. Form

A hidden input (`dom/hidden-input`) carries the committed `value` with `name`, `required`,
`disabled`; the visible Input has no `name`.

### 7. Attributes

Every part: `data-scope="editable"`, `data-part`, `data-instance`, `data-state` (`preview |
edit`), `data-empty`, `data-disabled`, `data-readonly`, `data-invalid`; Preview and Input: focus
attributes.

### 8. Contract

Locate by the Label's text. Actions `edit`, `type`, `submit`, `cancel`. Queries `isEditing`,
`value`, `draft`, `previewText`.
