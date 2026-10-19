// The Rating's API facts for the generated docs (scripts/docs-gen.ts). Data only;
// checked against the code in rating.meta.test.ts.

import type { ComponentMeta } from "../meta"

const state = {
  "data-disabled": "While disabled.",
  "data-readonly": "While read-only.",
  "data-required": "While required.",
  "data-invalid": "While invalid.",
  "data-previewing": "While a pointer hovers the stars (the stars show the preview).",
}
const focus = { "data-focus": "Focused.", "data-focus-visible": "Keyboard focus." }
const base = (part: string) => ({
  "data-scope": '"rating"',
  "data-part": `"${part}"`,
  "data-instance": "The instance id.",
})
const shared = (part: string) => ({ ...base(part), ...state })

export const ratingMeta = {
  scope: "rating",
  name: "Rating",
  stateless: false,
  parts: [
    {
      name: "Rating.Root",
      part: "root",
      element: "div",
      description: "Owns the value; `data-value` carries it for styling.",
    },
    {
      name: "Rating.Label",
      part: "label",
      element: "label",
      description: "The visible name; pressing it focuses the Rating.",
    },
    {
      name: "Rating.Control",
      part: "control",
      element: "div",
      description:
        "The row of stars and the pointer surface; renders the range input and the form input after its children.",
    },
    {
      name: "Rating.Item",
      part: "item",
      element: "span",
      description:
        'One star (`index` 1 to `count`); `data-state` full, half or empty; `aria-hidden="true"`.',
    },
  ],
  props: {
    value: { type: "number", description: "Controlled value: 0 (no rating) to `count`." },
    defaultValue: {
      type: "number",
      default: "0",
      description:
        "Uncontrolled initial value, read at creation; a form reset restores its current value.",
    },
    onValueChange: {
      type: "(value, details) => void",
      description: "Every change. `details.cancel()` refuses it; `details.reason` says why.",
    },
    count: { type: "number", default: "5", description: "The number of stars." },
    allowHalf: {
      type: "boolean",
      default: "false",
      description: "Half stars: a star's first half and the arrow keys move by 0.5.",
    },
    allowClear: {
      type: "boolean",
      default: "false",
      description: "Pressing the current value, or Home and the arrows below one star, give 0.",
    },
    disabled: {
      type: "boolean",
      default: "false",
      description: "Ignores all input; the Rating leaves the tab order.",
    },
    readOnly: {
      type: "boolean",
      default: "false",
      description: "Keeps focus and value, ignores changes; no hover preview.",
    },
    required: {
      type: "boolean",
      default: "false",
      description: "The form is invalid while unrated (the browser's own message).",
    },
    invalid: {
      type: "boolean",
      default: "false",
      description: "Sets `aria-invalid` and `data-invalid`.",
    },
    name: {
      type: "string",
      description: 'The submitted field name; the value is "" while unrated.',
    },
    form: { type: "string", description: "The id of the form the inputs belong to." },
    locale: { type: "string", description: "Locale for the value text (default: the provider's)." },
    dir: { type: '"ltr" | "rtl"', description: "Reading direction; mirrors the stars and arrows." },
    messages: {
      type: "Partial<RatingMessages>",
      description: 'The value text (`valueText`): "3 of 5 stars", "No rating".',
    },
    "Item.index": { type: "number", description: "The star's position, 1 to `count`." },
  },
  dataAttributes: {
    root: { ...shared("root"), "data-value": "The value (0 while unrated)." },
    label: shared("label"),
    control: { ...shared("control"), ...focus },
    item: {
      ...shared("item"),
      "data-index": "The star's position, 1 to `count`.",
      "data-state": '"full", "half" or "empty", from the value or the hover preview.',
      "data-previewed": "Inside the hover preview.",
    },
    input: { ...base("input"), ...focus },
    "hidden-input": base("hidden-input"),
  },
  keyboard: [
    [
      "ArrowRight / ArrowUp",
      "Increases by one step (half a star with `allowHalf`); mirrored in RTL.",
    ],
    ["ArrowLeft / ArrowDown", "Decreases by one step; below one star only when `allowClear`."],
    ["PageUp / PageDown", "Moves by a whole star."],
    ["Home", "The lowest value: 0 when `allowClear`, else one step."],
    ["End", "`count` stars."],
    ["Enter", "Does nothing here: inside a form it submits it."],
  ],
  states: {
    idle: "No pointer over the stars.",
    previewing: "A pointer hovers the stars; they show the value it points at.",
  },
  contract: {
    actions: {
      focus: ["keyboard"],
      rate: ["pointer", "keyboard", "touch", "virtual"],
      pressStar: ["pointer", "touch", "virtual"],
      step: ["keyboard"],
      toEdge: ["keyboard"],
      hover: ["pointer", "virtual"],
      leave: ["pointer", "virtual"],
      adjustNative: ["touch"],
      resetForm: ["pointer", "keyboard", "virtual"],
    },
    queries: [
      "value",
      "valueText",
      "stars",
      "isPreviewing",
      "isDisabled",
      "isReadOnly",
      "formValue",
    ],
    traits: ["valued", "directional", "form-associated", "field-associated"],
  },
} as const satisfies ComponentMeta
