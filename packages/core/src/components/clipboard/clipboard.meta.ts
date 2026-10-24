// Clipboard's API facts for the generated docs (scripts/docs-gen.ts). Data only; checked
// against the code in clipboard.meta.test.ts.

import type { ComponentMeta } from "../meta"

const base = (part: string) => ({
  "data-scope": '"clipboard"',
  "data-part": `"${part}"`,
  "data-instance": "The instance id.",
  "data-state": '"idle", "copying", "copied" or "error".',
  "data-disabled": "While disabled.",
})
const focus = { "data-focus": "Focused.", "data-focus-visible": "Keyboard focus." }

export const clipboardMeta = {
  scope: "clipboard",
  name: "Clipboard",
  stateless: false,
  parts: [
    {
      name: "Clipboard.Root",
      part: "root",
      element: "div",
      description: "Holds the value and the copy state.",
    },
    {
      name: "Clipboard.Label",
      part: "label",
      element: "label",
      description: 'Names the Input and completes the Trigger\'s name ("Copy API key").',
    },
    {
      name: "Clipboard.Control",
      part: "control",
      element: "div",
      description: "Groups the Input and the Trigger (the themed field surface).",
    },
    {
      name: "Clipboard.Input",
      part: "input",
      element: "input",
      description:
        "Read-only, shows the value. Keyboard focus and the press that focuses it select the whole value; a copy of the whole value counts as copied.",
    },
    {
      name: "Clipboard.Trigger",
      part: "trigger",
      element: "button",
      description:
        'Writes `value` through the clipboard on click. Named "Copy" (then the Label); the name never changes, the result is announced.',
    },
    {
      name: "Clipboard.Indicator",
      part: "indicator",
      element: "span",
      description:
        "`aria-hidden`. Renders `children`, its `copied` prop while copied and its `failed` prop on error; else the provider's `copy` / `check` / `x` icon.",
    },
    {
      name: "Clipboard.ValueText",
      part: "value-text",
      element: "span",
      description: "Renders `children`, else the value.",
    },
  ],
  props: {
    value: {
      type: "string",
      description: "Required. What a press copies, read when the write starts.",
    },
    copyFeedbackDuration: {
      type: "number",
      default: "2000",
      description: "How long `copied` / `error` last before `idle` (ms).",
    },
    disabled: {
      type: "boolean",
      default: "false",
      description: "The Trigger and the Input are disabled; presses do not copy.",
    },
    onCopy: {
      type: '({ ok, error?, source: "trigger" | "input" }) => void',
      description: "Once per result, after the write settled (or the Input's own copy).",
    },
    messages: {
      type: "Partial<ClipboardMessages>",
      description:
        "Overrides the strings (also through the provider). With text in the Trigger, set `copy` to that text (label in name).",
    },
    locale: {
      type: "string",
      description: "Default: the provider's locale (the announcement's language).",
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
    input: { ...base("input"), ...focus },
    trigger: { ...base("trigger"), ...focus },
    indicator: base("indicator"),
    "value-text": base("value-text"),
  },
  keyboard: [
    ["Enter, Space", "On the Trigger: copies the value."],
    ["Tab", "To the Input: selects the whole value; the platform copy shortcut copies it."],
  ],
  states: {
    idle: "No copy in progress.",
    copying: "The clipboard write has not settled.",
    copied:
      'The write succeeded (or the whole Input was copied); "Copied" was announced. Back to idle after `copyFeedbackDuration`.',
    error:
      'The write failed; "Copy failed" was announced. Back to idle after `copyFeedbackDuration`.',
  },
  contract: {
    actions: {
      copy: ["pointer", "keyboard", "touch", "virtual"],
      settleCopy: ["pointer", "keyboard", "touch", "virtual"],
      copyFromInput: ["pointer", "keyboard", "virtual"],
      copyPartOfInput: ["pointer", "keyboard", "virtual"],
    },
    queries: ["copyState", "value", "inputValue", "triggerName", "isDisabled"],
    traits: [],
  },
} as const satisfies ComponentMeta
