// The Switch's API facts for the generated docs (scripts/docs-gen.ts). Data only;
// checked against the code in switch.meta.test.ts.

import type { ComponentMeta } from "../meta"

const state = {
  "data-state": '"checked" or "unchecked", in every state.',
  "data-disabled": "While disabled.",
  "data-readonly": "While read-only.",
  "data-required": "While required.",
  "data-invalid": "While invalid.",
}
const focus = { "data-focus": "Focused.", "data-focus-visible": "Keyboard focus." }
const base = (part: string) => ({
  "data-scope": '"switch"',
  "data-part": `"${part}"`,
  "data-instance": "The instance id.",
  ...state,
})

export const switchMeta = {
  scope: "switch",
  name: "Switch",
  stateless: false,
  parts: [
    {
      name: "Switch.Root",
      part: "root",
      element: "div",
      description: "Owns the checked state and the hidden input.",
    },
    {
      name: "Switch.Control",
      part: "control",
      element: "button",
      description:
        'The focusable track (`role="switch"`, `aria-checked` always `"true"` or `"false"`); named by its Label.',
    },
    {
      name: "Switch.Thumb",
      part: "thumb",
      element: "span",
      description: 'The decorative moving knob; `aria-hidden="true"`.',
    },
    {
      name: "Switch.Label",
      part: "label",
      element: "label",
      description: "The visible name; pressing it toggles the Control.",
    },
    {
      name: "Switch.Description",
      part: "description",
      element: "div",
      description: "Help text, referenced by `aria-describedby`.",
    },
    {
      name: "Switch.HiddenInput",
      part: "hidden-input",
      element: "input",
      description: "The native checkbox that carries name, value, validity and form reset.",
    },
  ],
  props: {
    checked: { type: "boolean", description: "Controlled value." },
    defaultChecked: {
      type: "boolean",
      default: "false",
      description: "Uncontrolled initial value; a form reset restores its current value.",
    },
    onCheckedChange: {
      type: "(checked, { event }) => void",
      description:
        "Every user-caused change (`TOGGLE`, or `RESET`). Never called for a parent change.",
    },
    disabled: { type: "boolean", default: "false", description: "Ignores activation." },
    readOnly: {
      type: "boolean",
      default: "false",
      description: "Keeps focus and value, ignores activation.",
    },
    required: { type: "boolean", default: "false", description: "Must be on to submit." },
    name: { type: "string", description: "The submitted field name." },
    value: { type: "string", default: '"on"', description: "The submitted value while on." },
    form: { type: "string", description: "The id of the form the hidden input belongs to." },
    uncheckedValue: {
      type: "string",
      description: "Submitted under `name` while off (a hidden input).",
    },
  },
  dataAttributes: {
    root: { ...base("root"), ...focus },
    control: {
      ...base("control"),
      ...focus,
      "data-pressed": "While pressed.",
      "data-hover": "While hovered.",
    },
    thumb: base("thumb"),
    label: base("label"),
    description: base("description"),
  },
  keyboard: [["Space", "On the Control: toggles it. Enter does nothing (it submits the form)."]],
  states: {
    unchecked: "Off.",
    checked: "On.",
  },
  contract: {
    actions: {
      toggle: ["pointer", "keyboard", "touch", "virtual"],
      clickLabel: ["pointer", "virtual"],
      resetForm: ["pointer", "keyboard", "virtual"],
    },
    queries: [
      "isChecked",
      "isDisabled",
      "isReadOnly",
      "isRequired",
      "isInvalid",
      "name",
      "formValue",
    ],
    traits: ["form-associated", "field-associated"],
  },
} as const satisfies ComponentMeta
