// Color Picker's API facts for the generated docs (scripts/docs-gen.ts); checked in
// color-picker.meta.test.ts.

import type { ComponentMeta } from "../meta"

export const colorPickerMeta = {
  scope: "color-picker",
  name: "Color Picker",
  stateless: false,
  parts: [
    {
      name: "ColorPicker.Root",
      part: "root",
      element: "div",
      description: "A Field host: owns the colour, the format and the open state.",
    },
    {
      name: "ColorPicker.Label",
      part: "label",
      element: "label",
      description: "Names the Control, the Trigger and the content.",
    },
    {
      name: "ColorPicker.Control",
      part: "control",
      element: "div",
      description: '`role="group"`: the Popover\'s anchor.',
    },
    {
      name: "ColorPicker.Trigger",
      part: "trigger",
      element: "button",
      description: "Opens the content; named with the colour.",
    },
    {
      name: "ColorPicker.Portal / Positioner / Content",
      part: "content",
      element: "div",
      description: 'The Popover\'s (inline: `role="group"`, in place).',
    },
    {
      name: "ColorPicker.Area / AreaBackground / AreaThumb",
      part: "area / area-background / area-thumb (its inputs: area-input)",
      element: "div",
      description: "The colour area: two channels as a 2D surface.",
    },
    {
      name: "ColorPicker.ChannelSlider (+ Label, ValueText, Track, Thumb)",
      part: "channel-slider (+ -label, -value-text, -control, -track, -thumb)",
      element: "div",
      description: "One channel on a slider, its track painted with the channel's gradient.",
    },
    {
      name: "ColorPicker.ChannelInput",
      part: "channel-input (its wrapper: channel-input-root)",
      element: "input",
      description: "`hex` / `css`: a colour text field; a channel: a number field for it.",
    },
    {
      name: "ColorPicker.SwatchGroup / SwatchTrigger / SwatchIndicator",
      part: "swatch-group / swatch-trigger / swatch-indicator",
      element: "div",
      description: "A palette (a radio group of colours); the indicator is the one selected mark.",
    },
    {
      name: "ColorPicker.Swatch / ValueSwatch",
      part: "swatch / value-swatch",
      element: "div",
      description: "A colour chip named by its colour; ValueSwatch shows the picker's colour.",
    },
    {
      name: "ColorPicker.TransparencyGrid",
      part: "transparency-grid",
      element: "div",
      description: "A checkerboard under a colour with transparency (decorative).",
    },
    {
      name: "ColorPicker.EyeDropperTrigger",
      part: "eye-dropper-trigger",
      element: "button",
      description: "Hidden where the browser has no EyeDropper.",
    },
    {
      name: "ColorPicker.FormatSelect / FormatTrigger",
      part: "format-select",
      element: "select / button",
      description: "Set or cycle the format.",
    },
    {
      name: "ColorPicker.View",
      part: "view",
      element: "div",
      description: "Renders its children only for its `format`.",
    },
    {
      name: "ColorPicker.ValueText",
      part: "value-text",
      element: "span",
      description: "The colour in the current format.",
    },
    {
      name: "ColorPicker.HiddenInput",
      part: "hidden-input",
      element: "input",
      description: "The form value (rendered automatically).",
    },
  ],
  props: {
    value: { type: "string | Color", description: "The colour (controlled)." },
    defaultValue: {
      type: "string | Color",
      default: '"#000000"',
      description: "The initial colour.",
    },
    onValueChange: {
      type: "(color: Color, details) => void",
      description: "Each change, in the space of `format`.",
    },
    onValueCommit: {
      type: "(color: Color, details) => void",
      description: "Once at the end of each interaction.",
    },
    format: {
      type: '"hex" | "rgb" | "hsl" | "hsb"',
      description: "Display and emission format (controlled).",
    },
    defaultFormat: {
      type: "format",
      description: "Default: from the first colour (a hex string gives `hex`).",
    },
    onFormatChange: { type: "(format) => void", description: "The format changed." },
    open: { type: "boolean", description: "Open (controlled)." },
    defaultOpen: { type: "boolean", default: "false", description: "Open at first." },
    onOpenChange: {
      type: "(open, details) => void",
      description: "Popover reasons plus `select`.",
    },
    inline: {
      type: "boolean",
      default: "false",
      description: "The content in place: no Popover, no layer, no listeners.",
    },
    closeOnSelect: {
      type: "boolean",
      default: "false",
      description: "A swatch pick closes the Popover.",
    },
    modal: { type: "boolean", default: "false", description: "As Popover." },
    name: { type: "string", description: "Submits `#RRGGBB(AA)` (or `formFormat`)." },
    formFormat: {
      type: '"hex" | "rgb" | "hsl" | "hsb" | "css"',
      description: "The submitted text's format.",
    },
    disabled: { type: "boolean", default: "false", description: "Disables every part and closes." },
    readOnly: { type: "boolean", default: "false", description: "Focusable, changes nothing." },
    messages: {
      type: "Partial<ColorPickerMessages>",
      description: "Every string of the picker and its children.",
    },
  },
  dataAttributes: {
    root: {
      "data-scope": '"color-picker"',
      "data-part": '"root"',
      "data-instance": "The instance id.",
      "data-disabled": "Present when disabled.",
      "data-readonly": "Present when read-only.",
      "data-invalid": "Present while invalid.",
      "data-dragging": "Present while a child drags.",
      "data-inline": "Present in inline mode.",
      "data-format": "The current format.",
    },
    "every part": {
      "data-scope":
        '"color-picker": the area, the channel sliders, the inputs and the swatches too',
      "data-part":
        "The part's name (the anatomy table): `area-thumb`, `channel-slider-track`, `swatch-trigger`, …",
      "data-channel": "On `channel-slider` and `channel-input-root`: the channel it edits.",
    },
  },
  keyboard: [
    ["Enter / Space (Trigger)", "Opens the content."],
    ["Escape", "Closes it (after a dirty input reverts first)."],
  ],
  states: {
    closed: "The content is not shown.",
    open: "The content is shown in its Popover (an inline picker stays `closed`: its content is always shown in place).",
  },
  contract: {
    actions: {
      open: ["pointer", "keyboard"],
      close: ["keyboard"],
      pressOutside: ["pointer"],
      tab: ["keyboard"],
      shiftTab: ["keyboard"],
      setFormat: ["keyboard"],
      resetForm: ["pointer", "keyboard"],
    },
    queries: [
      "color",
      "format",
      "valueText",
      "colorName",
      "isOpen",
      "isInline",
      "formValue",
      "closeReason",
      "isEyeDropperAvailable",
    ],
    traits: ["form-associated", "field-associated"],
  },
} as const satisfies ComponentMeta
