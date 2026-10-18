// The Date Field's API facts for the generated docs (scripts/docs-gen.ts). Data only; checked
// against the code in date-field.meta.test.ts.

import type { ComponentMeta } from "../meta"

const base = (part: string) => ({
  "data-scope": '"date-field"',
  "data-part": `"${part}"`,
  "data-instance": "The instance id.",
})
const field = {
  "data-disabled": "While disabled.",
  "data-readonly": "While read-only.",
  "data-required": "While required.",
  "data-invalid": "The Field displays an error.",
}
const focus = {
  "data-focus": "A segment has focus.",
  "data-focus-visible": "A segment has keyboard focus.",
}
const whole = {
  "data-placeholder-shown": "Every editable segment is empty.",
  "data-complete": "Every editable segment has a value.",
  "data-composing": "An IME is composing in a segment.",
}

export const dateFieldMeta = {
  scope: "date-field",
  name: "Date Field",
  stateless: false,
  parts: [
    {
      name: "DateField.Root",
      part: "root",
      element: "div",
      description:
        "Holds the state; a Field when not inside one (embedded in a host: a plain element).",
    },
    { name: "DateField.Label", part: "label", element: "label", description: "Names the group." },
    {
      name: "DateField.Description",
      part: "description",
      element: "div",
      description: "Describes the first segment (every segment while invalid).",
    },
    {
      name: "DateField.ErrorMessage",
      part: "error-message",
      element: "div",
      description: "The Field's error, shown per its validation mode.",
    },
    {
      name: "DateField.Input",
      part: "input",
      element: "div",
      description:
        '`role="group"` named by the Label, described by the whole value; children: a render function over the segments, or none (automatic).',
    },
    {
      name: "DateField.Segment",
      part: "segment",
      element: "input",
      description:
        'An editable segment is a native `<input role="spinbutton">` named "month" + label; a literal is an `aria-hidden` span.',
    },
  ],
  props: {
    value: { type: "DateValue | null", description: "Controlled value." },
    defaultValue: { type: "DateValue | null", description: "Uncontrolled value." },
    onValueChange: {
      type: "(value, { reason, modality }) => void",
      description:
        "At commit points only: `SEGMENT.COMMIT`, `STEP`, `PASTE`, `CLEAR`, `RESET`. Typing inside a segment never changes the value.",
    },
    placeholderValue: {
      type: "DateValue",
      description:
        "Where stepping an empty segment starts, and the value's type and zone (default: today at 00:00).",
    },
    granularity: {
      type: '"day" | "hour" | "minute" | "second"',
      description: "The smallest segment (default `day` for dates, `minute` for date-times).",
    },
    hourCycle: { type: "12 | 24", description: "Default: the locale's." },
    hideTimeZone: { type: "boolean", default: "false", description: "No zone name segment." },
    shouldForceLeadingZeros: {
      type: "boolean",
      default: "false",
      description: "Months, days and hours always two digits.",
    },
    minValue: { type: "DateValue | null", description: "Earlier dates are invalid." },
    maxValue: { type: "DateValue | null", description: "Later dates are invalid." },
    isDateUnavailable: { type: "(date) => boolean", description: "Such a date is invalid." },
    locale: { type: "string", description: "Default: the provider's." },
    createCalendar: {
      type: "(identifier) => Calendar",
      description: "From `@internationalized/date`: calendar systems other than gregorian.",
    },
    name: { type: "string", description: "The hidden input's name (ISO value)." },
    form: { type: "string", description: "The hidden input's form." },
    autoComplete: { type: "string", description: "On the hidden input (`bday`, …)." },
    disabled: { type: "boolean", default: "false", description: "Segments disabled." },
    readOnly: {
      type: "boolean",
      default: "false",
      description: "Focusable; keys and typing change nothing.",
    },
    required: { type: "boolean", default: "false", description: "An empty field is invalid." },
    embedded: {
      type: "boolean",
      default: "false",
      description: "Inside a host (Date Picker): no Field, Label or hidden input.",
    },
    labelledBy: { type: "string[]", description: "Embedded: the ids naming the segments." },
    describedBy: { type: "string[]", description: "Embedded: the ids describing them." },
    onValidityChange: {
      type: "(flags, message) => void",
      description: "Embedded: the field's own validity, after mount and on change.",
    },
    onBoundary: {
      type: "({ direction, reason }) => void",
      description: "Typing, Backspace or an arrow found no segment to move to.",
    },
    onDraftChange: {
      type: "({ year, month, day }) => void",
      description: "The committed segments changed (a host following the typed date).",
    },
    segmentScope: {
      type: "RefObject<HTMLElement>",
      description: "Arrows move across every field's segments inside it.",
    },
    messages: {
      type: "Partial<DateFieldMessages>",
      description: "Segment names, placeholders, value texts, validity messages.",
    },
  },
  dataAttributes: {
    root: { ...base("root"), ...field, ...focus, ...whole },
    input: { ...base("input"), ...field, ...focus, ...whole },
    segment: {
      ...base("segment"),
      "data-type":
        "`year`, `month`, `day`, `hour`, `minute`, `second`, `dayPeriod`, `era`, `timeZoneName` or `literal`.",
      "data-editable": "An editable segment.",
      "data-placeholder": "Empty (its placeholder shows).",
      ...focus,
      ...field,
    },
    "hidden-input": {
      ...base("hidden-input"),
      "data-validity":
        "The control's own invalid reason: `incomplete`, `impossible`, `rangeUnderflow`, `rangeOverflow`, `unavailable`.",
    },
  },
  keyboard: [
    ["Digits", "Type the segment; focus moves on when no further digit fits."],
    ["/ - . : space", "Move to the next segment."],
    ["ArrowUp / ArrowDown", "Step the segment (wraps, never carries)."],
    ["PageUp / PageDown", "Larger step (year 5, month 2, day 7, hour 2, minute 15)."],
    ["Home / End", "Segment minimum / maximum."],
    ["ArrowLeft / ArrowRight", "Previous / next segment as shown."],
    ["Tab / Shift+Tab", "Next / previous segment, then out of the field."],
    ["Backspace / Delete", "Remove a digit; in an empty segment go back."],
    ["⌘/Ctrl+A, then Backspace", "Clear every segment."],
    ["Enter", "Submit the form (never changes a segment)."],
  ],
  states: {
    idle: "No segment has focus.",
    editing: "A segment has focus; typing fills it.",
    composing: "An IME composes; keys and filtering wait for its text.",
  },
  contract: {
    actions: {
      enter: ["keyboard"],
      fill: ["pointer", "keyboard", "virtual"],
      typeSegment: ["keyboard"],
      typeFocused: ["keyboard"],
      step: ["keyboard"],
      toEdge: ["keyboard"],
      move: ["keyboard"],
      backspace: ["keyboard"],
      clearSegment: ["keyboard"],
      clear: ["keyboard"],
      paste: ["keyboard"],
      leave: ["pointer", "keyboard", "virtual"],
      composeOpen: ["keyboard"],
      composeEnd: ["keyboard"],
      resetForm: ["pointer", "keyboard", "virtual"],
    },
    queries: [
      "value",
      "segments",
      "focusedSegment",
      "isInvalid",
      "validity",
      "isComplete",
      "isFocused",
      "isComposing",
      "isDisabled",
      "isReadOnly",
    ],
    traits: ["valued", "form-associated", "field-associated"],
  },
} as const satisfies ComponentMeta
