// The Password Input's API facts for the generated docs (scripts/docs-gen.ts). Data only;
// checked against the code in password-input.meta.test.ts.

import type { ComponentMeta } from "../meta"

const fieldState = {
  "data-disabled": "While disabled.",
  "data-readonly": "While read-only.",
  "data-invalid": "An error is displayed (Field).",
  "data-state": '"visible" or "hidden".',
}
const base = (part: string) => ({
  "data-scope": '"password-input"',
  "data-part": `"${part}"`,
  "data-instance": "The instance id.",
})

export const passwordInputMeta = {
  scope: "password-input",
  name: "Password Input",
  stateless: false,
  parts: [
    {
      name: "PasswordInput.Root",
      part: "root",
      element: "div",
      description: "A Field when not inside one; else it joins the enclosing Field.",
    },
    {
      name: "PasswordInput.Label",
      part: "label",
      element: "label",
      description: "The Field's Label (not rendered inside a Field).",
    },
    {
      name: "PasswordInput.Description",
      part: "description",
      element: "p",
      description: "The Field's Description (not rendered inside a Field).",
    },
    {
      name: "PasswordInput.ErrorMessage",
      part: "error-message",
      element: "p",
      description: "The Field's ErrorMessage (not rendered inside a Field).",
    },
    {
      name: "PasswordInput.Input",
      part: "input",
      element: "input",
      description:
        '`type="password"`, or `"text"` while revealed; spellcheck, autocorrect and autocapitalize off.',
    },
    {
      name: "PasswordInput.VisibilityTrigger",
      part: "visibility-trigger",
      element: "button",
      description:
        'A toggle button in the Tab order: `aria-pressed`, one name in both states ("Show password").',
    },
    {
      name: "PasswordInput.Indicator",
      part: "indicator",
      element: "span",
      description: "An `aria-hidden` icon slot that follows `data-state`.",
    },
  ],
  props: {
    visible: { type: "boolean", description: "Controlled visibility." },
    defaultVisible: { type: "boolean", default: "false", description: "Uncontrolled visibility." },
    onVisibleChange: {
      type: "(visible, { reason }) => void",
      description:
        "Reasons `PRESS`, `SUBMIT` (any form submit) and `RESET` (an unprevented reset).",
    },
    value: { type: "string | null", description: "Controlled value (Text Field's)." },
    defaultValue: { type: "string", description: "Uncontrolled value (Text Field's)." },
    onValueChange: {
      type: "(value, { reason, event, isComposing }) => void",
      description: "Every change, as Text Field's.",
    },
    messages: {
      type: "{ toggleLabel?, visibilityAnnouncement?, clear?, … }",
      description: "The trigger's name and the shown/hidden announcement, plus Text Field's.",
    },
    autoComplete: {
      type: "string",
      default: '"current-password"',
      description: 'On Input: `"new-password"` for sign-up forms; any value passes through.',
    },
  },
  dataAttributes: {
    root: { ...base("root"), ...fieldState, "data-focus": "The input has focus." },
    input: {
      ...base("input"),
      ...fieldState,
      "data-custom-reveal": "A VisibilityTrigger is mounted (Edge's `::-ms-reveal` is hidden).",
    },
    "visibility-trigger": {
      ...base("visibility-trigger"),
      "data-disabled": "While disabled.",
      "data-state": '"visible" or "hidden".',
      "data-pressed": "A press is in progress.",
      "data-focus-visible": "Keyboard focus.",
    },
    indicator: { ...base("indicator"), ...fieldState },
  },
  keyboard: [
    ["Space / Enter", "On the VisibilityTrigger: toggles visibility (focus stays on it)."],
    ["Enter", "In the Input: commits (Field) and submits the form natively."],
  ],
  states: {
    idle: "Not composing (Text Field's).",
    composing: "An IME composition (Text Field's); visibility still toggles.",
  },
  contract: {
    actions: {
      type: ["pointer", "keyboard", "virtual"],
      fill: ["keyboard"],
      clear: ["keyboard"],
      compose: ["keyboard"],
      composeOpen: ["keyboard"],
      composeEnd: ["keyboard"],
      blur: ["keyboard"],
      toggleVisibility: ["pointer", "keyboard", "touch", "virtual"],
      submitForm: ["pointer", "keyboard", "virtual"],
      resetForm: ["pointer", "keyboard", "virtual"],
    },
    queries: [
      "value",
      "isVisible",
      "inputType",
      "toggleName",
      "isInvalid",
      "isDisabled",
      "isComposing",
    ],
    traits: ["field-associated"],
  },
} as const satisfies ComponentMeta
