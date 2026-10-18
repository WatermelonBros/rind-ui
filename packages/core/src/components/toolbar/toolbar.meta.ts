// The Toolbar's API facts for the generated docs (scripts/docs-gen.ts). Data only; checked
// against the code in toolbar.meta.test.ts.

import type { ComponentMeta } from "../meta"

const base = (part: string) => ({
  "data-scope": '"toolbar"',
  "data-part": `"${part}"`,
  "data-instance": "The instance id.",
})

const orientation = { "data-orientation": '"horizontal" or "vertical".' }

/** What every roving control carries, whichever component renders it. */
const control = {
  ...orientation,
  "data-host": '"toolbar": marks the control as one of the toolbar\'s (hosted items too).',
  "data-disabled": "While the control (or its group, or the toolbar) is disabled.",
  "data-highlighted": "While it is the remembered control and focus is inside the toolbar.",
}

export const toolbarMeta = {
  scope: "toolbar",
  name: "Toolbar",
  stateless: false,
  parts: [
    {
      name: "Toolbar.Root",
      part: "root",
      element: "div",
      description:
        '`role="toolbar"`, named by `aria-label` or `aria-labelledby`; owns the arrows and Home / End for its own controls and is one tab stop with focus memory.',
    },
    {
      name: "Toolbar.Button",
      part: "button",
      element: "button",
      description: "A Button with the roving tab stop; Press Without Focus passes through.",
    },
    {
      name: "Toolbar.Link",
      part: "link",
      element: "a",
      description: "A Link in the roving order; Space activates it once, without scrolling.",
    },
    {
      name: "Toolbar.Item",
      part: "item",
      element: "button",
      description:
        "Any control through `render`: another component's trigger, a checkbox, a text input.",
    },
    {
      name: "Toolbar.Group",
      part: "group",
      element: "div",
      description:
        '`role="group"`; `disabled` cascades to its controls, hosted Toggle Group and Radio Group items included.',
    },
    {
      name: "Toolbar.Separator",
      part: "separator",
      element: "div",
      description:
        "A Separator perpendicular to the toolbar by default; an explicit `orientation` wins.",
    },
  ],
  props: {
    orientation: {
      type: '"horizontal" | "vertical"',
      default: '"horizontal"',
      description:
        "Which arrows move focus (vertical: Up and Down); `aria-orientation` only when vertical.",
    },
    loop: { type: "boolean", default: "true", description: "Arrow moves wrap at both ends." },
    disabled: { type: "boolean", default: "false", description: "Disables every control." },
    focusableWhenDisabled: {
      type: "boolean",
      default: "true",
      description:
        "Disabled controls stay reachable by arrows (`aria-disabled`); `false` uses native `disabled` and skips them.",
    },
    actionsRef: {
      type: "Ref<{ focus(): void }>",
      description: "`focus()` moves focus to the toolbar's tab stop (an application shortcut).",
    },
    "*.render": {
      type: "element | (props, state) => element",
      description: "Substitutes the rendered element without changing behaviour.",
    },
  },
  dataAttributes: {
    root: {
      ...base("root"),
      ...orientation,
      "data-disabled": "While the toolbar is disabled.",
    },
    button: { ...base("button"), ...control, "data-key": "The control's element id." },
    link: { ...base("link"), ...control, "data-key": "The control's element id." },
    item: { ...base("item"), ...control, "data-key": "The control's element id." },
    group: { ...base("group"), ...orientation, "data-disabled": "While the group is disabled." },
    separator: {
      "data-scope": '"toolbar"',
      "data-part": '"separator"',
      "data-instance": "The instance id.",
      "data-orientation": '"horizontal" | "vertical": its own orientation.',
      "data-decorative": "Present when the separator is not exposed.",
    },
  },
  keyboard: [
    ["Tab / Shift+Tab", "The toolbar is one tab stop: the last focused control, else the first."],
    [
      "ArrowRight / ArrowLeft",
      "Horizontal: next / previous control (mirrored in RTL); wraps unless `loop={false}`.",
    ],
    ["ArrowDown / ArrowUp", "Vertical: next / previous control."],
    ["Home / End", "First / last control."],
    [
      "Arrows in a text field",
      "Move the control only at the caret's edge on that axis (and with no selection); otherwise the field keeps them.",
    ],
    ["Enter / Space", "Activate the focused control (its own behaviour)."],
  ],
  states: {
    idle: "Focus is outside the toolbar.",
    focused: "Focus is on one of the toolbar's controls.",
  },
  contract: {
    actions: {
      tabIn: ["keyboard"],
      moveTo: ["keyboard"],
      press: ["pointer", "touch", "keyboard", "virtual"],
      tabOut: ["keyboard"],
      focusControl: ["keyboard"],
      arrowNext: ["keyboard"],
      leave: ["keyboard"],
    },
    queries: ["items", "focusedItem", "tabStop", "isDisabled", "orientation"],
    traits: ["directional"],
  },
} as const satisfies ComponentMeta
