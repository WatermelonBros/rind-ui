// Color Swatch Picker's API facts for the generated docs (scripts/docs-gen.ts); checked in
// color-swatch-picker.meta.test.ts. Every Radio Group rule applies as well.

import type { ComponentMeta } from "../meta"

export const colorSwatchPickerMeta = {
  scope: "color-swatch-picker",
  name: "Color Swatch Picker",
  stateless: false,
  parts: [
    {
      name: "ColorSwatchPicker.Root",
      part: "root",
      element: "div",
      description: 'The Radio Group root (`role="radiogroup"`).',
    },
    {
      name: "ColorSwatchPicker.Item",
      part: "item",
      element: "div + button",
      description: 'A Radio Group item and its control (`role="radio"`), named by the colour.',
    },
    {
      name: "ColorSwatchPicker.Swatch",
      part: "root",
      element: "div",
      description: "The item's colour (a decorative Color Swatch).",
    },
    {
      name: "ColorSwatchPicker.Indicator",
      part: "item-indicator",
      element: "span",
      description: "Mounted only while the item is checked (a check mark).",
    },
  ],
  props: {
    value: {
      type: "string | Color | null",
      description: "The colour (controlled); the matching swatch is checked.",
    },
    defaultValue: {
      type: "string | Color | null",
      default: "null",
      description: "The initial colour.",
    },
    onValueChange: {
      type: "(color: Color, details) => void",
      description: "A swatch was checked; `details.value` is its key, `details.index` its index.",
    },
    name: { type: "string", description: "Submits the checked item's key (`#RRGGBBAA`)." },
    disabled: { type: "boolean", default: "false", description: "As Radio Group." },
    readOnly: { type: "boolean", default: "false", description: "As Radio Group." },
    "Item.color": { type: "string | Color", description: "The swatch's colour." },
    "Item.value": {
      type: "string",
      description: "The item's key (default the canonical `#RRGGBBAA`); tells equal colours apart.",
    },
    "Item.colorName": {
      type: "string | (color) => string",
      description: "A design-token name instead of the computed one.",
    },
  },
  dataAttributes: {
    root: {
      "data-color-swatch-picker": "Present: the theme's hook (parts keep Radio Group's scope).",
    },
  },
  keyboard: [
    ["ArrowRight / ArrowDown", "The next enabled swatch, checked (wraps; mirrored in RTL)."],
    ["ArrowLeft / ArrowUp", "The previous enabled swatch, checked."],
    ["Space", "Checks the focused swatch."],
  ],
  states: {
    idle: "No swatch focused.",
    focused: "A swatch has focus.",
  },
  contract: {
    actions: {},
    queries: ["colors", "selected", "selectedColor"],
    traits: ["form-associated", "field-associated", "directional"],
  },
} as const satisfies ComponentMeta
