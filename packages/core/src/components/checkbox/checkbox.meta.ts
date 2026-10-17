// The Checkbox's API facts for the generated docs (scripts/docs-gen.ts). Data only;
// checked against the code in checkbox.meta.test.ts.

import type { ComponentMeta } from "../meta"

const state = {
  "data-state": '"checked", "unchecked" or "indeterminate", in every state.',
  "data-disabled": "While disabled.",
  "data-readonly": "While read-only.",
  "data-required": "While required.",
  "data-invalid": "While invalid.",
}
const focus = { "data-focus": "Focused.", "data-focus-visible": "Keyboard focus." }
const base = (part: string) => ({
  "data-scope": '"checkbox"',
  "data-part": `"${part}"`,
  "data-instance": "The instance id.",
  ...state,
})

export const checkboxMeta = {
  scope: "checkbox",
  name: "Checkbox",
  stateless: false,
  parts: [
    {
      name: "CheckboxGroup.Item",
      part: "root",
      element: "div",
      description: "Owns the checked state and the hidden input.",
    },
    {
      name: "CheckboxGroup.ItemControl",
      part: "control",
      element: "button",
      description:
        'The focusable box (`role="checkbox"`, `aria-checked` always explicit); named by its Label.',
    },
    {
      name: "CheckboxGroup.ItemIndicator",
      part: "indicator",
      element: "span",
      description: 'A decorative check or dash slot; `aria-hidden="true"`.',
    },
    {
      name: "CheckboxGroup.ItemLabel",
      part: "label",
      element: "label",
      description: "The visible name; pressing it toggles the Control.",
    },
    {
      name: "CheckboxGroup.ItemDescription",
      part: "description",
      element: "div",
      description: "Help text, referenced by `aria-describedby`.",
    },
    {
      name: "CheckboxGroup.ItemHiddenInput",
      part: "hidden-input",
      element: "input",
      description: "The native checkbox that carries name, value, validity and form reset.",
    },
  ],
  props: {
    checked: { type: 'boolean | "indeterminate"', description: "Controlled value." },
    defaultChecked: {
      type: 'boolean | "indeterminate"',
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
    required: { type: "boolean", default: "false", description: "Must be checked to submit." },
    name: { type: "string", description: "The submitted field name." },
    value: { type: "string", default: '"on"', description: "The submitted value while checked." },
    form: { type: "string", description: "The id of the form the hidden input belongs to." },
    uncheckedValue: {
      type: "string",
      description: "Submitted under `name` while unchecked (a hidden input).",
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
    indicator: base("indicator"),
    label: base("label"),
    description: base("description"),
  },
  keyboard: [["Space", "On the Control: toggles it. Enter does nothing."]],
  states: {
    unchecked: "Not checked.",
    checked: "Checked.",
    indeterminate: "Mixed; the next user action checks it.",
  },
  contract: {
    actions: {
      toggle: ["pointer", "keyboard", "touch", "virtual"],
      check: ["pointer", "keyboard", "touch", "virtual"],
      uncheck: ["pointer", "keyboard", "touch", "virtual"],
      clickLabel: ["pointer", "virtual"],
      resetForm: ["pointer", "keyboard", "virtual"],
    },
    queries: [
      "checkedState",
      "isChecked",
      "isIndeterminate",
      "isDisabled",
      "isReadOnly",
      "isRequired",
      "isInvalid",
      "name",
      "description",
      "formValue",
    ],
    traits: ["form-associated", "field-associated"],
  },
} as const satisfies ComponentMeta
