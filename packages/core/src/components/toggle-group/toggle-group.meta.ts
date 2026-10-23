// The Toggle Group's API facts for the generated docs (scripts/docs-gen.ts). Data only;
// checked against the code in toggle-group.meta.test.ts.

import type { ComponentMeta } from "../meta"

const base = (part: string) => ({
  "data-scope": '"toggle-group"',
  "data-part": `"${part}"`,
  "data-instance": "The instance id.",
})

export const toggleGroupMeta = {
  scope: "toggle-group",
  name: "Toggle Group",
  stateless: false,
  parts: [
    {
      name: "ToggleGroup.Root",
      part: "root",
      element: "div",
      description:
        'Owns the value and the arrow keys; `role="group"`, named by `aria-label` or `aria-labelledby`.',
    },
    {
      name: "ToggleGroup.Item",
      part: "item",
      element: "button",
      description:
        "One toggle button (`aria-pressed` always explicit, roving tab stop); never a radio.",
    },
  ],
  props: {
    value: { type: "string[]", description: "Controlled pressed values; `[]` is none." },
    defaultValue: {
      type: "string[]",
      default: "[]",
      description: "Uncontrolled initial value.",
    },
    onValueChange: {
      type: "(value, { reason, cancel }) => void",
      description: "Every user-caused change, once; `reason` is PRESS; `cancel()` vetoes it.",
    },
    selectionMode: {
      type: '"single" | "multiple"',
      default: '"single"',
      description: "Single: pressing replaces the selection. Both modes can deselect.",
    },
    disallowEmptySelection: {
      type: "boolean",
      default: "false",
      description: "The only pressed item cannot be released.",
    },
    orientation: {
      type: '"horizontal" | "vertical"',
      default: '"horizontal"',
      description: "Which arrows move focus (vertical: both pairs); `data-orientation` only.",
    },
    loop: { type: "boolean", default: "true", description: "Arrow moves wrap at both ends." },
    disabled: { type: "boolean", default: "false", description: "Disables every item." },
    focusableWhenDisabled: {
      type: "boolean",
      default: "false",
      description: "Disabled items stay focusable (`aria-disabled`).",
    },
    "*.render": {
      type: "RenderProp",
      description: "Substitutes the rendered element without changing behaviour.",
    },
  },
  dataAttributes: {
    root: {
      ...base("root"),
      "data-orientation": '"horizontal" or "vertical".',
      "data-selection-mode": '"single" or "multiple".',
      "data-focus": "While an item has focus.",
      "data-disabled": "While the group is disabled.",
    },
    item: {
      ...base("item"),
      "data-key": "The item's value.",
      "data-orientation": '"horizontal" or "vertical".',
      "data-state": '"on" or "off", in every state.',
      "data-highlighted": "While it is the roving focus target.",
      "data-disabled": "While the item (or the group) is disabled.",
      "data-focus": "While focused.",
      "data-focus-visible": "While focused by keyboard or script.",
      "data-pressed": "While a press is in progress (not while on).",
      "data-hover": "While hovered.",
    },
  },
  keyboard: [
    [
      "ArrowRight / ArrowLeft",
      "Moves focus to the next / previous enabled item (mirrored in RTL).",
    ],
    ["ArrowDown / ArrowUp", "Vertical groups only: next / previous. Never changes the value."],
    ["Home / End", "Moves focus to the first / last enabled item."],
    ["Space / Enter", "Presses the focused item."],
  ],
  states: {
    idle: "Focus is outside the group.",
    focused: "Focus is on an item.",
  },
  contract: {
    actions: {
      toggle: ["pointer", "touch", "keyboard", "virtual"],
      press: ["pointer", "touch", "keyboard", "virtual"],
      focusItem: ["keyboard"],
      arrowNext: ["keyboard"],
      leave: ["keyboard"],
    },
    queries: ["items", "pressed", "focusedItem", "isDisabled"],
    traits: ["composite-roving", "directional"],
  },
} as const satisfies ComponentMeta
