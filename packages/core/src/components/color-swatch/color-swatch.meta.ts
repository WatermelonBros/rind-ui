// Color Swatch's API facts for the generated docs (scripts/docs-gen.ts); checked in
// color-swatch.meta.test.ts.

import type { ComponentMeta } from "../meta"

export const colorSwatchMeta = {
  scope: "color-swatch",
  name: "Color Swatch",
  stateless: true,
  parts: [
    {
      name: "ColorSwatch.Root",
      part: "root",
      element: "div",
      description: 'The chip: `role="img"`, named by the colour, never focusable.',
    },
    {
      name: "ColorSwatch.TransparencyGrid",
      part: "transparency-grid",
      element: "div",
      description: "A decorative checkerboard under a colour with transparency.",
    },
  ],
  props: {
    color: {
      type: "string | Color",
      default: "transparent",
      description: "The colour shown; a string is parsed with `parseColor`.",
    },
    respectAlpha: {
      type: "boolean",
      default: "true",
      description: "`false` shows the opaque colour.",
    },
    colorName: {
      type: "string | (color) => string",
      description: "A fixed name (a design token) or a function replacing the computed name.",
    },
    locale: { type: "string", description: "Formats the transparency percentage." },
    messages: {
      type: "Partial<ColorSwatchMessages>",
      description: "The role description and the colour words.",
    },
    render: { type: "ReactElement | (props, state) => ReactNode", description: "Another element." },
  },
  dataAttributes: {
    root: {
      "data-scope": '"color-swatch"',
      "data-part": '"root"',
      "data-instance": "The instance id.",
      "data-transparent": "Present when alpha is below 1 (the theme draws a checkerboard).",
    },
  },
  keyboard: [],
  contract: { actions: {}, queries: ["color", "colorName", "isTransparent"], traits: [] },
} as const satisfies ComponentMeta
