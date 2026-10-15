// The Tabs' API facts for the generated docs (scripts/docs-gen.ts). Data only; checked
// against the code in tabs.meta.test.ts.

import type { ComponentMeta } from "../meta"

const base = (part: string) => ({
  "data-scope": '"tabs"',
  "data-part": `"${part}"`,
  "data-instance": "The instance id.",
})

const orientation = { "data-orientation": '"horizontal" or "vertical".' }

export const tabsMeta = {
  scope: "tabs",
  name: "Tabs",
  stateless: false,
  parts: [
    {
      name: "Tabs.Root",
      part: "root",
      element: "div",
      description: "Owns the selected value, the activation mode and the arrow keys' meaning.",
    },
    {
      name: "Tabs.List",
      part: "list",
      element: "div",
      description:
        '`role="tablist"`, named by `aria-label` or `aria-labelledby`; the keyboard handler lives here.',
    },
    {
      name: "Tabs.Tab",
      part: "tab",
      element: "button",
      description:
        '`role="tab"` with an always explicit `aria-selected`, a roving tab stop and `aria-controls` only to a rendered panel.',
    },
    {
      name: "Tabs.Panel",
      part: "panel",
      element: "div",
      description:
        '`role="tabpanel"` labelled by its tab; inactive panels unmount, get `hidden` or `hidden="until-found"`.',
    },
    {
      name: "Tabs.Indicator",
      part: "indicator",
      element: "span",
      description:
        "Optional, `aria-hidden`: the selected tab's measured box as `--rind-indicator-*` custom properties.",
    },
  ],
  props: {
    value: { type: "string | null", description: "Controlled selected tab; `null` selects none." },
    defaultValue: {
      type: "string | null",
      description: "Uncontrolled initial value (default: the first enabled tab).",
    },
    onValueChange: {
      type: "(value, { reason, cancel }) => void",
      description:
        "Every user-caused change, once; `reason` is PRESS, NAVIGATE, INITIAL, COLLECTION.CHANGE or find-in-page; `cancel()` vetoes it.",
    },
    activationMode: {
      type: '"automatic" | "manual"',
      default: '"automatic"',
      description:
        "Automatic: arrows select. Manual: Enter or Space selects. Focus alone never does.",
    },
    orientation: {
      type: '"horizontal" | "vertical"',
      default: '"horizontal"',
      description:
        "Which arrows move focus (vertical: both pairs); `aria-orientation` when vertical.",
    },
    loop: { type: "boolean", default: "true", description: "Arrow moves wrap at both ends." },
    inactivePanels: {
      type: '"unmount" | "hidden" | "until-found"',
      default: '"unmount"',
      description:
        "How inactive panels are hidden. `until-found` lets find-in-page reveal one and select its tab.",
    },
    disabled: { type: "boolean", default: "false", description: "Disables every tab." },
    focusableWhenDisabled: {
      type: "boolean",
      default: "false",
      description: "Disabled tabs stay reachable by arrows (never selectable).",
    },
    render: {
      type: "element | (props, state) => element",
      description: "Substitutes the rendered element without changing behaviour.",
    },
  },
  dataAttributes: {
    root: {
      ...base("root"),
      ...orientation,
      "data-activation-direction": '"next", "previous" or "none": the last selection change.',
    },
    list: {
      ...base("list"),
      ...orientation,
      "data-activation-direction": '"next", "previous" or "none": the last selection change.',
      "data-focus": "While a tab has focus.",
      "data-disabled": "While the tabs are disabled.",
    },
    tab: {
      ...base("tab"),
      ...orientation,
      "data-key": "The tab's value.",
      "data-selected": "While it is the selected tab.",
      "data-highlighted": "While it is the roving focus target.",
      "data-disabled": "While the tab (or the tabs) is disabled.",
      "data-focus": "While focused.",
      "data-focus-visible": "While focused by keyboard or script.",
      "data-pressed": "While a press is in progress.",
      "data-hover": "While hovered.",
    },
    panel: {
      ...base("panel"),
      ...orientation,
      "data-key": "The value of its tab.",
      "data-selected": "While it is the selected panel.",
      "data-reveal": '"find-in-page" while find-in-page revealed it, until the next selection.',
    },
    indicator: {
      ...base("indicator"),
      ...orientation,
      "data-state": '"visible" or "hidden".',
      "data-resizing": "While the box changed by layout, not selection: do not animate.",
    },
  },
  keyboard: [
    [
      "ArrowRight / ArrowLeft",
      "Moves focus to the next / previous enabled tab (mirrored in RTL); automatic mode also selects it.",
    ],
    ["ArrowDown / ArrowUp", "Vertical tabs: next / previous. Same selection rules."],
    ["Home / End", "Moves focus to the first / last enabled tab."],
    ["Enter / Space", "Selects the focused tab (the way to select in manual mode)."],
  ],
  states: {
    idle: "Focus is outside the tab list.",
    focused: "Focus is on a tab.",
  },
  contract: {
    actions: {
      select: ["pointer", "touch", "keyboard", "virtual"],
      focusTab: ["keyboard"],
      press: ["pointer", "touch", "keyboard", "virtual"],
      focus: ["keyboard"],
      arrowNext: ["keyboard"],
      leave: ["keyboard"],
    },
    queries: ["tabs", "selected", "focusedTab", "panel", "isDisabled"],
    traits: ["composite-roving", "selectable", "directional"],
  },
} as const satisfies ComponentMeta
