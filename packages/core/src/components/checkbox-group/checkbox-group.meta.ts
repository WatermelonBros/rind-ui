// The Checkbox Group's API facts for the generated docs (scripts/docs-gen.ts). Data only;
// checked against the code in checkbox-group.meta.test.ts.

import type { ComponentMeta } from "../meta"

const flags = {
  "data-disabled": "While disabled.",
  "data-invalid": "While invalid.",
}
const base = (part: string) => ({
  "data-scope": '"checkbox-group"',
  "data-part": `"${part}"`,
  "data-instance": "The instance id.",
  ...flags,
})

export const checkboxGroupMeta = {
  scope: "checkbox-group",
  name: "Checkbox Group",
  stateless: false,
  parts: [
    {
      name: "CheckboxGroup.Root",
      part: "root",
      element: "div",
      description: 'Owns the value; `role="group"` (none when rendered as a `fieldset`).',
    },
    {
      name: "CheckboxGroup.Label",
      part: "label",
      element: "span",
      description: "Names the group (`aria-labelledby`); render it as a `legend` in a fieldset.",
    },
    {
      name: "CheckboxGroup.Description",
      part: "description",
      element: "p",
      description: "Help text, added to every item's `aria-describedby`.",
    },
    {
      name: "CheckboxGroup.ErrorMessage",
      part: "error-message",
      element: "p",
      description: "Shown while `invalid`; added to every item's `aria-describedby`. Not live.",
    },
    {
      name: "CheckboxGroup.Parent",
      part: "parent",
      element: "div",
      description: "The tri-state select-all Checkbox (needs `allValues`); never submitted.",
    },
  ],
  props: {
    value: { type: "string[]", description: "Controlled value (a set)." },
    defaultValue: {
      type: "string[]",
      default: "[]",
      description: "Uncontrolled initial value; a form reset restores its current value.",
    },
    onValueChange: {
      type: "(value, { reason }) => void",
      description: "Every user-caused change, once per event.",
    },
    allValues: {
      type: "string[]",
      description: "Every item value: what the Parent selects. Required to render `Parent`.",
    },
    disabled: { type: "boolean", default: "false", description: "Disables every item." },
    readOnly: { type: "boolean", default: "false", description: "Makes every item read-only." },
    required: { type: "boolean", default: "false", description: "Valid with one item checked." },
    invalid: { type: "boolean", default: "false", description: "Marks every item invalid." },
    name: { type: "string", description: "The submitted name of every checked item." },
    form: { type: "string", description: "The id of the form the hidden inputs belong to." },
  },
  dataAttributes: {
    root: {
      ...base("root"),
      "data-readonly": "While read-only.",
      "data-required": "While required.",
    },
    label: base("label"),
    description: base("description"),
    "error-message": base("error-message"),
  },
  keyboard: [["Space", "On an item or the Parent: toggles it. Each is its own Tab stop."]],
  states: { ready: "The only state; the value and the select-all cycle live in context." },
  contract: {
    actions: {
      toggle: ["pointer", "keyboard", "virtual"],
      toggleParent: ["pointer", "keyboard", "virtual"],
    },
    queries: ["value", "parentState", "isDisabled", "isRequired", "isInvalid"],
    traits: ["form-associated", "field-associated"],
  },
} as const satisfies ComponentMeta
