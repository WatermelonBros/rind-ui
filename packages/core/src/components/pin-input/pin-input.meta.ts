// The Pin Input's API facts for the generated docs (scripts/docs-gen.ts). Data only;
// checked against the code in pin-input.meta.test.ts.

import type { ComponentMeta } from "../meta"

const fieldState = {
  "data-disabled": "While disabled.",
  "data-readonly": "While read-only.",
  "data-invalid": "An error is displayed (Field).",
}
const base = (part: string) => ({
  "data-scope": '"pin-input"',
  "data-part": `"${part}"`,
  "data-instance": "The instance id.",
})
const focusState = {
  "data-focus": "The input has focus.",
  "data-focus-visible": "The input has keyboard focus.",
  "data-complete": "The value has `length` characters.",
  "data-composing": "An IME composition is in progress.",
}

export const pinInputMeta = {
  scope: "pin-input",
  name: "Pin Input",
  stateless: false,
  parts: [
    {
      name: "PinInput.Root",
      part: "root",
      element: "div",
      description: 'A Field when not inside one; `dir="ltr"` unless set.',
    },
    {
      name: "PinInput.Label",
      part: "label",
      element: "label",
      description: "The Field's Label: the one name of the code.",
    },
    {
      name: "PinInput.Description",
      part: "description",
      element: "p",
      description: "The Field's Description (not rendered inside a Field).",
    },
    {
      name: "PinInput.ErrorMessage",
      part: "error-message",
      element: "p",
      description: "The Field's ErrorMessage (not rendered inside a Field).",
    },
    {
      name: "PinInput.Control",
      part: "control",
      element: "div",
      description: "The positioning context of the input and the slots.",
    },
    {
      name: "PinInput.Input",
      part: "input",
      element: "input",
      description:
        "The one native input, transparent over the slots: the form control, autofill and paste target.",
    },
    {
      name: "PinInput.Slot",
      part: "slot",
      element: "div",
      description: "One position (`index`), `aria-hidden`; shows its character or the mask.",
    },
  ],
  props: {
    length: { type: "number", description: "The number of characters (a positive integer)." },
    value: {
      type: "string | null",
      description: "Controlled; `null` and `undefined` render empty.",
    },
    defaultValue: { type: "string", default: '""', description: "Uncontrolled initial value." },
    onValueChange: {
      type: "(value, { reason }) => void",
      description: "Reasons `INPUT`, `PASTE`, `AUTOFILL`, `RESET`.",
    },
    onValueComplete: {
      type: "(value) => void",
      description: "A user change filled the code (also a paste or fill replacing a full one).",
    },
    onValueInvalid: { type: "(text) => void", description: "An insertion was refused." },
    validationType: {
      type: '"numeric" | "alphanumeric" | "alpha"',
      default: '"numeric"',
      description: "The accepted ASCII characters.",
    },
    pattern: { type: "RegExp", description: "One accepted character (replaces `validationType`)." },
    sanitize: {
      type: "(text) => string",
      description: "Applied after NFKC, e.g. uppercasing.",
    },
    mask: {
      type: "boolean",
      default: "false",
      description: "A password input; slots show `maskChar`.",
    },
    maskChar: { type: "string", default: '"•"', description: "The mask character." },
    autoComplete: {
      type: "string",
      default: '"one-time-code"',
      description: '`"off"` for a PIN, or any value.',
    },
    autoSubmit: {
      type: "boolean",
      default: "false",
      description: "`requestSubmit()` once a user change completes the code; focus never moves.",
    },
    enterKeyHint: { type: "string", description: "The virtual keyboard's Enter label." },
  },
  dataAttributes: {
    root: { ...base("root"), ...fieldState, ...focusState },
    control: { ...base("control"), ...fieldState, ...focusState },
    input: { ...base("input"), ...fieldState, ...focusState },
    slot: {
      ...base("slot"),
      ...fieldState,
      "data-index": "Its position, from 0.",
      "data-filled": "It holds a character.",
      "data-active": "The input is focused and the caret is here.",
      "data-caret": "Active and empty (where the next character goes).",
      "data-masked": "Masked and filled.",
    },
  },
  keyboard: [
    ["Characters", "Fill the slot at the caret and move on; a refused character changes nothing."],
    ["Backspace / Delete, ⌘/Ctrl+Backspace", "Native editing on the one input."],
    ["Arrow keys, Home, End", "Move the caret (native)."],
    ["Enter", "Never prevented: the form submits (an incomplete required code is invalid)."],
  ],
  states: {
    idle: "Not composing: insertions are planned and filtered.",
    composing: "An IME composition: the text is applied once at its end.",
  },
  contract: {
    actions: {
      type: ["pointer", "keyboard", "virtual"],
      paste: ["keyboard"],
      fill: ["keyboard"],
      autofill: ["pointer", "keyboard", "virtual"],
      backspace: ["keyboard"],
      clear: ["keyboard"],
      pressSlot: ["pointer", "keyboard", "virtual"],
      compose: ["keyboard"],
      composeOpen: ["keyboard"],
      composeEnd: ["keyboard"],
      reset: ["pointer", "keyboard", "virtual"],
    },
    queries: [
      "value",
      "slots",
      "activeSlot",
      "isComplete",
      "isDisabled",
      "isReadOnly",
      "isInvalid",
      "isComposing",
    ],
    traits: ["field-associated"],
  },
} as const satisfies ComponentMeta
