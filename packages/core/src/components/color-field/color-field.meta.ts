// Color Field's API facts for the generated docs (scripts/docs-gen.ts); checked in
// color-field.meta.test.ts.

import type { ComponentMeta } from "../meta"

export const colorFieldMeta = {
  scope: "color-field",
  name: "Color Field",
  stateless: false,
  notParts: ["ColorFlushContext", "ColorChannelField"],
  parts: [
    {
      name: "ColorField.Root",
      part: "root",
      element: "div",
      description: "A Field when not inside one; inside a Field it registers as its control.",
    },
    { name: "ColorField.Label", part: "label", element: "label", description: "The name." },
    {
      name: "ColorField.Description",
      part: "description",
      element: "p",
      description: "Help text.",
    },
    {
      name: "ColorField.ErrorMessage",
      part: "error-message",
      element: "p",
      description: "Shown while invalid.",
    },
    {
      name: "ColorField.Input",
      part: "input",
      element: "input",
      description: 'The `<input type="text">`: the text is free until a commit point.',
    },
  ],
  props: {
    value: { type: "string | Color | null", description: "The colour (controlled)." },
    defaultValue: {
      type: "string | Color | null",
      default: "null",
      description: "The initial colour; a form reset restores it.",
    },
    onValueChange: {
      type: "(color: Color | null, details) => void",
      description: "At a commit point (Enter, blur, flush) that changed the colour.",
    },
    onInputValueChange: {
      type: "(text: string) => void",
      description: "Every accepted edit of the text.",
    },
    format: {
      type: '"hex" | "css"',
      default: '"hex"',
      description: "Hex digits (with an optional `#`), or any CSS colour.",
    },
    alpha: {
      type: "boolean",
      default: "false",
      description: "Accept and show 8-digit hex; without it the alpha never changes.",
    },
    colorSpace: {
      type: '"rgb" | "hsl" | "hsb"',
      description: "The space a first colour is emitted in.",
    },
    name: { type: "string", description: "Submits `#RRGGBB` (`#RRGGBBAA` with alpha)." },
    required: { type: "boolean", default: "false", description: "Native constraint." },
    disabled: { type: "boolean", default: "false", description: "Disabled." },
    readOnly: { type: "boolean", default: "false", description: "Focusable, ignores edits." },
    messages: {
      type: "Partial<ColorFieldMessages>",
      description: "The invalid message and the colour words.",
    },
  },
  dataAttributes: {
    input: {
      "data-scope": '"color-field"',
      "data-part": '"input"',
      "data-instance": "The instance id.",
      "data-disabled": "Present when disabled.",
      "data-readonly": "Present when read-only.",
      "data-invalid": "Present while invalid (a draft that is not a colour, or the Field's).",
      "data-dirty": "Present while the text has an uncommitted edit.",
      "data-focus": "Present while focused.",
      "data-focus-visible": "Present while keyboard-focused.",
    },
  },
  keyboard: [
    ["Enter", "Commits the text."],
    ["Escape", "With an uncommitted edit: restores the colour's text."],
  ],
  states: {
    idle: "The text is the colour's.",
    editing: "An uncommitted edit.",
    invalid: "A committed text that is not a colour (kept as typed).",
  },
  contract: {
    actions: {
      type: ["keyboard"],
      commit: ["keyboard"],
      blur: ["keyboard"],
      paste: ["keyboard"],
      escape: ["keyboard"],
      fill: ["keyboard"],
      resetForm: ["pointer", "keyboard"],
    },
    queries: ["text", "color", "isInvalid", "isDirty", "formValue"],
    traits: ["form-associated", "field-associated"],
  },
} as const satisfies ComponentMeta
