// Color Slider's API facts for the generated docs (scripts/docs-gen.ts); checked in
// color-slider.meta.test.ts. Every Slider part, prop and attribute applies as well.

import type { ComponentMeta } from "../meta"

export const colorSliderMeta = {
  scope: "color-slider",
  name: "Color Slider",
  stateless: false,
  parts: [
    {
      name: "ColorSlider.Root",
      part: "root",
      element: "div",
      description:
        'The Slider\'s Root (`data-scope="slider"`); without a Control it is the pointer surface.',
    },
    {
      name: "ColorSlider.Label",
      part: "label",
      element: "label",
      description: "The visible name.",
    },
    {
      name: "ColorSlider.ValueText",
      part: "value-text",
      element: "div",
      description: "The channel's value and the colour name. Not a live region.",
    },
    {
      name: "ColorSlider.Control",
      part: "control",
      element: "div",
      description: "Optional pointer surface.",
    },
    {
      name: "ColorSlider.Track",
      part: "track",
      element: "div",
      description: "Carries the channel's gradient inline.",
    },
    {
      name: "ColorSlider.Thumb",
      part: "thumb",
      element: "div",
      description: "The handle and its native range input (role slider).",
    },
    {
      name: "ColorSlider.Description",
      part: "description",
      element: "div",
      description: "Help text.",
    },
    {
      name: "ColorSlider.TransparencyGrid",
      part: "transparency-grid",
      element: "div",
      description: "A decorative checkerboard under a gradient with transparency.",
    },
  ],
  props: {
    channel: {
      type: "ColorChannel",
      description: "Required: red, green, blue, hue, saturation, lightness, brightness or alpha.",
    },
    value: { type: "string | Color", description: "The colour (controlled)." },
    defaultValue: {
      type: "string | Color",
      default: '"hsb(0, 100%, 100%)"',
      description: "The initial colour (uncontrolled).",
    },
    onValueChange: {
      type: "(color: Color, details) => void",
      description: "Each applied change, in the space of the colour you passed.",
    },
    onValueCommit: {
      type: "(color: Color, details) => void",
      description: "Once at the end of each interaction that changed the colour.",
    },
    colorSpace: {
      type: '"rgb" | "hsl" | "hsb"',
      description: "The working space (default: the colour's when it has the channel).",
    },
    orientation: {
      type: '"horizontal" | "vertical"',
      default: '"horizontal"',
      description: "As Slider.",
    },
    colorName: {
      type: "string | (color) => string",
      description: "Replaces the colour name in the value text.",
    },
    messages: {
      type: "Partial<ColorSliderMessages>",
      description: "Channel names, value text and colour words.",
    },
  },
  dataAttributes: {
    root: {
      "data-channel": "The channel.",
      "data-space": "The working space.",
    },
  },
  keyboard: [
    ["ArrowLeft / ArrowRight / ArrowUp / ArrowDown", "One channel step (as Slider)."],
    ["Shift + arrow, PageUp / PageDown", "The channel's page step."],
    ["Home / End", "The channel's minimum / maximum."],
  ],
  states: {
    idle: "No pointer drag.",
    dragging: "A pointer drag is active.",
  },
  contract: {
    actions: {},
    queries: ["channel", "color", "colorName", "gradient"],
    traits: ["valued", "directional", "form-associated", "field-associated"],
  },
} as const satisfies ComponentMeta
