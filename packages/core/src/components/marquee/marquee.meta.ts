// Marquee's API facts for the generated docs (scripts/docs-gen.ts). Data only; checked against
// the code in marquee.connect.test.ts.

import type { ComponentMeta } from "../meta"

const base = (part: string) => ({
  "data-scope": '"marquee"',
  "data-part": `"${part}"`,
  "data-instance": "The instance id.",
  "data-state": '"idle", "running", "paused" or "static".',
  "data-orientation": '"horizontal" or "vertical".',
  "data-reverse": "While `reverse`.",
})

export const marqueeMeta = {
  scope: "marquee",
  name: "Marquee",
  stateless: false,
  parts: [
    {
      name: "Marquee.Root",
      part: "root",
      element: "div",
      description:
        "Holds the state; no role of its own (`role`, `aria-label`, `aria-labelledby` pass through).",
    },
    {
      name: "Marquee.PauseTrigger",
      part: "pause-trigger",
      element: "button",
      description:
        'Toggles the user pause; named "Pause animation" or "Play animation" (no `aria-pressed`); hidden under reduced motion.',
    },
    {
      name: "Marquee.Viewport",
      part: "viewport",
      element: "div",
      description:
        "Clips the band (`overflow: clip`); pauses on hover and on keyboard focus; carries `--rind-marquee-duration`.",
    },
    {
      name: "Marquee.Content",
      part: "content",
      element: "div",
      description:
        "Rendered once as the original, then as `aria-hidden` copies with no tab stop (still clickable).",
    },
  ],
  props: {
    paused: { type: "boolean", description: "Controlled user pause." },
    defaultPaused: {
      type: "boolean",
      default: "false",
      description: "Uncontrolled initial pause.",
    },
    onPausedChange: {
      type: "(paused, details) => void",
      description: '`details.reason`: "trigger" or "focus".',
    },
    pauseOnHover: {
      type: "boolean",
      default: "true",
      description: "A mouse or pen over the Viewport pauses until it leaves (never touch).",
    },
    speed: {
      type: "number",
      default: "50",
      description: "CSS px per second; below 1 counts as 1.",
    },
    orientation: {
      type: '"horizontal" | "vertical"',
      default: '"horizontal"',
      description: "The axis.",
    },
    reverse: {
      type: "boolean",
      default: "false",
      description: "Moves toward the inline end (or down).",
    },
    autoFill: {
      type: "boolean",
      default: "false",
      description: "Enough copies to fill the Viewport (at most 32), so short content has no gap.",
    },
    messages: { type: "Partial<MarqueeMessages>", description: "Overrides the trigger names." },
    render: {
      type: "element | (props, state) => element",
      description: "Substitutes the rendered element without changing behaviour.",
    },
  },
  dataAttributes: {
    root: base("root"),
    "pause-trigger": {
      ...base("pause-trigger"),
      "data-paused": "While the user pause holds.",
      "data-focus": "Focused.",
      "data-focus-visible": "Keyboard focus.",
    },
    viewport: base("viewport"),
    content: {
      ...base("content"),
      "data-index": "0 for the original, then the copies.",
      "data-copy": "On copies only.",
    },
  },
  keyboard: [
    ["Enter, Space", "On the PauseTrigger: pauses or plays."],
    ["Tab", "Into the band: pauses it (only the user plays it again)."],
  ],
  states: {
    idle: "Not measured yet (server render, hidden, zero size): no motion.",
    running: "Moving.",
    paused: "Held by the user pause or a hovering pointer, at its position.",
    static: "Reduced motion: one copy, wrapped, no motion, no trigger.",
  },
  contract: {
    actions: {
      measure: ["pointer", "keyboard", "virtual"],
      togglePause: ["pointer", "keyboard", "virtual"],
      hover: ["pointer", "virtual"],
      leave: ["pointer", "virtual"],
      focusContent: ["keyboard"],
    },
    queries: ["state", "isPaused", "triggerLabel", "copies", "duration"],
    traits: ["directional"],
  },
} as const satisfies ComponentMeta
