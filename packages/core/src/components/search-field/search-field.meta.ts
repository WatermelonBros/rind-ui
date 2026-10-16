// The Search Field's API facts for the generated docs (scripts/docs-gen.ts). Data only;
// checked against the code in search-field.meta.test.ts.

import type { ComponentMeta } from "../meta"

const fieldState = {
  "data-disabled": "While disabled.",
  "data-readonly": "While read-only.",
  "data-invalid": "An error is displayed (Field).",
  "data-empty": "The value is empty.",
}
const base = (part: string) => ({
  "data-scope": '"search-field"',
  "data-part": `"${part}"`,
  "data-instance": "The instance id.",
})

export const searchFieldMeta = {
  scope: "search-field",
  name: "Search Field",
  stateless: false,
  parts: [
    {
      name: "SearchField.Root",
      part: "root",
      element: "div",
      description: "A Field when not inside one; else it joins the enclosing Field.",
    },
    {
      name: "SearchField.Label",
      part: "label",
      element: "label",
      description: "The Field's Label; omit it and give the Input an `aria-label` for icon-only.",
    },
    {
      name: "SearchField.Description",
      part: "description",
      element: "p",
      description: "The Field's Description (not rendered inside a Field).",
    },
    {
      name: "SearchField.ErrorMessage",
      part: "error-message",
      element: "p",
      description: "The Field's ErrorMessage (not rendered inside a Field).",
    },
    {
      name: "SearchField.Input",
      part: "input",
      element: "input",
      description: '`type="search"` (role searchbox), `enterKeyHint="search"`; both overridable.',
    },
    {
      name: "SearchField.ClearTrigger",
      part: "clear-trigger",
      element: "button",
      description:
        'Named "Clear search", not in the Tab order (Escape is its keyboard twin); hides the native cancel button.',
    },
  ],
  props: {
    onSubmit: {
      type: "(value, { event }) => void",
      description:
        "Enter, unless an IME is composing. The form still submits: `details.event.preventDefault()` stops it.",
    },
    value: { type: "string | null", description: "Controlled value (Text Field's)." },
    defaultValue: { type: "string", description: "Uncontrolled value (Text Field's)." },
    onValueChange: {
      type: "(value, { reason, event, isComposing }) => void",
      description: "Every change; Escape's clear has reason `ESCAPE`, the ClearTrigger's `CLEAR`.",
    },
    messages: {
      type: "{ clear?, charactersRemaining?, charactersOver? }",
      description: 'The ClearTrigger name (default "Clear search") and Text Field\'s counts.',
    },
  },
  dataAttributes: {
    root: { ...base("root"), ...fieldState, "data-focus": "The input has focus." },
    input: {
      ...base("input"),
      ...fieldState,
      "data-custom-clear": "A ClearTrigger is mounted (the native cancel button is hidden).",
    },
    "clear-trigger": base("clear-trigger"),
  },
  keyboard: [
    [
      "Escape",
      "Clears a non-empty, editable field and keeps the key from an enclosing layer; otherwise the layer gets it.",
    ],
    ["Enter", "Calls `onSubmit` (never while composing); the form submits natively."],
  ],
  states: {
    idle: "Not composing: Escape and Enter act.",
    composing: "An IME composition: Escape and Enter belong to the IME.",
  },
  contract: {
    actions: {
      type: ["pointer", "keyboard", "virtual"],
      fill: ["keyboard"],
      clear: ["pointer", "keyboard", "virtual"],
      escape: ["keyboard"],
      submit: ["keyboard"],
      compose: ["keyboard"],
      composeOpen: ["keyboard"],
      composeEnd: ["keyboard"],
      blur: ["keyboard"],
    },
    queries: ["value", "isEmpty", "isClearable", "description", "isInvalid", "isComposing"],
    traits: ["field-associated"],
  },
} as const satisfies ComponentMeta
