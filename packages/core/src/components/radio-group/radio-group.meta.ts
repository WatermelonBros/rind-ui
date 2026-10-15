// The Radio Group's API facts for the generated docs (scripts/docs-gen.ts). Data only;
// checked against the code in radio-group.meta.test.ts.

import type { ComponentMeta } from "../meta"

const group = {
  "data-disabled": "While the group is disabled.",
  "data-readonly": "While the group is read-only.",
  "data-invalid": "While the group is invalid.",
}
const base = (part: string) => ({
  "data-scope": '"radio-group"',
  "data-part": `"${part}"`,
  "data-instance": "The instance id.",
})
const item = (part: string) => ({
  ...base(part),
  "data-key": "The item's value.",
  "data-state": '"checked" or "unchecked".',
  "data-disabled": "While the item (or the group) is disabled.",
  "data-readonly": "While the group is read-only.",
  "data-invalid": "While the group is invalid.",
})

export const radioGroupMeta = {
  scope: "radio-group",
  name: "Radio Group",
  stateless: false,
  parts: [
    {
      name: "RadioGroup.Root",
      part: "root",
      element: "div",
      description: 'Owns the value and the arrow keys; `role="radiogroup"`.',
    },
    {
      name: "RadioGroup.Label",
      part: "label",
      element: "span",
      description:
        "Names the group (`aria-labelledby`); not a `label`, a radiogroup is not labelable.",
    },
    {
      name: "RadioGroup.Description",
      part: "description",
      element: "p",
      description: "Help text, referenced by the group's `aria-describedby`.",
    },
    {
      name: "RadioGroup.ErrorMessage",
      part: "error-message",
      element: "p",
      description: "Shown while `invalid`; referenced by the group's `aria-describedby`.",
    },
    {
      name: "RadioGroup.Item",
      part: "item",
      element: "div",
      description: "One radio, paired with its state by `value`; renders the hidden input last.",
    },
    {
      name: "RadioGroup.ItemControl",
      part: "item-control",
      element: "button",
      description: 'The focusable radio (`role="radio"`, roving tab stop).',
    },
    {
      name: "RadioGroup.ItemIndicator",
      part: "item-indicator",
      element: "span",
      description: "Decorative checked cue; mounted only while checked.",
    },
    {
      name: "RadioGroup.ItemLabel",
      part: "item-label",
      element: "label",
      description: "Names the radio; a press on it checks the radio.",
    },
    {
      name: "RadioGroup.ItemDescription",
      part: "item-description",
      element: "p",
      description: "Help text for one radio (`aria-describedby` on its control).",
    },
  ],
  props: {
    value: { type: "string | null", description: "Controlled value (the checked radio)." },
    defaultValue: {
      type: "string | null",
      default: "null",
      description: "Uncontrolled initial value; a form reset restores its current value.",
    },
    onValueChange: {
      type: "(value, { reason, cancel }) => void",
      description: "Every user-caused change, once; `reason` is NAVIGATE, PRESS or RESET.",
    },
    orientation: {
      type: '"vertical" | "horizontal"',
      default: '"vertical"',
      description: "Only `aria-orientation` and `data-orientation`; every arrow key moves.",
    },
    disabled: { type: "boolean", default: "false", description: "Disables every radio." },
    focusableWhenDisabled: {
      type: "boolean",
      default: "false",
      description: "A disabled group stays one Tab stop (the root).",
    },
    readOnly: { type: "boolean", default: "false", description: "Navigable, never changes." },
    required: { type: "boolean", default: "false", description: "Valid with one radio checked." },
    invalid: { type: "boolean", default: "false", description: "Marks the group invalid." },
    name: { type: "string", description: "The submitted name (default: derived from the id)." },
    form: { type: "string", description: "The id of the form the hidden inputs belong to." },
  },
  dataAttributes: {
    root: {
      ...base("root"),
      ...group,
      "data-orientation": '"vertical" or "horizontal".',
      "data-required": "While required.",
    },
    label: { ...base("label"), ...group },
    description: { ...base("description"), ...group },
    "error-message": { ...base("error-message"), ...group },
    item: item("item"),
    "item-control": {
      ...item("item-control"),
      "data-highlighted": "While it is the roving focus target.",
      "data-focus": "While focused.",
      "data-focus-visible": "While focused by keyboard or script.",
      "data-pressed": "While pressed.",
      "data-hover": "While hovered.",
    },
    "item-indicator": item("item-indicator"),
    "item-label": item("item-label"),
    "item-description": item("item-description"),
  },
  keyboard: [
    [
      "ArrowDown / ArrowRight",
      "Moves to the next enabled radio and checks it (wraps; mirrored in RTL).",
    ],
    ["ArrowUp / ArrowLeft", "Moves to the previous enabled radio and checks it (wraps)."],
    ["Space", "Checks the focused radio."],
    ["Enter", "Submits the form; never checks."],
  ],
  states: {
    idle: "Focus is outside the group.",
    focused: "Focus is on a radio.",
  },
  contract: {
    actions: {
      check: ["pointer", "touch", "keyboard", "virtual"],
      focusRadio: ["keyboard"],
      arrowNext: ["keyboard"],
      leave: ["keyboard"],
      press: ["pointer", "touch", "keyboard", "virtual"],
    },
    queries: [
      "radios",
      "checked",
      "focusedRadio",
      "isDisabled",
      "isReadOnly",
      "isRequired",
      "isInvalid",
      "formValue",
    ],
    traits: [
      "composite-roving",
      "selectable",
      "directional",
      "form-associated",
      "field-associated",
    ],
  },
} as const satisfies ComponentMeta
