// Scroll Area's API facts for the generated docs (scripts/docs-gen.ts). Data only;
// checked against the code in scroll-area.meta.test.ts.

import type { ComponentMeta } from "../meta"

const base = (part: string) => ({
  "data-scope": '"scroll-area"',
  "data-part": `"${part}"`,
  "data-instance": "The instance id.",
})
const overflow = {
  "data-overflow-x": "The content overflows horizontally (after the first measure).",
  "data-overflow-y": "The content overflows vertically (after the first measure).",
}
const edges = {
  ...overflow,
  "data-overflow-x-start": "Content is hidden beyond the inline start (the right under RTL).",
  "data-overflow-x-end": "Content is hidden beyond the inline end.",
  "data-overflow-y-start": "Content is hidden above.",
  "data-overflow-y-end": "Content is hidden below.",
}

export const scrollAreaMeta = {
  scope: "scroll-area",
  name: "Scroll Area",
  stateless: false,
  parts: [
    {
      name: "ScrollArea.Root",
      part: "root",
      element: "div",
      description:
        "Holds the state; exposes `--rind-scroll-area-corner-width` / `-height`. No role.",
    },
    {
      name: "ScrollArea.Viewport",
      part: "viewport",
      element: "div",
      description:
        'The native scroll container. A tab stop only when it overflows and its content has nothing focusable; `role="region"` when you name it.',
    },
    {
      name: "ScrollArea.Content",
      part: "content",
      element: "div",
      description:
        "Your content: what is measured. Required, and the only element between the Viewport and your children.",
    },
    {
      name: "ScrollArea.Scrollbar",
      part: "scrollbar",
      element: "div",
      description:
        "`orientation` `vertical` (default) or `horizontal`; `aria-hidden`, never takes focus.",
    },
    {
      name: "ScrollArea.Thumb",
      part: "thumb",
      element: "div",
      description:
        "Dragged with a mouse, pen or finger; sized through `--rind-scroll-area-thumb-size`.",
    },
    {
      name: "ScrollArea.Corner",
      part: "corner",
      element: "div",
      description: "Fills the corner between two scrollbars; `aria-hidden`.",
    },
  ],
  props: {
    type: {
      type: '"hover" | "scroll" | "auto" | "always"',
      default: '"hover"',
      description:
        "Root: when scrollbars show. `hover`: pointer, focus or scroll; `scroll`: while scrolling; `auto`: whenever the axis overflows; `always`.",
    },
    hideDelay: {
      type: "number",
      default: "600",
      description: "Root: milliseconds the scrollbars stay after the last hover, focus or scroll.",
    },
    trackPress: {
      type: '"page" | "jump"',
      default: '"page"',
      description:
        "Root: a press on the track scrolls one page toward it, or jumps there and drags.",
    },
    "*.orientation": {
      type: '"vertical" | "horizontal"',
      default: '"vertical"',
      description: "Scrollbar: its axis.",
    },
    actionsRef: {
      type: "Ref<{ measure(): void }>",
      description:
        "Root: call `measure()` after a change the observers cannot see (a deep descendant resized).",
    },
    "*.render": {
      type: "RenderProp",
      description: "Substitutes the rendered element.",
    },
  },
  dataAttributes: {
    root: {
      ...base("root"),
      ...edges,
      "data-hovering": "A mouse or pen is over the area.",
      "data-scrolling": "A user scroll is in progress.",
    },
    viewport: {
      ...base("viewport"),
      ...edges,
      "data-tab-stop": "The tab-stop rule holds (overflowing, nothing focusable inside).",
      "data-focus": "The Viewport has focus.",
      "data-focus-visible": "The Viewport has keyboard focus.",
    },
    content: { ...base("content"), ...overflow },
    scrollbar: {
      ...base("scrollbar"),
      "data-orientation": '"vertical" or "horizontal".',
      "data-state": '"visible" or "hidden".',
      "data-scrolling": "Its axis is scrolling.",
      "data-dragging": "Its thumb is being dragged.",
      "data-hovering": "The pointer is over it.",
    },
    thumb: {
      ...base("thumb"),
      "data-orientation": '"vertical" or "horizontal".',
      "data-dragging": "It is being dragged.",
    },
    corner: {
      ...base("corner"),
      "data-state": '"visible" when both scrollbars are, else "hidden".',
    },
  },
  keyboard: [
    [
      "Arrow keys, PageUp/PageDown, Home/End, Space",
      "Native scrolling of the Viewport (when it or its content has focus).",
    ],
  ],
  states: {
    idle: "Nothing engages the area; `hover` and `scroll` scrollbars are hidden.",
    engaged: "Hovered, focused, scrolled or on a scrollbar.",
    lingering: "Recently engaged: scrollbars stay for `hideDelay`.",
    dragging: "A thumb is being dragged.",
  },
  contract: {
    actions: {
      focusViewport: ["keyboard", "pointer"],
      scroll: ["keyboard", "pointer"],
      dragThumb: ["pointer", "touch"],
      pressTrack: ["pointer", "keyboard"],
      hover: ["pointer"],
      unhover: ["pointer"],
    },
    queries: ["hasOverflow", "isScrollbarVisible", "atStart", "atEnd", "isDragging", "isTabStop"],
    traits: ["directional"],
  },
} as const satisfies ComponentMeta
