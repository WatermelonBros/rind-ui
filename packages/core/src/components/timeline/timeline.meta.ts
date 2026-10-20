// Timeline's API facts for the generated docs (scripts/docs-gen.ts). Data only; checked
// against the code in timeline.test.ts.

import type { ComponentMeta } from "../meta"

const base = (part: string) => ({
  "data-scope": '"timeline"',
  "data-part": `"${part}"`,
  "data-instance": "The instance id.",
})
const status = (part: string) => ({
  ...base(part),
  "data-status": '"completed", "current", "pending" or "upcoming" (absent on a plain log).',
})

export const timelineMeta = {
  scope: "timeline",
  name: "Timeline",
  stateless: true,
  parts: [
    {
      name: "Timeline.Root",
      part: "root",
      element: "ol",
      description: "The ordered list of events.",
    },
    {
      name: "Timeline.Item",
      part: "item",
      element: "li",
      description: 'One event; takes `status`; `aria-current="step"` when current.',
    },
    {
      name: "Timeline.Indicator",
      part: "indicator",
      element: "div",
      description: "`aria-hidden` dot or icon.",
    },
    {
      name: "Timeline.Connector",
      part: "connector",
      element: "div",
      description: "`aria-hidden` line to the next event; `data-last` on the last.",
    },
    { name: "Timeline.Content", part: "content", element: "div", description: "The event's text." },
    {
      name: "Timeline.Title",
      part: "title",
      element: "div",
      description:
        'The event\'s title; ends with its status on a progress timeline ("Shipped (completed)").',
    },
    {
      name: "Timeline.Description",
      part: "description",
      element: "div",
      description: "More about the event.",
    },
    {
      name: "Timeline.Time",
      part: "time",
      element: "time",
      description:
        "`<time datetime>` from a `Date` or string; the date for the locale without children.",
    },
    {
      name: "Timeline.Opposite",
      part: "opposite",
      element: "div",
      description: "Content on the other side of the rail (a date column).",
    },
  ],
  props: {
    current: {
      type: "number",
      description: "The current event's index: earlier events are completed, later upcoming.",
    },
    "Item.index": { type: "number", description: "The event's index (0-based)." },
    "Item.status": {
      type: '"completed" | "current" | "pending" | "upcoming"',
      description: "Its own status; wins over `current`.",
    },
    orientation: {
      type: '"vertical" | "horizontal"',
      default: '"vertical"',
      description: "The layout.",
    },
    align: {
      type: '"start" | "end" | "alternate"',
      default: '"start"',
      description: "Which side of the rail the content sits on; alternate switches per item.",
    },
    "Time.dateTime": { type: "Date | string", description: "The machine-readable date." },
    messages: { type: "Partial<TimelineMessages>", description: "Overrides the status words." },
    locale: { type: "string", description: "Default: the provider's locale (Time's format)." },
    render: {
      type: "element | (props, state) => element",
      description: "Substitutes the rendered element without changing behaviour.",
    },
  },
  dataAttributes: {
    root: {
      ...base("root"),
      "data-orientation": '"vertical" or "horizontal".',
      "data-align": '"start", "end" or "alternate".',
    },
    item: {
      ...status("item"),
      "data-index": "The item's index.",
      "data-side": '"start" or "end".',
    },
    indicator: status("indicator"),
    connector: { ...status("connector"), "data-last": "On the last item." },
    content: status("content"),
    title: status("title"),
    description: status("description"),
    time: base("time"),
    opposite: status("opposite"),
  },
  keyboard: [],
  contract: { actions: {}, queries: ["count", "current", "status", "titles"], traits: [] },
} as const satisfies ComponentMeta
