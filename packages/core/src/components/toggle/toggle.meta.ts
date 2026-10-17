// The Toggle's API facts for the generated docs (scripts/docs-gen.ts). Data only;
// checked against the code in toggle.meta.test.ts.

import type { ComponentMeta } from "../meta"

const base = (part: string) => ({
  "data-scope": '"toggle"',
  "data-part": `"${part}"`,
  "data-instance": "The instance id.",
  "data-state": '"on" or "off", in every state.',
  "data-disabled": "While disabled.",
})

export const toggleMeta = {
  scope: "toggle",
  name: "ToggleGroup.Item",
  stateless: false,
  parts: [
    {
      name: "ToggleGroup.Item",
      part: "root",
      element: "button",
      description:
        'The two-state button (`type="button"`, `aria-pressed` always explicit); a substituted non-button gets `role="button"` and `tabIndex=0`.',
    },
    {
      name: "ToggleGroup.ItemIndicator",
      part: "indicator",
      element: "span",
      description:
        'Decorative (`aria-hidden="true"`); renders its children while on and `fallback` while off.',
    },
  ],
  props: {
    pressed: { type: "boolean", description: "Controlled pressed state." },
    defaultPressed: {
      type: "boolean",
      default: "false",
      description: "Uncontrolled initial state.",
    },
    onPressedChange: {
      type: "(pressed, { reason, event, cancel }) => void",
      description:
        "Every activation proposes the opposite value (`reason` is `PRESS`); `cancel()` vetoes it.",
    },
    disabled: { type: "boolean", default: "false", description: "Ignores every activation." },
    focusableWhenDisabled: {
      type: "boolean",
      default: "false",
      description: "Disabled but focusable: `aria-disabled` instead of native `disabled`.",
    },
    render: {
      type: "element | (props, state) => element",
      description: "Substitutes the rendered element without changing behaviour.",
    },
    fallback: {
      type: "ReactNode",
      description: "ToggleGroup.ItemIndicator only: rendered while the toggle is off.",
    },
  },
  dataAttributes: {
    root: {
      ...base("root"),
      "data-focus": "Focused.",
      "data-focus-visible": "Keyboard focus.",
      "data-pressed": "While a press is in progress (never the on state).",
      "data-hover": "While hovered.",
    },
    indicator: base("indicator"),
  },
  keyboard: [["Enter, Space", "Toggles. Key repeats are ignored."]],
  states: {
    off: 'Not pressed; `aria-pressed="false"`.',
    on: 'Pressed; `aria-pressed="true"`.',
  },
  contract: {
    actions: {
      setPressed: ["pointer", "keyboard", "touch", "virtual"],
      activateWithEnter: ["keyboard"],
    },
    queries: ["isPressed", "isDisabled"],
    traits: [],
  },
} as const satisfies ComponentMeta
