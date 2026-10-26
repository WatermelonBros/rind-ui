// Color Wheel's API facts for the generated docs (scripts/docs-gen.ts). Data only; checked
// against the code in color-wheel.test.ts.

import type { ComponentMeta } from "../meta"

const base = (part: string) => ({
  "data-scope": '"color-wheel"',
  "data-part": `"${part}"`,
  "data-instance": "The instance id.",
  "data-space": '"hsl" or "hsb": the working space.',
  "data-dragging": "While a pointer drags.",
  "data-disabled": "While disabled.",
  "data-readonly": "While read-only.",
  "data-invalid": "While invalid.",
})
const focus = { "data-focus": "The input is focused.", "data-focus-visible": "Keyboard focus." }

export const colorWheelMeta = {
  scope: "color-wheel",
  name: "Color Wheel",
  stateless: false,
  parts: [
    {
      name: "ColorWheel.Root",
      part: "root",
      element: "div",
      description: "A group; sets `--rind-color-wheel-angle` and `--rind-color-wheel-thumb-color`.",
    },
    { name: "ColorWheel.Label", part: "label", element: "label", description: "Names the slider." },
    {
      name: "ColorWheel.Track",
      part: "track",
      element: "div",
      description:
        "The hue ring (`--rind-color-wheel-gradient`); a press on the ring sets the hue and drags.",
    },
    {
      name: "ColorWheel.Thumb",
      part: "thumb",
      element: "div",
      description: "The handle on the ring, rotated by the hue; shows the input's focus.",
    },
    {
      name: "ColorWheel.Input",
      part: "input",
      element: "input",
      description: "A visually hidden native range input of the hue: the one focusable slider.",
    },
    {
      name: "ColorWheel.Value",
      part: "value",
      element: "span",
      description: "The formatted hue (hidden from assistive technology).",
    },
  ],
  props: {
    value: { type: "string | Color", description: "Controlled colour." },
    defaultValue: {
      type: "string | Color",
      default: '"hsl(0 100% 50%)"',
      description: "Uncontrolled colour.",
    },
    onValueChange: {
      type: "(value: Color, details) => void",
      description: "Every change of the hue.",
    },
    onValueCommit: {
      type: "(value: Color, { reason }) => void",
      description: "Once per interaction: a drag's release, a press, a key.",
    },
    colorSpace: {
      type: '"hsl" | "hsb"',
      default: '"hsl"',
      description: "The space the colour is emitted in.",
    },
    step: { type: "number", default: "1", description: "Degrees per step." },
    largeStep: { type: "number", default: "15", description: "Shift+Arrow, PageUp and PageDown." },
    disabled: { type: "boolean", default: "false", description: "No change; not submitted." },
    readOnly: {
      type: "boolean",
      default: "false",
      description: "Submitted and focusable; no change.",
    },
    invalid: { type: "boolean", default: "false", description: "Marks the input invalid." },
    name: { type: "string", description: "Submits the colour as hex." },
    form: { type: "string", description: "The form's id, when outside it." },
    messages: {
      type: "Partial<ColorWheelMessages>",
      description: "Overrides the hue names and value text.",
    },
    render: {
      type: "RenderProp",
      description: "Substitutes the rendered element without changing behaviour.",
    },
  },
  dataAttributes: {
    root: base("root"),
    label: base("label"),
    track: base("track"),
    thumb: { ...base("thumb"), ...focus },
    input: { ...base("input"), ...focus },
    value: base("value"),
  },
  keyboard: [
    ["ArrowRight, ArrowUp", "Hue + `step`."],
    ["ArrowLeft, ArrowDown", "Hue − `step`."],
    ["Shift+Arrow, PageUp, PageDown", "By `largeStep`."],
    ["Home, End", "0° and the largest hue."],
    ["Escape", "While dragging: back to the hue at the press."],
  ],
  states: { idle: "At rest.", dragging: "A pointer drags the hue." },
  contract: {
    actions: {
      setHue: ["pointer", "touch", "virtual"],
      step: ["keyboard", "virtual"],
      toEdge: ["keyboard", "virtual"],
    },
    queries: ["hue", "value", "valueText", "isDragging"],
    traits: [],
  },
} as const satisfies ComponentMeta
