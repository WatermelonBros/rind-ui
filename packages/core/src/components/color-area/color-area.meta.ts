// Color Area's API facts for the generated docs (scripts/docs-gen.ts); checked in
// color-area.meta.test.ts.

import type { ComponentMeta } from "../meta"

export const colorAreaMeta = {
  scope: "color-area",
  name: "Color Area",
  stateless: false,
  parts: [
    {
      name: "ColorArea.Root",
      part: "root",
      element: "div",
      description: '`role="group"`, the pointer surface. Not focusable.',
    },
    {
      name: "ColorArea.Background",
      part: "background",
      element: "div",
      description: "The decorative gradient (`aria-hidden`).",
    },
    {
      name: "ColorArea.Thumb",
      part: "thumb",
      element: "div",
      description:
        "The handle, positioned from the value; renders the two native range inputs (x, then y).",
    },
  ],
  props: {
    value: { type: "string | Color", description: "The colour (controlled)." },
    defaultValue: {
      type: "string | Color",
      default: '"hsb(0, 0%, 100%)"',
      description: "The initial colour (uncontrolled); a form reset restores it.",
    },
    onValueChange: {
      type: "(color: Color, details) => void",
      description:
        "Each applied change, in the space of the colour you passed; not for a change that leaves the emitted colour as it is (hue at black).",
    },
    onValueCommit: {
      type: "(color: Color, details) => void",
      description: "Once at the end of each interaction that changed the colour.",
    },
    colorSpace: {
      type: '"rgb" | "hsl" | "hsb"',
      description: "The space of the axes (default: the colour's space, else `hsb`).",
    },
    xChannel: {
      type: "ColorChannel",
      description: "Default: saturation (hsb, hsl), red (rgb).",
    },
    yChannel: {
      type: "ColorChannel",
      description: "Default: brightness (hsb), lightness (hsl), green (rgb).",
    },
    xName: { type: "string", description: "Submits the x channel under this name." },
    yName: { type: "string", description: "Submits the y channel under this name." },
    form: { type: "string", description: "The id of the form the inputs belong to." },
    disabled: { type: "boolean", default: "false", description: "Ignores presses and keys." },
    readOnly: {
      type: "boolean",
      default: "false",
      description: "Focusable, changes nothing.",
    },
    colorName: {
      type: "string | (color) => string",
      description: "Replaces the colour name in the value text.",
    },
    locale: { type: "string", description: "Formats the value text." },
    dir: { type: '"ltr" | "rtl"', description: "Mirrors the x axis." },
    messages: {
      type: "Partial<ColorAreaMessages>",
      description: "Names, role description, value text, colour words.",
    },
    "*.render": {
      type: "ReactElement | (props, state) => ReactNode",
      description: "Another element.",
    },
  },
  dataAttributes: {
    root: {
      "data-scope": '"color-area"',
      "data-part": '"root"',
      "data-instance": "The instance id.",
      "data-disabled": "Present when disabled.",
      "data-readonly": "Present when read-only.",
      "data-dragging": "Present while dragging.",
      "data-focus": "Present while either input has focus.",
      "data-focus-visible": "Present while either input has keyboard focus.",
    },
    thumb: {
      "data-scope": '"color-area"',
      "data-part": '"thumb"',
      "data-instance": "The instance id.",
      "data-disabled": "Present when disabled.",
      "data-readonly": "Present when read-only.",
      "data-dragging": "Present while dragging.",
      "data-focus": "Present while either input has focus.",
      "data-focus-visible": "Present while either input has keyboard focus.",
    },
  },
  keyboard: [
    ["ArrowLeft / ArrowRight", "The x channel by one step (mirrored in right-to-left)."],
    ["ArrowUp / ArrowDown", "The y channel by one step; focus moves to the y input."],
    ["Shift + arrow", "By the channel's page step."],
    ["PageUp / PageDown", "The y channel by its page step."],
    ["Home / End", "The x channel to its minimum / maximum."],
    ["Escape", "While dragging: cancels the drag and restores the colour."],
  ],
  states: {
    idle: "No pointer drag.",
    dragging: "A pointer drag is active.",
  },
  contract: {
    actions: {
      focusAxis: ["keyboard"],
      step: ["keyboard"],
      toEdge: ["keyboard"],
      setChannels: ["keyboard", "pointer"],
      pressAt: ["pointer", "touch", "keyboard"],
      pointerDown: ["pointer", "touch"],
      pointerMove: ["pointer", "touch"],
      pointerUp: ["pointer", "touch"],
      cancelDrag: ["keyboard", "pointer", "touch"],
      adjustNative: ["keyboard"],
      resetForm: ["pointer", "keyboard"],
    },
    queries: [
      "channels",
      "color",
      "valueText",
      "colorName",
      "focusedAxis",
      "isDragging",
      "formValues",
    ],
    traits: ["directional", "form-associated"],
  },
} as const satisfies ComponentMeta
