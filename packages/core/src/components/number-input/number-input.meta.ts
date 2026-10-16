// The Number Input's API facts for the generated docs (scripts/docs-gen.ts). Data only;
// checked against the code in number-input.meta.test.ts.

import type { ComponentMeta } from "../meta"

const fieldState = {
  "data-disabled": "While disabled.",
  "data-readonly": "While read-only.",
  "data-required": "While required.",
  "data-valid": "A valid result is displayed (Field).",
  "data-invalid": "An error is displayed (Field).",
  "data-validating": "An async check is running (Field).",
  "data-touched": "Focus has left it once (Field).",
  "data-dirty": "The value differs from the first one (Field).",
  "data-filled": "The value is not empty (Field).",
}
const focus = { "data-focus": "Focused.", "data-focus-visible": "Keyboard focus." }
const live = {
  ...focus,
  "data-spinning": "While a held stepper repeats.",
  "data-composing": "While an IME composition is open.",
}
const base = (part: string) => ({
  "data-scope": '"number-input"',
  "data-part": `"${part}"`,
  "data-instance": "The instance id.",
})

export const numberInputMeta = {
  scope: "number-input",
  name: "Number Input",
  stateless: false,
  parts: [
    {
      name: "NumberInput.Root",
      part: "root",
      element: "div",
      description:
        'A Field when not inside one; else it joins the enclosing Field. Renders the hidden `<input type="number">`.',
    },
    {
      name: "NumberInput.Label",
      part: "label",
      element: "label",
      description: "The Field's Label.",
    },
    {
      name: "NumberInput.Description",
      part: "description",
      element: "p",
      description: "The Field's Description.",
    },
    {
      name: "NumberInput.ErrorMessage",
      part: "error-message",
      element: "p",
      description: "The Field's ErrorMessage.",
    },
    {
      name: "NumberInput.Control",
      part: "control",
      element: "div",
      description: "Groups the input and the steppers.",
    },
    {
      name: "NumberInput.Input",
      part: "input",
      element: "input",
      description: 'The text field: `role="spinbutton"` with the value, bounds and value text.',
    },
    {
      name: "NumberInput.IncrementTrigger",
      part: "increment-trigger",
      element: "button",
      description: 'Named "Increase" plus the Label; not in the Tab order; never takes focus.',
    },
    {
      name: "NumberInput.DecrementTrigger",
      part: "decrement-trigger",
      element: "button",
      description: 'Named "Decrease" plus the Label; not in the Tab order; never takes focus.',
    },
  ],
  props: {
    value: { type: "number | null", description: "Controlled value (`null` is empty)." },
    defaultValue: {
      type: "number | null",
      default: "null",
      description:
        "Uncontrolled initial value, read at creation; a form reset restores its current value.",
    },
    onValueChange: {
      type: "(value, details) => void",
      description:
        "Every applied change (commit, step, edge, wheel, paste, spin, reset). `details.cancel()` refuses it; `details.reason` says why.",
    },
    onValueCommit: {
      type: "(value, { reason }) => void",
      description: "Once per interaction that changed the value.",
    },
    onInputValueChange: {
      type: "(text: string) => void",
      description: "Every accepted edit of the text; the value changes only at commit points.",
    },
    min: { type: "number", description: "Lower bound." },
    max: { type: "number", description: "Upper bound." },
    step: {
      type: "number",
      default: "1 (0.01 for percent)",
      description: "Keys, steppers and wheel move by it; a commit snaps to an explicit one only.",
    },
    largeStep: {
      type: "number",
      default: "10 × step",
      description: "Shift + arrow and PageUp / PageDown.",
    },
    formatOptions: {
      type: "Intl.NumberFormatOptions",
      description: "Formats and parses the text (decimal, percent, currency, unit).",
    },
    locale: { type: "string", description: "Locale for formatting (default: the provider's)." },
    dir: { type: '"ltr" | "rtl"', description: "Reading direction." },
    commitBehavior: {
      type: '"snap" | "validate"',
      default: '"snap"',
      description: "`snap` clamps and snaps at commit; `validate` keeps the number for validity.",
    },
    allowWheel: {
      type: "boolean",
      default: "false",
      description: "The wheel steps the focused input.",
    },
    spinOnPress: {
      type: "boolean",
      default: "true",
      description: "Holding a stepper repeats.",
    },
    spinDelay: { type: "number", default: "400", description: "Ms before the first repeat." },
    spinInterval: { type: "number", default: "60", description: "Ms between repeats." },
    disabled: { type: "boolean", default: "false", description: "Ignores all input." },
    readOnly: { type: "boolean", default: "false", description: "Keeps focus, ignores changes." },
    required: { type: "boolean", default: "false", description: "Required to be filled." },
    invalid: { type: "boolean", default: "false", description: "Sets `aria-invalid`." },
    name: { type: "string", description: "The submitted field name (the hidden input)." },
    form: { type: "string", description: "The id of the form the hidden input belongs to." },
    messages: {
      type: "Partial<NumberInputMessages>",
      description: "`increment`, `decrement`, `empty`, `valueText` and `committed`.",
    },
    fieldMessages: {
      type: "Field messages",
      description: "The Field's messages when the Root is the Field.",
    },
  },
  dataAttributes: {
    root: { ...base("root"), ...fieldState, ...live },
    label: { ...base("label"), ...fieldState },
    description: { ...base("description"), ...fieldState },
    "error-message": { ...base("error-message"), ...fieldState },
    control: { ...base("control"), ...fieldState, ...live },
    input: { ...base("input"), ...fieldState, ...live },
    "increment-trigger": {
      ...base("increment-trigger"),
      ...fieldState,
      "data-pressed": "While pressed.",
    },
    "decrement-trigger": {
      ...base("decrement-trigger"),
      ...fieldState,
      "data-pressed": "While pressed.",
    },
    "hidden-input": base("hidden-input"),
  },
  keyboard: [
    ["ArrowUp / ArrowDown", "Increase / decrease by `step`."],
    ["Shift + ArrowUp / ArrowDown", "Moves by `largeStep`."],
    ["PageUp / PageDown", "Moves by `largeStep`."],
    ["Home / End", "Jump to `min` / `max`; only when that bound is set."],
    ["Enter", "Commits the text, then the form submits."],
    ["Alt / Ctrl / Meta + key", "Ignored (browser and OS shortcuts)."],
  ],
  states: {
    idle: "Typing, or nothing in progress.",
    composing: "An IME composition is open.",
    pressing: "A stepper is down, before the first repeat.",
    spinning: "A held stepper repeats.",
  },
  contract: {
    actions: {
      type: ["keyboard"],
      fill: ["keyboard"],
      commit: ["keyboard"],
      step: ["pointer", "keyboard", "touch", "virtual"],
      pageStep: ["keyboard"],
      toEdge: ["keyboard"],
      pressStepper: ["pointer", "virtual"],
      releaseStepper: ["pointer", "virtual"],
      cancelStepper: ["pointer", "virtual"],
      holdStepper: ["pointer", "keyboard", "touch", "virtual"],
      wheel: ["keyboard"],
      paste: ["keyboard"],
      composeOpen: ["keyboard"],
      composeEnd: ["keyboard"],
      resetForm: ["pointer", "keyboard", "virtual"],
    },
    queries: [
      "value",
      "text",
      "valueText",
      "formValue",
      "canIncrement",
      "canDecrement",
      "isInvalid",
      "isDisabled",
      "isReadOnly",
      "isSpinning",
      "isComposing",
    ],
    traits: ["valued", "form-associated", "field-associated"],
  },
} as const satisfies ComponentMeta
