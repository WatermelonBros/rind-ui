// Carousel's API facts for the generated docs (scripts/docs-gen.ts). Data only; checked against
// the code in carousel.test.ts.

import type { ComponentMeta } from "../meta"

const base = (part: string) => ({
  "data-scope": '"carousel"',
  "data-part": `"${part}"`,
  "data-instance": "The instance id.",
  "data-orientation": '"horizontal" or "vertical".',
})
const focus = { "data-focus": "Focused.", "data-focus-visible": "Keyboard focus." }

export const carouselMeta = {
  scope: "carousel",
  name: "Carousel",
  stateless: false,
  parts: [
    {
      name: "Carousel.Root",
      part: "root",
      element: "section",
      description: "A named region (`aria-roledescription` carousel); pauses autoplay on hover.",
    },
    {
      name: "Carousel.Viewport",
      part: "viewport",
      element: "div",
      description: "The scroll-snap container; scrolling natively settles the page.",
    },
    {
      name: "Carousel.Slide",
      part: "slide",
      element: "div",
      description: 'A group named "2 of 6" (`index`); off the current page it is inert.',
    },
    {
      name: "Carousel.Control",
      part: "control",
      element: "div",
      description: "Lays out the triggers.",
    },
    {
      name: "Carousel.PrevTrigger",
      part: "prev-trigger",
      element: "button",
      description: "The previous page.",
    },
    {
      name: "Carousel.NextTrigger",
      part: "next-trigger",
      element: "button",
      description: "The next page.",
    },
    {
      name: "Carousel.IndicatorGroup",
      part: "indicator-group",
      element: "div",
      description: "A tablist of pages: one tab stop, arrows move and select.",
    },
    {
      name: "Carousel.Indicator",
      part: "indicator",
      element: "button",
      description: "One page (`index`).",
    },
    {
      name: "Carousel.AutoplayTrigger",
      part: "autoplay-trigger",
      element: "button",
      description: "Stops and starts autoplay; named by what it does.",
    },
    {
      name: "Carousel.Status",
      part: "status",
      element: "span",
      description: '"3 / 6" (hidden from assistive technology).',
    },
  ],
  props: {
    page: { type: "number", description: "Controlled page (0-based)." },
    defaultPage: { type: "number", default: "0", description: "Uncontrolled page." },
    onPageChange: {
      type: "(page, details) => void",
      description: "Every change; `details.event.reason` says how.",
    },
    slideCount: {
      type: "number",
      description: "Slides before they register (server-rendered indicators).",
    },
    slidesPerPage: { type: "number", default: "1", description: "Slides shown at once." },
    slidesPerMove: {
      type: '"page" | number',
      default: '"page"',
      description: "Slides a step moves.",
    },
    loop: {
      type: "boolean",
      default: "false",
      description: "Next on the last page goes to the first.",
    },
    orientation: {
      type: '"horizontal" | "vertical"',
      default: '"horizontal"',
      description: "The scroll axis.",
    },
    spacing: {
      type: "string",
      default: '"0px"',
      description: "The gap between slides (`--rind-carousel-spacing`).",
    },
    autoplay: {
      type: "boolean",
      default: "false",
      description: "Advance by itself; needs an AutoplayTrigger.",
    },
    autoplayDelay: { type: "number", default: "5000", description: "Ms per page." },
    pauseOnHover: {
      type: "boolean",
      default: "true",
      description: "Pause while the pointer is over it.",
    },
    onAutoplayChange: { type: "(playing, { reason }) => void", description: "Started or stopped." },
    messages: { type: "Partial<CarouselMessages>", description: "Overrides the strings." },
    render: {
      type: "RenderProp",
      description: "Substitutes the rendered element without changing behaviour.",
    },
  },
  dataAttributes: {
    root: { ...base("root"), "data-autoplay": '"off", "playing" or "paused".' },
    viewport: { ...base("viewport"), "data-scrolling": "While a scroll is in progress." },
    slide: {
      ...base("slide"),
      "data-index": "The slide's index.",
      "data-current": "On the current page.",
      "data-inview": "Visible in the Viewport.",
    },
    control: base("control"),
    "prev-trigger": {
      ...base("prev-trigger"),
      ...focus,
      "data-disabled": "On the first page without loop.",
    },
    "next-trigger": {
      ...base("next-trigger"),
      ...focus,
      "data-disabled": "On the last page without loop.",
    },
    "indicator-group": base("indicator-group"),
    indicator: {
      ...base("indicator"),
      ...focus,
      "data-index": "The page.",
      "data-current": "The current page.",
    },
    "autoplay-trigger": {
      ...base("autoplay-trigger"),
      ...focus,
      "data-autoplay": '"off", "playing" or "paused".',
    },
    status: base("status"),
  },
  keyboard: [
    ["Enter, Space", "On Prev, Next or the autoplay control: press it."],
    ["ArrowRight, ArrowLeft", "On an indicator: the next or previous page (wrapping)."],
    ["Home, End", "On an indicator: the first or last page."],
  ],
  states: {
    stopped: "Autoplay off.",
    playing: "Autoplay advancing.",
    paused: "Autoplay held by hover or a hidden page.",
  },
  contract: {
    actions: {
      next: ["pointer", "keyboard", "touch", "virtual"],
      prev: ["pointer", "keyboard", "touch", "virtual"],
      goTo: ["pointer", "keyboard", "touch", "virtual"],
      play: ["pointer", "keyboard", "touch", "virtual"],
      pause: ["pointer", "keyboard", "touch", "virtual"],
    },
    queries: ["page", "pageCount", "isPlaying", "statusText"],
    traits: [],
  },
} as const satisfies ComponentMeta
