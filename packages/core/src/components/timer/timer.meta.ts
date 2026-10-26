// Timer's API facts for the generated docs (scripts/docs-gen.ts). Data only; checked against
// the code in timer.meta.test.ts.

import type { ComponentMeta } from "../meta"

const base = (part: string) => ({
  "data-scope": '"timer"',
  "data-part": `"${part}"`,
  "data-instance": "The instance id.",
  "data-state": '"idle", "running", "paused" or "completed".',
})
const typed = (part: string) => ({
  ...base(part),
  "data-type": '"days", "hours", "minutes", "seconds" or "milliseconds".',
})

export const timerMeta = {
  scope: "timer",
  name: "Timer",
  stateless: false,
  parts: [
    {
      name: "Timer.Root",
      part: "root",
      element: "div",
      description: "Holds the timer. Sets `--rind-timer-progress` (0–1 from start to target).",
    },
    {
      name: "Timer.Area",
      part: "area",
      element: "div",
      description:
        '`role="timer"`, named by the time in words ("1 minute, 5 seconds"); screen readers read it on demand, never every second.',
    },
    {
      name: "Timer.Control",
      part: "control",
      element: "div",
      description: "Groups the ActionTriggers.",
    },
    {
      name: "Timer.Item",
      part: "item",
      element: "div",
      description: "One unit (`type`): days, hours, minutes, seconds or milliseconds.",
    },
    {
      name: "Timer.ItemValue",
      part: "item-value",
      element: "span",
      description:
        "The unit's value in the locale's digits, at least two digits (`children` replace it).",
    },
    {
      name: "Timer.ItemLabel",
      part: "item-label",
      element: "span",
      description: 'A visible caption for the unit ("min").',
    },
    {
      name: "Timer.Separator",
      part: "separator",
      element: "span",
      description: '`aria-hidden`; renders `children` (":").',
    },
    {
      name: "Timer.ActionTrigger",
      part: "action-trigger",
      element: "button",
      description:
        "Runs `action`: start, pause, resume, reset, restart or toggle. An action that does nothing now is disabled but stays focusable: the focus never drops.",
    },
  ],
  props: {
    countdown: {
      type: "boolean",
      default: "false",
      description: "Count down from `startMs` to `targetMs` instead of up.",
    },
    startMs: { type: "number", default: "0", description: "Where the timer starts (ms)." },
    targetMs: {
      type: "number",
      description:
        "Where it completes (ms). A countdown defaults to 0; a stopwatch without it never completes.",
    },
    autoStart: { type: "boolean", default: "false", description: "Runs from mount." },
    interval: {
      type: "number",
      default: "1000",
      description: "The display step and tick period (ms).",
    },
    onTick: {
      type: "({ value, time }) => void",
      description: "Every tick while running (`value` in ms, `time` the displayed units).",
    },
    onComplete: { type: "() => void", description: "Once, when the target is reached." },
    onStateChange: {
      type: '(state: "idle" | "running" | "paused" | "completed") => void',
      description: "On each state change.",
    },
    messages: {
      type: "Partial<TimerMessages>",
      description: "Overrides the strings (also through the provider).",
    },
    locale: {
      type: "string",
      description: "Default: the provider's locale (digits and the spoken duration).",
    },
    render: {
      type: "RenderProp",
      description: "Substitutes the rendered element without changing behaviour.",
    },
  },
  dataAttributes: {
    root: { ...base("root"), "data-countdown": "When counting down." },
    area: base("area"),
    control: base("control"),
    item: typed("item"),
    "item-value": typed("item-value"),
    "item-label": typed("item-label"),
    separator: base("separator"),
    "action-trigger": {
      ...base("action-trigger"),
      "data-action": "The trigger's action.",
      "data-disabled": "The action does nothing in the current state.",
      "data-focus": "Focused.",
      "data-focus-visible": "Keyboard focus.",
    },
  },
  keyboard: [["Enter, Space", "On an ActionTrigger: runs its action."]],
  states: {
    idle: "Not started, or reset: the value is the start.",
    running: "Counting; ticks every `interval`.",
    paused: "Stopped, keeping its time.",
    completed: 'The target was reached; "Time\'s up" was announced.',
  },
  contract: {
    actions: {
      start: ["pointer", "keyboard", "touch", "virtual"],
      pause: ["pointer", "keyboard", "touch", "virtual"],
      resume: ["pointer", "keyboard", "touch", "virtual"],
      reset: ["pointer", "keyboard", "touch", "virtual"],
      restart: ["pointer", "keyboard", "touch", "virtual"],
      toggle: ["pointer", "keyboard", "touch", "virtual"],
    },
    queries: ["state", "label", "text"],
    traits: [],
  },
} as const satisfies ComponentMeta
