// The Slider's API facts for the generated docs (scripts/docs-gen.ts). Data only;
// checked against the code in slider.meta.test.ts.

import type { ComponentMeta } from "../meta"

const state = {
  "data-orientation": '"horizontal" or "vertical".',
  "data-disabled": "While disabled.",
  "data-readonly": "While read-only.",
  "data-required": "While required.",
  "data-invalid": "While invalid.",
  "data-dragging": "While a thumb is being dragged.",
}
const focus = { "data-focus": "Focused.", "data-focus-visible": "Keyboard focus." }
const base = (part: string) => ({
  "data-scope": '"slider"',
  "data-part": `"${part}"`,
  "data-instance": "The instance id.",
  ...state,
})
const shared = (part: string) => ({ ...base(part), ...focus })

export const sliderMeta = {
  scope: "slider",
  name: "Slider",
  stateless: false,
  parts: [
    {
      name: "Slider.Root",
      part: "root",
      element: "div",
      description: 'Owns the values; `role="group"`, named by its Label.',
    },
    {
      name: "Slider.Label",
      part: "label",
      element: "label",
      description: "The visible name; pressing it focuses the first enabled thumb.",
    },
    {
      name: "Slider.ValueText",
      part: "value-text",
      element: "div",
      description: "The formatted value(s), the same text as `aria-valuetext`.",
    },
    {
      name: "Slider.Control",
      part: "control",
      element: "div",
      description: "The pointer target: pressing it moves the nearest thumb; dragging starts here.",
    },
    {
      name: "Slider.Track",
      part: "track",
      element: "div",
      description: "The full-range bar.",
    },
    {
      name: "Slider.Indicator",
      part: "indicator",
      element: "div",
      description: "The filled span (from the start, or between the outer thumbs of a range).",
    },
    {
      name: "Slider.Thumb",
      part: "thumb",
      element: "div",
      description: "One draggable handle; contains the thumb's native range input.",
    },
    {
      name: "Slider.MarkerGroup",
      part: "marker-group",
      element: "div",
      description: 'Container for Markers; `aria-hidden="true"`.',
    },
    {
      name: "Slider.Marker",
      part: "marker",
      element: "div",
      description: "A tick at `value`; `data-state` says where it sits relative to the Indicator.",
    },
    {
      name: "Slider.Description",
      part: "description",
      element: "div",
      description: "Help text, referenced by each thumb's `aria-describedby`.",
    },
  ],
  props: {
    value: {
      type: "number | number[]",
      description: "Controlled value; its shape sets the thumb count.",
    },
    defaultValue: {
      type: "number | number[]",
      default: "min",
      description:
        "Uncontrolled initial value, read at creation; a form reset restores its current value.",
    },
    onValueChange: {
      type: "(value, details) => void",
      description:
        "Every change, while dragging too. `details.cancel()` refuses it; `details.reason` and `details.index` say why and which thumb.",
    },
    onValueCommit: {
      type: "(value, { reason }) => void",
      description:
        "Once per key step, pointer release or AT adjustment. Never for a cancel, a refusal, a programmatic change or a reset.",
    },
    min: { type: "number", default: "0", description: "Lower bound." },
    max: { type: "number", default: "100", description: "Upper bound." },
    step: { type: "number", default: "1", description: "Granularity of every change." },
    largeStep: {
      type: "number",
      default: "(max - min) / 10",
      description: "Shift + arrow and PageUp / PageDown.",
    },
    minStepsBetweenThumbs: {
      type: "number",
      default: "0",
      description: "Minimum gap between neighbouring thumbs, in steps.",
    },
    thumbCollision: {
      type: '"stop" | "push" | "swap"',
      default: '"stop"',
      description: "What a thumb does when it meets its neighbour.",
    },
    thumbAlignment: {
      type: '"center" | "contain"',
      default: '"center"',
      description:
        "`contain` keeps thumbs inside the track; set `--rind-slider-thumb-size` to the thumb size.",
    },
    orientation: {
      type: '"horizontal" | "vertical"',
      default: '"horizontal"',
      description: "The axis.",
    },
    disabled: {
      type: "boolean",
      default: "false",
      description: "Ignores all input; thumbs leave the tab order.",
    },
    readOnly: {
      type: "boolean",
      default: "false",
      description: "Keeps focus and value, ignores changes.",
    },
    required: {
      type: "boolean",
      default: "false",
      description: "Sets `data-required` only (a range input always has a value).",
    },
    invalid: {
      type: "boolean",
      default: "false",
      description: "Sets `aria-invalid` and `data-invalid`.",
    },
    name: { type: "string", description: "The submitted field name of every thumb." },
    form: { type: "string", description: "The id of the form the inputs belong to." },
    formatOptions: {
      type: "Intl.NumberFormatOptions",
      description: "Formats `aria-valuetext` and ValueText.",
    },
    locale: { type: "string", description: "Locale for formatting (default: the provider's)." },
    dir: { type: '"ltr" | "rtl"', description: "Reading direction; mirrors a horizontal Slider." },
    messages: {
      type: "Partial<SliderMessages>",
      description: "Thumb names (`thumbLabel`) and value text (`valueText`).",
    },
    "Thumb index": { type: "number", description: "`Slider.Thumb` prop: the thumb's value index." },
    "Thumb disabled": {
      type: "boolean",
      description: "`Slider.Thumb` prop: disables this thumb only.",
    },
    "Thumb name": {
      type: "string",
      description: "`Slider.Thumb` prop: submitted name for this thumb.",
    },
    "Thumb aria-label": {
      type: "string",
      description: "`Slider.Thumb` prop: the thumb's own name.",
    },
    "Thumb aria-labelledby": {
      type: "string",
      description: "`Slider.Thumb` prop: ids naming the thumb.",
    },
  },
  dataAttributes: {
    root: shared("root"),
    label: shared("label"),
    "value-text": shared("value-text"),
    control: shared("control"),
    track: shared("track"),
    indicator: shared("indicator"),
    thumb: {
      ...shared("thumb"),
      "data-index": "The thumb's index.",
      "data-active": "The thumb used last.",
    },
    "hidden-input": {
      "data-scope": '"slider"',
      "data-part": '"hidden-input"',
      "data-instance": "The instance id.",
      "data-index": "The thumb's index.",
      ...focus,
    },
    "marker-group": shared("marker-group"),
    marker: {
      ...shared("marker"),
      "data-value": "The marker's value.",
      "data-state": '"under-value", "at-value" or "over-value".',
    },
    description: shared("description"),
  },
  keyboard: [
    [
      "ArrowRight / ArrowLeft",
      "Increase / decrease by `step`; mirrored in right-to-left (horizontal only).",
    ],
    ["ArrowUp / ArrowDown", "Increase / decrease by `step`; ArrowUp always increases."],
    ["Shift + arrow", "Moves by `largeStep`."],
    ["PageUp / PageDown", "Moves by `largeStep`."],
    ["Home / End", "Moves the thumb to its lower / upper bound."],
    ["Escape", "Cancels a drag in progress (restores the start values); nothing otherwise."],
    ["Enter", "Does nothing here: inside a form it submits it."],
  ],
  states: {
    idle: "No drag in progress.",
    dragging: "A thumb is being dragged by the pointer.",
  },
  contract: {
    actions: {
      focusThumb: ["keyboard"],
      step: ["keyboard"],
      toEdge: ["keyboard"],
      setValue: ["pointer", "keyboard", "touch", "virtual"],
      pressTrack: ["pointer", "keyboard", "touch", "virtual"],
      pointerDown: ["pointer", "touch", "virtual"],
      pointerMove: ["pointer", "touch", "virtual"],
      pointerUp: ["pointer", "touch", "virtual"],
      cancelDrag: ["pointer", "keyboard", "touch", "virtual"],
      adjustNative: ["keyboard"],
      resetForm: ["pointer", "keyboard", "virtual"],
    },
    queries: [
      "values",
      "valueText",
      "bounds",
      "focusedThumb",
      "isDragging",
      "orientation",
      "formValues",
    ],
    traits: ["valued", "directional", "form-associated", "field-associated"],
  },
} as const satisfies ComponentMeta
