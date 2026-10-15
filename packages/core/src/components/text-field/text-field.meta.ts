// The Text Field's API facts for the generated docs (scripts/docs-gen.ts). Data only;
// checked against the code in text-field.meta.test.ts.

import type { ComponentMeta } from "../meta"

const fieldState = {
  "data-disabled": "While disabled.",
  "data-readonly": "While read-only.",
  "data-required": "While required.",
  "data-valid": "A valid result is displayed (Field).",
  "data-invalid": "An error is displayed (Field).",
  "data-validating": "An async check is running (Field).",
  "data-touched": "Focus has left it once (Field).",
  "data-dirty": "The value differs from the first one (Field).",
  "data-filled": "The value is not empty (Field).",
}
const base = (part: string) => ({
  "data-scope": '"text-field" (or a preset\'s scope)',
  "data-part": `"${part}"`,
  "data-instance": "The instance id.",
})

export const textFieldMeta = {
  scope: "text-field",
  name: "Text Field",
  stateless: false,
  parts: [
    {
      name: "TextField.Root",
      part: "root",
      element: "div",
      description: "A Field when not inside one; else it joins the enclosing Field.",
    },
    {
      name: "TextField.Label",
      part: "label",
      element: "label",
      description: "The Field's Label (not rendered inside a Field).",
    },
    {
      name: "TextField.Description",
      part: "description",
      element: "p",
      description: "The Field's Description (not rendered inside a Field).",
    },
    {
      name: "TextField.ErrorMessage",
      part: "error-message",
      element: "p",
      description: "The Field's ErrorMessage (not rendered inside a Field).",
    },
    {
      name: "TextField.Input",
      part: "input",
      element: "input",
      description: "A native `<input>`; every attribute is forwarded.",
    },
    {
      name: "TextField.Textarea",
      part: "textarea",
      element: "textarea",
      description: "A native `<textarea>`; `autosize` grows it with its content.",
    },
    {
      name: "TextField.ClearTrigger",
      part: "clear-trigger",
      element: "button",
      description:
        'Named "Clear", not in the Tab order; rendered only while there is something to clear.',
    },
    {
      name: "TextField.CharacterCount",
      part: "character-count",
      element: "span",
      description: "The count against `maxLength` or a soft `max`; in the control's description.",
    },
  ],
  props: {
    value: { type: "string | null", description: "Controlled value (`null` renders empty)." },
    defaultValue: { type: "string", description: "Uncontrolled: the DOM owns the value." },
    onValueChange: {
      type: "(value, { reason, event, isComposing }) => void",
      description:
        "Every change, with its reason (`INPUT`, `CLEAR`, `RESET`). Native `onChange` is forwarded untouched.",
    },
    focusableWhenDisabled: {
      type: "boolean",
      default: "false",
      description: "Disabled but focusable: read-only + `aria-disabled`.",
    },
    countThreshold: {
      type: "number",
      description: "Announce the count at this many remaining (default max(10, 20% of the limit)).",
    },
    messages: {
      type: "{ clear?, charactersRemaining?, charactersOver? }",
      description: "The ClearTrigger name and count announcements.",
    },
    fieldMessages: {
      type: "Field messages",
      description: "The Field's messages when the Root is the Field.",
    },
    autosize: {
      type: "boolean",
      default: "false",
      description: "On Textarea: grows with its content (native `field-sizing` where supported).",
    },
    max: {
      type: "number",
      description: "On CharacterCount: a soft limit (an error past it, never a truncation).",
    },
    count: { type: "(value) => number", description: "On CharacterCount: replaces the counter." },
  },
  dataAttributes: {
    root: {
      ...base("root"),
      ...fieldState,
      "data-focus": "The control has focus.",
      "data-focus-visible": "The control has keyboard focus.",
      "data-composing": "An IME composition is in progress.",
    },
    input: {
      ...base("input"),
      ...fieldState,
      "data-focus": "Focused.",
      "data-focus-visible": "Keyboard focus.",
      "data-composing": "Composing.",
    },
    "character-count": {
      ...base("character-count"),
      ...fieldState,
      "data-over-limit": "The count exceeds the limit.",
    },
  },
  keyboard: [
    ["Enter", "In an Input: commits the value (Field), unless an IME is composing."],
    ["⌘/Ctrl + A, Backspace", "Native editing; nothing is overridden."],
  ],
  states: {
    idle: "Not composing: changes validate, count and announce.",
    composing:
      "An IME composition: changes are reported (`isComposing`), never validated, counted or announced.",
  },
  contract: {
    actions: {
      type: ["pointer", "keyboard", "virtual"],
      fill: ["keyboard"],
      clear: ["pointer", "keyboard", "virtual"],
      compose: ["keyboard"],
      composeOpen: ["keyboard"],
      composeEnd: ["keyboard"],
      blur: ["keyboard"],
      reset: ["pointer", "keyboard", "virtual"],
    },
    queries: [
      "value",
      "name",
      "description",
      "isInvalid",
      "isDisabled",
      "isReadOnly",
      "isRequired",
      "errors",
      "characterCount",
      "isClearable",
      "isComposing",
    ],
    traits: ["field-associated"],
  },
} as const satisfies ComponentMeta
