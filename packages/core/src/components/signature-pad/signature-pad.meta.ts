// Signature Pad's API facts for the generated docs (scripts/docs-gen.ts). Data only; checked
// against the code in signature-pad.meta.test.ts.

import type { ComponentMeta } from "../meta"

const base = (part: string) => ({
  "data-scope": '"signature-pad"',
  "data-part": `"${part}"`,
  "data-instance": "The instance id.",
  "data-state": '"idle" or "drawing".',
  "data-empty": "Nothing drawn.",
  "data-disabled": "While disabled.",
  "data-readonly": "While read-only.",
  "data-required": "While required.",
  "data-invalid": "While invalid.",
})
const focus = { "data-focus": "Focused.", "data-focus-visible": "Keyboard focus." }

export const signaturePadMeta = {
  scope: "signature-pad",
  name: "Signature Pad",
  stateless: false,
  parts: [
    {
      name: "SignaturePad.Root",
      part: "root",
      element: "div",
      description: "Holds the strokes; renders the hidden form input.",
    },
    {
      name: "SignaturePad.Label",
      part: "label",
      element: "span",
      description: 'Names the Control and completes the triggers\' names ("Clear Signature").',
    },
    {
      name: "SignaturePad.Control",
      part: "control",
      element: "div",
      description:
        'The drawing surface: `role="img"`, named by the Label, described by the Status; not a Tab stop (nothing to do there by keyboard).',
    },
    {
      name: "SignaturePad.Segment",
      part: "segment",
      element: "svg",
      description:
        '`aria-hidden`; renders a `<path data-part="stroke">` per stroke in `currentColor`.',
    },
    {
      name: "SignaturePad.Guide",
      part: "guide",
      element: "div",
      description: "`aria-hidden`; the line to sign on.",
    },
    {
      name: "SignaturePad.Status",
      part: "status",
      element: "span",
      description: 'Visually hidden: "Not signed" or "Signed".',
    },
    {
      name: "SignaturePad.ClearTrigger",
      part: "clear-trigger",
      element: "button",
      description:
        "Removes every stroke. Disabled but focusable when there is nothing to clear; announces the result.",
    },
    {
      name: "SignaturePad.UndoTrigger",
      part: "undo-trigger",
      element: "button",
      description:
        "Removes the last stroke. Disabled but focusable when empty; announces the result.",
    },
  ],
  props: {
    value: {
      type: "SignatureValue",
      description: "The strokes, controlled: `{ width, height, strokes }`.",
    },
    defaultValue: { type: "SignatureValue", description: "The strokes, uncontrolled." },
    onValueChange: {
      type: "(value: SignatureValue) => void",
      description: "When a stroke ends, on clear, undo and form reset; never while drawing.",
    },
    name: { type: "string", description: "The form field's name." },
    formValue: {
      type: '"svg" | "json"',
      default: '"svg"',
      description: "What the form submits: an SVG data URL, or the strokes as JSON.",
    },
    inkColor: {
      type: "string",
      default: '"#000"',
      description: "The ink colour inlined in the submitted SVG.",
    },
    required: { type: "boolean", default: "false", description: "An empty pad blocks submit." },
    disabled: { type: "boolean", default: "false", description: "No drawing, not submitted." },
    readOnly: {
      type: "boolean",
      default: "false",
      description: "Shows and submits the strokes; no drawing, clear or undo.",
    },
    minDistance: {
      type: "number",
      default: "1",
      description: "Points closer than this to the previous one are dropped (px).",
    },
    messages: {
      type: "Partial<SignaturePadMessages>",
      description: "Overrides the strings (also through the provider).",
    },
    locale: {
      type: "string",
      description: "Default: the provider's locale (the announcements' language).",
    },
    render: {
      type: "RenderProp",
      description: "Substitutes the rendered element without changing behaviour.",
    },
  },
  dataAttributes: {
    root: base("root"),
    label: base("label"),
    control: base("control"),
    segment: base("segment"),
    guide: base("guide"),
    status: base("status"),
    stroke: base("stroke"),
    "clear-trigger": { ...base("clear-trigger"), ...focus },
    "undo-trigger": { ...base("undo-trigger"), ...focus },
  },
  keyboard: [["Enter, Space", "On Clear or Undo: runs it."]],
  states: {
    idle: "No stroke in progress.",
    drawing: "A pointer is drawing a stroke; it joins the value when it ends.",
  },
  contract: {
    actions: {
      draw: ["pointer", "touch"],
      tap: ["pointer", "touch"],
      drawWithTwoPointers: ["touch"],
      cancelStroke: ["pointer", "touch"],
      clear: ["pointer", "keyboard", "touch", "virtual"],
      undo: ["pointer", "keyboard", "touch", "virtual"],
    },
    queries: [
      "isEmpty",
      "strokeCount",
      "formValue",
      "name",
      "statusText",
      "clearDisabled",
      "undoDisabled",
    ],
    traits: [],
  },
} as const satisfies ComponentMeta
