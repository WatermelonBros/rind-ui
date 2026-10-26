// Angle Slider's API facts for the generated docs (scripts/docs-gen.ts). Data only; checked
// against the code in angle-slider.test.ts. (`.pending` until the React parts land.)

import type { ComponentMeta } from "../meta"

const base = (part: string) => ({
  "data-scope": '"angle-slider"',
  "data-part": `"${part}"`,
  "data-instance": "The instance id.",
  "data-dragging": "While a pointer drags.",
  "data-disabled": "While disabled.",
  "data-readonly": "While read-only.",
  "data-invalid": "While invalid.",
})
const focus = { "data-focus": "The input is focused.", "data-focus-visible": "Keyboard focus." }

export const angleSliderMeta = {
  scope: "angle-slider",
  name: "Angle Slider",
  stateless: false,
  parts: [
    {
      name: "AngleSlider.Root",
      part: "root",
      element: "div",
      description: "Holds the angle; sets `--rind-angle-slider-angle` and `-fraction`.",
    },
    { name: "AngleSlider.Label", part: "label", element: "label", description: "Names the input." },
    {
      name: "AngleSlider.Control",
      part: "control",
      element: "div",
      description: "The round surface: a press sets the angle around its centre and drags.",
    },
    {
      name: "AngleSlider.Thumb",
      part: "thumb",
      element: "div",
      description: "The handle, rotated by the angle; shows the input's focus.",
    },
    {
      name: "AngleSlider.Input",
      part: "input",
      element: "input",
      description: "A visually hidden native range input: the one focusable, announced slider.",
    },
    {
      name: "AngleSlider.Value",
      part: "value",
      element: "span",
      description: "The formatted angle (hidden from assistive technology).",
    },
    {
      name: "AngleSlider.MarkerGroup",
      part: "marker-group",
      element: "div",
      description: "Holds the markers.",
    },
    {
      name: "AngleSlider.Marker",
      part: "marker",
      element: "div",
      description: "A tick at `value` degrees, placed by `--rind-angle-slider-marker-angle`.",
    },
  ],
  props: {
    value: { type: "number", description: "Controlled angle in degrees, [0, 360)." },
    defaultValue: { type: "number", default: "0", description: "Uncontrolled angle." },
    onValueChange: { type: "(value, details) => void", description: "Every change." },
    onValueCommit: {
      type: "(value, { reason }) => void",
      description: "Once per interaction: a drag's release, a key, a native change.",
    },
    step: {
      type: "number",
      default: "1",
      description: "Degrees per step; values snap to the nearest.",
    },
    largeStep: { type: "number", default: "15", description: "Shift+Arrow, PageUp and PageDown." },
    wrap: { type: "boolean", default: "true", description: "A step past an end wraps around." },
    disabled: { type: "boolean", default: "false", description: "No change; not submitted." },
    readOnly: {
      type: "boolean",
      default: "false",
      description: "Submitted and focusable; no change.",
    },
    invalid: { type: "boolean", default: "false", description: "Marks the input invalid." },
    name: { type: "string", description: "The form field's name." },
    form: { type: "string", description: "The form's id, when outside it." },
    messages: { type: "Partial<AngleSliderMessages>", description: "Overrides `valueText`." },
    render: {
      type: "RenderProp",
      description: "Substitutes the rendered element without changing behaviour.",
    },
  },
  dataAttributes: {
    root: base("root"),
    label: base("label"),
    control: base("control"),
    thumb: { ...base("thumb"), ...focus },
    input: { ...base("input"), ...focus },
    value: base("value"),
    "marker-group": base("marker-group"),
    marker: {
      ...base("marker"),
      "data-value": "The marker's angle.",
      "data-state": '"under-value", "at-value" or "over-value".',
    },
  },
  keyboard: [
    ["ArrowRight, ArrowUp", "Clockwise by `step`."],
    ["ArrowLeft, ArrowDown", "Counter-clockwise by `step`."],
    ["Shift+Arrow, PageUp, PageDown", "By `largeStep`."],
    ["Home, End", "0 and the largest angle."],
    ["Escape", "While dragging: back to the angle at the press."],
  ],
  states: { idle: "At rest.", dragging: "A pointer drags the angle." },
  contract: {
    actions: {
      setAngle: ["pointer", "touch", "virtual"],
      step: ["keyboard", "virtual"],
      toEdge: ["keyboard", "virtual"],
    },
    queries: ["value", "valueText", "isDragging"],
    traits: [],
  },
} as const satisfies ComponentMeta
