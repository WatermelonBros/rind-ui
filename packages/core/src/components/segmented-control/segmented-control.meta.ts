// The Segmented Control's API facts for the generated docs (scripts/docs-gen.ts). Data only;
// checked against the code in segmented-control.meta.test.ts.

import type { ComponentMeta } from "../meta"

const group = {
  "data-disabled": "While the control is disabled.",
  "data-readonly": "While the control is read-only.",
  "data-invalid": "While the control is invalid.",
}
const base = (part: string) => ({
  "data-scope": '"segmented-control"',
  "data-part": `"${part}"`,
  "data-instance": "The instance id.",
})

export const segmentedControlMeta = {
  scope: "segmented-control",
  name: "Segmented Control",
  stateless: false,
  parts: [
    {
      name: "SegmentedControl.Root",
      part: "root",
      element: "div",
      description: 'Owns the value and the arrow keys; `role="radiogroup"`.',
    },
    {
      name: "SegmentedControl.Label",
      part: "label",
      element: "span",
      description:
        "Names the control (`aria-labelledby`); a child of the root, not a `label` (a radiogroup is not labelable).",
    },
    {
      name: "SegmentedControl.Item",
      part: "item",
      element: "button",
      description:
        'One segment: `role="radio"`, roving tab stop, named by its content or `aria-label`; renders its hidden input as a sibling.',
    },
    {
      name: "SegmentedControl.Indicator",
      part: "indicator",
      element: "span",
      description:
        "Optional, `aria-hidden`: the selected segment's measured box as `--rind-indicator-*` custom properties.",
    },
  ],
  props: {
    value: { type: "string | null", description: "Controlled value (the selected segment)." },
    defaultValue: {
      type: "string | null",
      default: "null",
      description: "Uncontrolled initial value; a form reset restores it.",
    },
    onValueChange: {
      type: "(value, { reason, cancel }) => void",
      description: "Every user-caused change, once; `reason` is NAVIGATE, PRESS or RESET.",
    },
    orientation: {
      type: '"horizontal" | "vertical"',
      default: '"horizontal"',
      description:
        "Only `aria-orientation`, `data-orientation` and the indicator; every arrow moves.",
    },
    disabled: { type: "boolean", default: "false", description: "Disables every segment." },
    focusableWhenDisabled: {
      type: "boolean",
      default: "false",
      description: "A disabled control stays one Tab stop (the root).",
    },
    readOnly: { type: "boolean", default: "false", description: "Navigable, never changes." },
    required: {
      type: "boolean",
      default: "false",
      description: "Valid with one segment selected.",
    },
    invalid: { type: "boolean", default: "false", description: "Marks the control invalid." },
    name: { type: "string", description: "The submitted name (default: derived from the id)." },
    form: { type: "string", description: "The id of the form the hidden inputs belong to." },
    "*.render": {
      type: "element | (props, state) => element",
      description: "Substitutes the rendered element without changing behaviour.",
    },
  },
  dataAttributes: {
    root: {
      ...base("root"),
      ...group,
      "data-orientation": '"horizontal" or "vertical".',
      "data-required": "While required.",
    },
    label: { ...base("label"), ...group },
    item: {
      ...base("item"),
      ...group,
      "data-orientation": '"horizontal" or "vertical".',
      "data-key": "The segment's value.",
      "data-state": '"checked" or "unchecked".',
      "data-highlighted": "While it is the roving focus target.",
      "data-focus": "While focused.",
      "data-focus-visible": "While focused by keyboard or script.",
      "data-pressed": "While pressed.",
      "data-hover": "While hovered.",
    },
    indicator: {
      ...base("indicator"),
      "data-orientation": '"horizontal" or "vertical".',
      "data-state": '"visible" or "hidden".',
      "data-resizing": "While the box changed by layout, not selection: do not animate.",
    },
  },
  keyboard: [
    [
      "ArrowRight / ArrowDown",
      "Moves to the next enabled segment and selects it (wraps; mirrored in RTL).",
    ],
    ["ArrowLeft / ArrowUp", "Moves to the previous enabled segment and selects it (wraps)."],
    ["Space", "Selects the focused segment."],
    ["Enter", "Submits the form; never selects."],
  ],
  states: {
    idle: "Focus is outside the control.",
    focused: "Focus is on a segment.",
  },
  contract: {
    actions: {
      select: ["pointer", "touch", "keyboard", "virtual"],
      press: ["pointer", "touch", "keyboard", "virtual"],
      focusSegment: ["keyboard"],
      arrowNext: ["keyboard"],
      leave: ["keyboard"],
    },
    queries: ["segments", "selected", "focusedSegment", "isDisabled", "formValue"],
    traits: ["composite-roving", "selectable", "directional", "form-associated"],
  },
} as const satisfies ComponentMeta
