// The Collapsible's API facts for the generated docs (scripts/docs-gen.ts). Data only;
// checked against the code in collapsible.meta.test.ts.

import type { ComponentMeta } from "../meta"

const base = (part: string) => ({
  "data-scope": '"collapsible"',
  "data-part": `"${part}"`,
  "data-instance": "The instance id.",
  "data-state": '"open" or "closed", in every state (the exit-animation hook while mounted).',
  "data-disabled": "While disabled.",
})

export const collapsibleMeta = {
  scope: "collapsible",
  name: "Collapsible",
  stateless: false,
  parts: [
    { name: "Collapsible.Root", part: "root", element: "div", description: "Owns the open state." },
    {
      name: "Collapsible.Trigger",
      part: "trigger",
      element: "button",
      description:
        'The disclosure button (`type="button"`); a substituted non-button gets `role="button"` and `tabIndex=0`.',
    },
    {
      name: "Collapsible.Content",
      part: "content",
      element: "div",
      description:
        "The region shown and hidden; carries `--rind-collapsible-content-height` and `--rind-collapsible-content-width`.",
    },
    {
      name: "Collapsible.Indicator",
      part: "indicator",
      element: "span",
      description: 'A decorative chevron or icon slot; `aria-hidden="true"`.',
    },
  ],
  props: {
    open: { type: "boolean", description: "Controlled open state." },
    defaultOpen: { type: "boolean", default: "false", description: "Uncontrolled initial state." },
    onOpenChange: {
      type: "(open, { event }) => void",
      description:
        "Every user-caused change, with its event (`TOGGLE`, or `OPEN`/`CLOSE` with a `reason`). Not called when the parent changes `open`.",
    },
    disabled: {
      type: "boolean",
      default: "false",
      description: "Ignores activation; the open state and the content's visibility are unchanged.",
    },
    focusableWhenDisabled: {
      type: "boolean",
      default: "false",
      description: "Disabled but focusable: `aria-disabled` instead of native `disabled`.",
    },
    closedContent: {
      type: '"until-found" | "hidden" | "unmount"',
      default: '"until-found"',
      description:
        'How closed, settled content is kept: `hidden="until-found"` (find-in-page opens it), `hidden`, or removed. A disabled collapsible degrades `until-found` to `hidden`.',
    },
  },
  dataAttributes: {
    root: base("root"),
    trigger: {
      ...base("trigger"),
      "data-focus": "Focused.",
      "data-focus-visible": "Keyboard focus.",
      "data-pressed": "While pressed.",
      "data-hover": "While hovered.",
    },
    content: {
      ...base("content"),
      "data-reveal":
        '"mount" from the first render, or "find-in-page" after a search reveal, until the next transition.',
    },
    indicator: base("indicator"),
  },
  keyboard: [["Enter, Space", "On the trigger: toggles the content. Key repeats are ignored."]],
  states: {
    closed: "Closed immediately; the content stays mounted until its exit animation ends.",
    open: 'Open; `aria-expanded="true"` from the moment of the transition.',
  },
  contract: {
    actions: {
      open: ["pointer", "keyboard", "virtual"],
      close: ["pointer", "keyboard", "virtual"],
      toggle: ["pointer", "keyboard", "virtual"],
    },
    queries: ["isOpen", "isDisabled", "contentText", "hiddenMode"],
    traits: ["disclosure", "presence"],
  },
} as const satisfies ComponentMeta
