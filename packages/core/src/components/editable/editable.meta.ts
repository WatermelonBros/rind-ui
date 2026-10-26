// Editable's API facts for the generated docs (scripts/docs-gen.ts). Data only; checked against
// the code in editable.test.ts. (`.pending` until the React parts land.)

import type { ComponentMeta } from "../meta"

const base = (part: string) => ({
  "data-scope": '"editable"',
  "data-part": `"${part}"`,
  "data-instance": "The instance id.",
  "data-state": '"preview" or "edit".',
  "data-empty": "The value is empty.",
  "data-disabled": "While disabled.",
  "data-readonly": "While read-only.",
  "data-invalid": "While invalid.",
})
const focus = { "data-focus": "Focused.", "data-focus-visible": "Keyboard focus." }

export const editableMeta = {
  scope: "editable",
  name: "Editable",
  stateless: false,
  parts: [
    {
      name: "Editable.Root",
      part: "root",
      element: "div",
      description: "Holds the value; renders the hidden form input.",
    },
    {
      name: "Editable.Label",
      part: "label",
      element: "label",
      description: "Names the Preview and the Input.",
    },
    {
      name: "Editable.Area",
      part: "area",
      element: "div",
      description: "The cell the Preview and the Input share (no layout jump).",
    },
    {
      name: "Editable.Preview",
      part: "preview",
      element: "button",
      description:
        "Shows the value (or the placeholder); named by the Label and the value. Enters edit by `activationMode`.",
    },
    {
      name: "Editable.Input",
      part: "input",
      element: "input",
      description: "The draft while editing (a textarea with `render`).",
    },
    {
      name: "Editable.Control",
      part: "control",
      element: "div",
      description: "Groups the triggers.",
    },
    {
      name: "Editable.EditTrigger",
      part: "edit-trigger",
      element: "button",
      description: "Enters edit.",
    },
    {
      name: "Editable.SubmitTrigger",
      part: "submit-trigger",
      element: "button",
      description: "Commits the draft.",
    },
    {
      name: "Editable.CancelTrigger",
      part: "cancel-trigger",
      element: "button",
      description: "Restores the value at entry.",
    },
  ],
  props: {
    value: { type: "string", description: "Controlled committed value." },
    defaultValue: { type: "string", default: '""', description: "Uncontrolled committed value." },
    onValueChange: {
      type: "(value, details) => void",
      description: "A commit; `details.event.reason` says how.",
    },
    edit: { type: "boolean", description: "Controlled edit state." },
    defaultEdit: { type: "boolean", default: "false", description: "Uncontrolled edit state." },
    onEditChange: {
      type: "(edit, details) => void",
      description:
        "Entering or leaving edit, with the reason; `details.cancel()` keeps the user where they are.",
    },
    onDraftChange: { type: "(draft: string) => void", description: "Each edit of the draft." },
    activationMode: {
      type: '"click" | "dblclick" | "focus" | "none"',
      default: '"click"',
      description: "How the Preview enters edit (Enter and Space always do, except `none`).",
    },
    submitMode: {
      type: '"both" | "enter" | "blur" | "none"',
      default: '"both"',
      description: "Whether an outside press submits (both, blur) or cancels (enter, none).",
    },
    selectOnFocus: {
      type: "boolean",
      default: "true",
      description: "Select the text on entering edit.",
    },
    placeholder: {
      type: "string | { edit, preview }",
      description: "Shown when the value is empty.",
    },
    maxLength: { type: "number", description: "The Input's maximum length." },
    disabled: { type: "boolean", default: "false", description: "No edit; not submitted." },
    readOnly: { type: "boolean", default: "false", description: "Shown and submitted; no edit." },
    required: { type: "boolean", default: "false", description: "An empty value blocks submit." },
    invalid: { type: "boolean", default: "false", description: "Marks the field invalid." },
    name: { type: "string", description: "The form field's name." },
    messages: { type: "Partial<EditableMessages>", description: "Overrides the strings." },
    render: {
      type: "RenderProp",
      description: "Substitutes the rendered element without changing behaviour.",
    },
  },
  dataAttributes: {
    root: base("root"),
    label: base("label"),
    area: base("area"),
    preview: { ...base("preview"), ...focus },
    input: { ...base("input"), ...focus },
    control: base("control"),
    "edit-trigger": { ...base("edit-trigger"), ...focus },
    "submit-trigger": { ...base("submit-trigger"), ...focus },
    "cancel-trigger": { ...base("cancel-trigger"), ...focus },
  },
  keyboard: [
    ["Enter, Space", "On the Preview: edit."],
    ["Enter", "In the Input: save (Ctrl/⌘+Enter in a textarea)."],
    ["Escape", "In the Input: cancel, restoring the value at entry."],
  ],
  states: { preview: "Showing the value.", edit: "Editing the draft." },
  contract: {
    actions: {
      edit: ["pointer", "keyboard", "touch", "virtual"],
      type: ["keyboard"],
      submit: ["pointer", "keyboard", "touch", "virtual"],
      cancel: ["pointer", "keyboard", "touch", "virtual"],
    },
    queries: ["isEditing", "value", "draft", "previewText"],
    traits: [],
  },
} as const satisfies ComponentMeta
