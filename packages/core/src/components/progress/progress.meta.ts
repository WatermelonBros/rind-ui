// Progress's API facts for the generated docs (scripts/docs-gen.ts). Data only;
// checked against the code in progress.meta.test.ts.

import type { ComponentMeta } from "../meta"

const base = (part: string) => ({
  "data-scope": '"progress"',
  "data-part": `"${part}"`,
  "data-instance": "The instance id.",
  "data-state": '"indeterminate", "loading" or "complete".',
  "data-orientation": '"horizontal" or "vertical".',
})

export const progressMeta = {
  scope: "progress",
  name: "Progress",
  stateless: false,
  parts: [
    {
      name: "Progress.Root",
      part: "root",
      element: "div",
      description:
        '`role="progressbar"` with the value attributes, named by the Label; ends with a visually hidden filler span (NVDA, quirk `nvda-progressbar-name`).',
    },
    { name: "Progress.Label", part: "label", element: "span", description: "The name." },
    {
      name: "Progress.ValueText",
      part: "value-text",
      element: "span",
      description:
        '`aria-hidden="true"`; its default content is the value text (the same string as `aria-valuetext`). Empty when indeterminate.',
    },
    { name: "Progress.Track", part: "track", element: "div", description: "The bar's track." },
    {
      name: "Progress.Indicator",
      part: "indicator",
      element: "div",
      description:
        "The fill: `--rind-progress-percent` and an inline size of that percent; neither when indeterminate.",
    },
    {
      name: "Progress.Circle",
      part: "circle",
      element: "svg",
      description: 'The ring: `aria-hidden="true"`, `viewBox="0 0 100 100"`.',
    },
    {
      name: "Progress.CircleTrack",
      part: "circle-track",
      element: "circle",
      description: 'The ring\'s track, `pathLength="100"`.',
    },
    {
      name: "Progress.CircleIndicator",
      part: "circle-indicator",
      element: "circle",
      description: '`stroke-dasharray="100"` and `stroke-dashoffset` = 100 − percent.',
    },
  ],
  props: {
    value: {
      type: "number | null",
      default: "null",
      description: "`null` or `undefined`: indeterminate. 0 is a value. Clamped to the range.",
    },
    min: { type: "number", default: "0", description: "The range's lower bound." },
    max: { type: "number", default: "100", description: "The range's upper bound." },
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
    announceCompletion: {
      type: "boolean",
      default: "false",
      description:
        "Announce `messages.complete` politely when the value reaches `max` from below or from indeterminate. Never on mount.",
    },
    messages: {
      type: "{ valueText?: (args) => string; complete?: string }",
      description: "Overrides the English defaults (also through the provider).",
    },
    "*.render": {
      type: "RenderProp",
      description: "Substitutes the rendered element.",
    },
  },
  dataAttributes: {
    root: {
      ...base("root"),
      "data-value": "The clamped value, when determinate.",
      "data-min": "The range's lower bound.",
      "data-max": "The range's upper bound.",
    },
    label: base("label"),
    "value-text": base("value-text"),
    track: base("track"),
    indicator: base("indicator"),
    circle: base("circle"),
    "circle-track": base("circle-track"),
    "circle-indicator": base("circle-indicator"),
  },
  keyboard: [],
  states: {
    indeterminate: "No value: no `aria-valuenow`, no fill size, an animated segment in the theme.",
    loading: "A value below `max`.",
    complete: "The value equals `max`.",
  },
  contract: {
    actions: {},
    queries: ["value", "valueText", "percent", "state", "name"],
    traits: ["valued"],
  },
} as const satisfies ComponentMeta
