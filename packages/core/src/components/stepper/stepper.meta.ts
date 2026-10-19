// Stepper's API facts for the generated docs (scripts/docs-gen.ts). Data only; checked against
// the code in stepper.connect.test.ts.

import type { ComponentMeta } from "../meta"

const base = (part: string) => ({
  "data-scope": '"stepper"',
  "data-part": `"${part}"`,
  "data-instance": "The instance id.",
  "data-orientation": '"horizontal" or "vertical".',
})
const ring = { "data-focus": "Focused.", "data-focus-visible": "Keyboard focus." }
const step = (part: string) => ({
  ...base(part),
  "data-index": "The step's index (0-based).",
  "data-status": '"completed", "current" or "upcoming".',
  "data-disabled": "While the step is disabled.",
})

export const stepperMeta = {
  scope: "stepper",
  name: "Stepper",
  stateless: false,
  parts: [
    {
      name: "Stepper.Root",
      part: "root",
      element: "div",
      description: "A named group holding the current step.",
    },
    {
      name: "Stepper.List",
      part: "list",
      element: "ol",
      description: "The ordered list of steps (never tabs).",
    },
    {
      name: "Stepper.Item",
      part: "item",
      element: "li",
      description:
        '`aria-current="step"` on the current step; takes `index`, `disabled`, `completed`.',
    },
    {
      name: "Stepper.Trigger",
      part: "trigger",
      element: "button",
      description:
        'A button when the step can be reached, else text; named by its title and status ("Shipping (completed)").',
    },
    {
      name: "Stepper.Indicator",
      part: "indicator",
      element: "span",
      description: "`aria-hidden`; the number, or a check when completed (theme).",
    },
    {
      name: "Stepper.Title",
      part: "title",
      element: "span",
      description: "The step's title (in the Trigger's name and the announcement).",
    },
    {
      name: "Stepper.Description",
      part: "description",
      element: "span",
      description: "Describes the Trigger.",
    },
    {
      name: "Stepper.Separator",
      part: "separator",
      element: "div",
      description: "`aria-hidden` connector between steps.",
    },
    {
      name: "Stepper.Content",
      part: "content",
      element: "div",
      description:
        'The step\'s region ("Step 2 of 4: Shipping"), hidden unless current, kept mounted; focused when the user moves.',
    },
    {
      name: "Stepper.PrevTrigger",
      part: "prev-trigger",
      element: "button",
      description: "One step back; disabled on the first.",
    },
    {
      name: "Stepper.NextTrigger",
      part: "next-trigger",
      element: "button",
      description: "One step forward (the only way forward when linear); disabled on the last.",
    },
    { name: "Stepper.Progress", part: "progress", element: "span", description: '"Step 2 of 4".' },
  ],
  props: {
    count: { type: "number", description: "How many steps." },
    step: { type: "number", description: "Controlled current step (0-based)." },
    defaultStep: { type: "number", default: "0", description: "Uncontrolled initial step." },
    onStepChange: {
      type: "(step, details) => void",
      description:
        '`details.reason`: "next", "prev" or "select"; `details.cancel()` refuses it (validation).',
    },
    linear: {
      type: "boolean",
      default: "true",
      description: "Back to any visited step; forward only with NextTrigger.",
    },
    orientation: {
      type: '"horizontal" | "vertical"',
      default: '"horizontal"',
      description: "The layout.",
    },
    messages: {
      type: "Partial<StepperMessages>",
      description: "Overrides the status words and announcements.",
    },
    locale: { type: "string", description: "Default: the provider's locale." },
    render: {
      type: "element | (props, state) => element",
      description: "Substitutes the rendered element without changing behaviour.",
    },
  },
  dataAttributes: {
    root: base("root"),
    list: base("list"),
    item: step("item"),
    trigger: { ...step("trigger"), ...ring },
    indicator: step("indicator"),
    title: step("title"),
    description: step("description"),
    separator: step("separator"),
    content: { ...step("content"), ...ring },
    "prev-trigger": { ...base("prev-trigger"), ...ring },
    "next-trigger": { ...base("next-trigger"), ...ring },
    progress: base("progress"),
  },
  keyboard: [
    ["Tab", "Through the steps you can reach, then the step's content and its buttons."],
    ["Enter, Space", "On a step: go to it. On Previous / Next: move one step."],
  ],
  states: { active: "One state: the current step is a value." },
  contract: {
    actions: {
      next: ["pointer", "keyboard", "virtual"],
      prev: ["pointer", "keyboard", "virtual"],
      select: ["pointer", "keyboard", "virtual"],
    },
    queries: ["step", "count", "status", "reachable", "focusInContent"],
    traits: [],
  },
} as const satisfies ComponentMeta
