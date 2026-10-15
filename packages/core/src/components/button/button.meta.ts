// Button's API facts for the generated docs (scripts/docs-gen.ts). Data only, type-only
// imports; checked against the code in button.meta.test.ts.

import type { ComponentMeta } from "../meta"

export const buttonMeta = {
  scope: "button",
  name: "Button",
  stateless: false,
  parts: [
    {
      name: "Button",
      part: "root",
      element: "button",
      description: 'A native `<button type="button">` by default.',
    },
  ],
  props: {
    type: {
      type: '"button" | "submit" | "reset"',
      default: '"button"',
      description: "Never submits a form by accident; rendered as `button` while pending.",
    },
    disabled: {
      type: "boolean",
      default: "false",
      description: "Native `disabled` on a `<button>`, `aria-disabled` elsewhere.",
    },
    focusableWhenDisabled: {
      type: "boolean",
      default: "false",
      description: "Disabled but still in the Tab order (`aria-disabled`).",
    },
    pending: {
      type: "boolean",
      default: "false",
      description:
        "Ignores activation and keeps focus (`aria-disabled`, never `disabled`); announces `messages.pending` when focused.",
    },
    onPress: {
      type: "(details: ButtonPressDetails) => void",
      description: "Once per activation, with `modality` and the modifier keys.",
    },
    onPressStart: {
      type: "(details: ButtonPressDetails) => void",
      description: "A press starts.",
    },
    onPressEnd: {
      type: "(details: ButtonPressDetails) => void",
      description: "A press ends, also when cancelled or released outside.",
    },
    messages: {
      type: "{ pending?: string }",
      description: 'Overrides; default `pending: "Loading"`.',
    },
    render: {
      type: "ReactElement | (props, state) => ReactNode",
      description:
        'Another element: `<a href>` stays a link and routes like a Link; anything else gets `role="button"` and `tabIndex`.',
    },
  },
  dataAttributes: {
    root: {
      "data-scope": '"button"',
      "data-part": '"root"',
      "data-instance": "The instance id.",
      "data-state": '"idle" or "pending".',
      "data-pending": "While pending.",
      "data-disabled": "While disabled (also by a disabled `<fieldset>`) or pending.",
      "data-focus": "While focused.",
      "data-focus-visible": "While focused by keyboard or assistive technology.",
      "data-pressed": "While a press is in progress.",
      "data-hover": "While a mouse or pen is over it.",
    },
  },
  keyboard: [
    ["Enter", "Activates it (follows the link when rendered as `<a href>`)."],
    ["Space", "Activates it on release (not when rendered as a link)."],
    [
      "Tab / Shift + Tab",
      "Next / previous tabbable element; a disabled Button is skipped unless `focusableWhenDisabled`.",
    ],
  ],
  states: {
    idle: "Ready: presses call `onPress`.",
    pending: "The `pending` prop is set: presses are ignored and focus stays.",
  },
  contract: {
    actions: { press: ["pointer", "keyboard", "touch", "virtual"], pressWithSpace: ["keyboard"] },
    queries: ["isDisabled", "isPending", "isFocused", "isFocusVisible"],
    traits: [],
  },
} as const satisfies ComponentMeta
