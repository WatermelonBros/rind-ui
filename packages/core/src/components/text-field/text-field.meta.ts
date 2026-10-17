// The Text Field's API facts for the generated docs (scripts/docs-gen.ts). Data only;
// checked against the code in text-field.meta.test.ts.

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
const base = (part: string) => ({
  "data-scope": '"text-field"',
  "data-part": `"${part}"`,
  "data-instance": "The instance id.",
})

export const textFieldMeta = {
  scope: "text-field",
  name: "Text Field",
  stateless: false,
  parts: [
    {
      name: "TextField.Root",
      part: "root",
      element: "div",
      description: "A Field when not inside one; else it joins the enclosing Field.",
    },
    {
      name: "TextField.Label",
      part: "label",
      element: "label",
      description: "The Field's Label (not rendered inside a Field).",
    },
    {
      name: "TextField.Description",
      part: "description",
      element: "p",
      description: "The Field's Description (not rendered inside a Field).",
    },
    {
      name: "TextField.ErrorMessage",
      part: "error-message",
      element: "p",
      description: "The Field's ErrorMessage (not rendered inside a Field).",
    },
    {
      name: "TextField.Input",
      part: "input",
      element: "input",
      description: "A native `<input>`; every attribute is forwarded.",
    },
    {
      name: "TextField.Textarea",
      part: "textarea",
      element: "textarea",
      description: "A native `<textarea>`; `autosize` grows it with its content.",
    },
    {
      name: "TextField.ClearTrigger",
      part: "clear-trigger",
      element: "button",
      description:
        'Named "Clear", not in the Tab order; rendered only while there is something to clear.',
    },
    {
      name: "TextField.CharacterCount",
      part: "character-count",
      element: "span",
      description: "The count against `maxLength` or a soft `max`; in the control's description.",
    },
    {
      name: "TextField.VisibilityTrigger",
      part: "visibility-trigger",
      element: "button",
      description:
        'With `type="password"`: a toggle button in the Tab order, `aria-pressed`, one name in both states ("Show password").',
    },
    {
      name: "TextField.VisibilityIndicator",
      part: "visibility-indicator",
      element: "span",
      description: "An `aria-hidden` icon slot that follows `data-state`.",
    },
  ],
  props: {
    type: {
      type: "string",
      default: '"text"',
      description:
        'The Input\'s native type. `"password"`: the visibility parts and rules; `"search"`: a searchbox, "Clear search", Escape clears.',
    },
    visible: { type: "boolean", description: 'Controlled visibility (`type="password"`).' },
    defaultVisible: { type: "boolean", default: "false", description: "Uncontrolled visibility." },
    onVisibleChange: {
      type: "(visible, { reason }) => void",
      description:
        "Reasons `PRESS`, `SUBMIT` (any form submit) and `RESET` (an unprevented reset).",
    },
    escapeClears: {
      type: "boolean",
      default: 'true with `type="search"`, else false',
      description:
        "Escape clears a non-empty editable value (reason `ESCAPE`) and is consumed only then.",
    },
    onSubmit: {
      type: "(value, { event }) => void",
      description:
        "Enter, never while composing; the form still submits unless `event.preventDefault()`.",
    },
    value: { type: "string | null", description: "Controlled value (`null` renders empty)." },
    defaultValue: { type: "string", description: "Uncontrolled: the DOM owns the value." },
    onValueChange: {
      type: "(value, { reason, event, isComposing }) => void",
      description:
        "Every change, with its reason (`INPUT`, `CLEAR`, `ESCAPE`, `RESET`). Native `onChange` is forwarded untouched.",
    },
    focusableWhenDisabled: {
      type: "boolean",
      default: "false",
      description: "Disabled but focusable: read-only + `aria-disabled`.",
    },
    countThreshold: {
      type: "number",
      description: "Announce the count at this many remaining (default max(10, 20% of the limit)).",
    },
    messages: {
      type: "{ clear?, clearSearch?, charactersRemaining?, charactersOver?, toggleLabel?, visibilityAnnouncement? }",
      description:
        "The ClearTrigger name (also for search), count announcements, the VisibilityTrigger's name and the shown/hidden announcement.",
    },
    fieldMessages: {
      type: "Field messages",
      description: "The Field's messages when the Root is the Field.",
    },
    autosize: {
      type: "boolean",
      default: "false",
      description: "On Textarea: grows with its content (native `field-sizing` where supported).",
    },
    max: {
      type: "number",
      description: "On CharacterCount: a soft limit (an error past it, never a truncation).",
    },
    count: { type: "(value) => number", description: "On CharacterCount: replaces the counter." },
  },
  dataAttributes: {
    root: {
      ...base("root"),
      ...fieldState,
      "data-focus": "The control has focus.",
      "data-focus-visible": "The control has keyboard focus.",
      "data-composing": "An IME composition is in progress.",
      "data-empty": "The value is empty.",
      "data-state": '`type="password"`: "visible" or "hidden".',
    },
    input: {
      ...base("input"),
      ...fieldState,
      "data-focus": "Focused.",
      "data-focus-visible": "Keyboard focus.",
      "data-composing": "Composing.",
      "data-empty": "The value is empty.",
      "data-state": '`type="password"`: "visible" or "hidden".',
      "data-custom-reveal": "A VisibilityTrigger is mounted (Edge's `::-ms-reveal` is hidden).",
      "data-custom-clear":
        '`type="search"` with a ClearTrigger mounted (the native cancel button is hidden).',
    },
    "visibility-trigger": {
      ...base("visibility-trigger"),
      "data-disabled": "While disabled.",
      "data-state": '"visible" or "hidden".',
      "data-pressed": "A press is in progress.",
      "data-focus-visible": "Keyboard focus.",
    },
    "visibility-indicator": {
      ...base("visibility-indicator"),
      ...fieldState,
      "data-state": '"visible" or "hidden".',
    },
    "character-count": {
      ...base("character-count"),
      ...fieldState,
      "data-over-limit": "The count exceeds the limit.",
    },
  },
  keyboard: [
    [
      "Enter",
      "In an Input: commits the value (Field) and calls `onSubmit`, unless an IME is composing; the form submits natively.",
    ],
    [
      "Escape",
      "With `escapeClears` and a non-empty editable value: clears it (consumed only then).",
    ],
    ["Space / Enter", "On the VisibilityTrigger: toggles visibility (focus stays on it)."],
    ["⌘/Ctrl + A, Backspace", "Native editing; nothing is overridden."],
  ],
  states: {
    idle: "Not composing: changes validate, count and announce.",
    composing:
      "An IME composition: changes are reported (`isComposing`), never validated, counted or announced.",
  },
  contract: {
    actions: {
      type: ["pointer", "keyboard", "virtual"],
      fill: ["keyboard"],
      clear: ["pointer", "keyboard", "virtual"],
      compose: ["keyboard"],
      composeOpen: ["keyboard"],
      composeEnd: ["keyboard"],
      blur: ["keyboard"],
      reset: ["pointer", "keyboard", "virtual"],
      escape: ["keyboard"],
      submit: ["keyboard"],
      toggleVisibility: ["pointer", "keyboard", "touch", "virtual"],
      submitForm: ["pointer", "keyboard", "virtual"],
    },
    queries: [
      "value",
      "name",
      "description",
      "isInvalid",
      "isDisabled",
      "isReadOnly",
      "isRequired",
      "errors",
      "characterCount",
      "isClearable",
      "isComposing",
      "isEmpty",
      "isVisible",
      "inputType",
      "toggleName",
    ],
    traits: ["field-associated"],
  },
} as const satisfies ComponentMeta
