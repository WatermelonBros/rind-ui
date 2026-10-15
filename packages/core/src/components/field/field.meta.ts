// The Field's API facts for the generated docs (scripts/docs-gen.ts). Data only; checked
// against the code in field.meta.test.ts.

import type { ComponentMeta } from "../meta"

const state = (part: string) => ({
  "data-scope": '"field"',
  "data-part": `"${part}"`,
  "data-instance": "The instance id.",
  "data-disabled": "While disabled (own prop or an enclosing Fieldset).",
  "data-readonly": "While `readOnly`.",
  "data-required": "While `required`.",
  "data-valid": "A validation result is displayed and valid (never while disabled).",
  "data-invalid": "An error is displayed (never while disabled).",
  "data-validating": "An asynchronous `validate` is running.",
  "data-touched": "Focus has left the field at least once.",
  "data-dirty": "The value differs from the first registered value.",
  "data-filled": "The value is not empty.",
})

export const fieldMeta = {
  scope: "field",
  name: "Field",
  stateless: false,
  parts: [
    {
      name: "Field.Root",
      part: "root",
      element: "div",
      description: "Wraps one form control. No role.",
    },
    {
      name: "Field.Label",
      part: "label",
      element: "label",
      description: "Names the control (`for`, or `aria-labelledby` for a group).",
    },
    {
      name: "Field.Description",
      part: "description",
      element: "p",
      description: "Help text, first in the control's `aria-describedby`.",
    },
    {
      name: "Field.ErrorMessage",
      part: "error-message",
      element: "p",
      description:
        "Rendered while an error is displayed; `match` picks one validity key. Not a live region.",
    },
  ],
  props: {
    name: {
      type: "string",
      description: "The control's `name` when it has none; the key of `validate`'s values.",
    },
    disabled: {
      type: "boolean",
      default: "false",
      description: "Disables the control; no validity is displayed.",
    },
    readOnly: { type: "boolean", default: "false", description: "Makes the control read-only." },
    required: {
      type: "boolean",
      default: "false",
      description: "Native `required` (`aria-required` in `aria` behaviour).",
    },
    invalid: {
      type: "boolean",
      description: "`true` forces invalid, `false` valid; `undefined` validates.",
    },
    errors: {
      type: "string[]",
      description: "External errors (server): shown at once, cleared by the next change.",
    },
    validate: {
      type: "(value, values) => string | string[] | null | Promise<…>",
      description: "Runs after native constraints pass.",
    },
    validationMode: {
      type: '"submit" | "blur" | "change"',
      default: '"submit"',
      description: "When errors are displayed.",
    },
    validationBehavior: {
      type: '"native" | "aria"',
      default: '"native"',
      description: "Whether an invalid Field blocks submission.",
    },
    validationDebounce: {
      type: "number",
      default: "0",
      description: "Delays `validate` in `change` mode (ms).",
    },
    touched: { type: "boolean", description: "Controlled touched flag." },
    dirty: { type: "boolean", description: "Controlled dirty flag." },
    errorMessageAttribute: {
      type: '"describedby" | "both"',
      default: '"describedby"',
      description: "`both` adds `aria-errormessage`.",
    },
    messages: {
      type: "{ errorAnnouncement?, invalid?, valueMissing?, … }",
      description: "Announcement and per-constraint messages.",
    },
    match: {
      type: "ValidityKey",
      description: "On ErrorMessage: rendered only when this key is the cause.",
    },
  },
  dataAttributes: {
    root: {
      ...state("root"),
      "data-focus": "The control has focus.",
      "data-focus-visible": "The control has keyboard focus.",
    },
    label: state("label"),
    description: state("description"),
    "error-message": state("error-message"),
  },
  keyboard: [],
  states: {
    idle: "Nothing displayed yet (the mode has not allowed it).",
    validating: "An asynchronous `validate` is running; the previous display stays.",
    valid: "A valid result is displayed.",
    invalid: "An error is displayed.",
  },
  contract: {
    actions: {
      focus: ["pointer", "keyboard", "virtual"],
      blur: ["pointer", "keyboard", "virtual"],
      type: ["keyboard"],
    },
    queries: [
      "isValid",
      "isInvalid",
      "isValidating",
      "isTouched",
      "isDirty",
      "isFilled",
      "isRequired",
      "isDisabled",
      "isReadOnly",
      "errors",
      "description",
      "label",
      "controlName",
      "controlDescription",
    ],
    traits: [],
  },
} as const satisfies ComponentMeta
