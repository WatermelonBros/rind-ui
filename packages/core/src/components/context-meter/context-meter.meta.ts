// Context Meter's API facts for the generated docs (scripts/docs-gen.ts). Data only; checked
// against the code in context-meter.test.ts. (`.pending` until the React parts land.)

import type { ComponentMeta } from "../meta"

const base = (part: string) => ({
  "data-scope": '"context-meter"',
  "data-part": `"${part}"`,
  "data-instance": "The instance id.",
  "data-state": '"ok", "warning", "full", "over" or "unknown".',
})

export const contextMeterMeta = {
  scope: "context-meter",
  name: "Context Meter",
  stateless: false,
  parts: [
    {
      name: "ContextMeter.Root",
      part: "root",
      element: "div",
      description:
        '`role="meter"` with the usage in words ("21K of 128K tokens, 17%"); no meter role without a known size.',
    },
    { name: "ContextMeter.Label", part: "label", element: "span", description: "Names the meter." },
    {
      name: "ContextMeter.ValueText",
      part: "value-text",
      element: "span",
      description: 'The short visible value ("17%"); `aria-hidden` (the meter says it in full).',
    },
    { name: "ContextMeter.Track", part: "track", element: "div", description: "`aria-hidden`." },
    {
      name: "ContextMeter.Indicator",
      part: "indicator",
      element: "div",
      description: "`aria-hidden`; sized by `--rind-context-meter-percent`.",
    },
    {
      name: "ContextMeter.Breakdown",
      part: "breakdown",
      element: "dl",
      description: "Where the tokens went; put it in a Popover to open on press.",
    },
    {
      name: "ContextMeter.BreakdownItem",
      part: "breakdown-item",
      element: "div",
      description: "One `dt`/`dd` pair (`key`).",
    },
  ],
  props: {
    used: { type: "number", description: "Required. Tokens used." },
    max: {
      type: "number | null",
      description: "Required. The window size; null when unknown (text, no meter role).",
    },
    warnAt: { type: "number", default: "0.75", description: "The warning threshold (fraction)." },
    fullAt: { type: "number", default: "0.95", description: "The full threshold (fraction)." },
    announce: {
      type: '"off" | "polite"',
      default: '"polite"',
      description: "Announce a rising threshold crossing, once.",
    },
    resetKey: { type: "string", description: "A new value (a new thread) re-arms the thresholds." },
    onThreshold: {
      type: '(level: "warning" | "full" | "over") => void',
      description: "A rising crossing (compact the thread here).",
    },
    formatOptions: {
      type: "Intl.NumberFormatOptions",
      default: '{ notation: "compact" }',
      description: "How the numbers are written.",
    },
    messages: {
      type: "Partial<ContextMeterMessages>",
      description: "Overrides the strings (also through the provider).",
    },
    locale: { type: "string", description: "Default: the provider's locale." },
    render: {
      type: "RenderProp",
      description: "Substitutes the rendered element without changing behaviour.",
    },
  },
  dataAttributes: {
    root: {
      ...base("root"),
      "data-zone": '"ok", "warning" or "full" (over is full).',
      "data-percent": "0 to 100, one decimal.",
    },
    label: base("label"),
    "value-text": base("value-text"),
    track: base("track"),
    indicator: { ...base("indicator"), "data-zone": '"ok", "warning" or "full".' },
    breakdown: base("breakdown"),
    "breakdown-item": { ...base("breakdown-item"), "data-key": "The item's key." },
  },
  keyboard: [],
  states: { live: "The state follows the props; see data-state." },
  contract: { actions: {}, queries: ["state", "percent", "valueText"], traits: [] },
} as const satisfies ComponentMeta
