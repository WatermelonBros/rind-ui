// Meter's API facts for the generated docs (scripts/docs-gen.ts). Data only;
// checked against the code in meter.meta.test.ts.

import type { ComponentMeta } from "../meta"

const base = (part: string) => ({
  "data-scope": '"meter"',
  "data-part": `"${part}"`,
  "data-instance": "The instance id.",
  "data-orientation": '"horizontal" or "vertical".',
  "data-zone":
    '"optimum", "suboptimum" or "even-less-good", when `low`, `high` or `optimum` is set.',
})

export const meterMeta = {
  scope: "meter",
  name: "Meter",
  stateless: false,
  parts: [
    {
      name: "Meter.Root",
      part: "root",
      element: "div",
      description:
        '`role="meter"` (exactly) with the value attributes, named by the Label; ends with a visually hidden filler span (NVDA, quirk `nvda-progressbar-name`).',
    },
    { name: "Meter.Label", part: "label", element: "span", description: "The name." },
    {
      name: "Meter.ValueText",
      part: "value-text",
      element: "span",
      description:
        '`aria-hidden="true"`; its default content is the value text (the same string as `aria-valuetext`).',
    },
    { name: "Meter.Track", part: "track", element: "div", description: "The bar's track." },
    {
      name: "Meter.Indicator",
      part: "indicator",
      element: "div",
      description: "The fill: `--rind-meter-percent` and an inline size of that percent.",
    },
  ],
  props: {
    value: {
      type: "number",
      description: "Required: a meter is never indeterminate (a missing value renders `min`).",
    },
    min: { type: "number", default: "0", description: "The range's lower bound." },
    max: { type: "number", default: "100", description: "The range's upper bound." },
    low: { type: "number", description: "The low region's upper bound (HTML `<meter>`)." },
    high: { type: "number", description: "The high region's lower bound (HTML `<meter>`)." },
    optimum: {
      type: "number",
      description: "Where the best value lies; decides which region is `optimum`.",
    },
    orientation: {
      type: '"horizontal" | "vertical"',
      default: '"horizontal"',
      description: "Which size the Indicator fills. Never `aria-orientation`.",
    },
    formatOptions: {
      type: "Intl.NumberFormatOptions",
      default: '{ style: "percent" }',
      description: "Percent formats the fraction; any other style formats the value.",
    },
    locale: { type: "string", description: "Default: the provider's locale." },
    messages: {
      type: "{ valueText?: ({ value, percent, formatted, zone }) => string }",
      description: "Overrides the English default (also through the provider); say the zone.",
    },
    render: {
      type: "element | (props, state) => element",
      description: "Substitutes the rendered element.",
    },
  },
  dataAttributes: {
    root: {
      ...base("root"),
      "data-value": "The clamped value.",
      "data-min": "The range's lower bound.",
      "data-max": "The range's upper bound.",
    },
    label: base("label"),
    "value-text": base("value-text"),
    track: base("track"),
    indicator: base("indicator"),
  },
  keyboard: [],
  contract: {
    actions: {},
    queries: ["value", "valueText", "percent", "zone", "name"],
    traits: ["valued"],
  },
} as const satisfies ComponentMeta
