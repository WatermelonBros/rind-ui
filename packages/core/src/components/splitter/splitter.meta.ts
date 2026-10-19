// The Splitter's API facts for the generated docs (scripts/docs-gen.ts). Data only; checked
// against the code in splitter.meta.test.ts.

import type { ComponentMeta } from "../meta"

const base = (part: string) => ({
  "data-scope": '"splitter"',
  "data-part": `"${part}"`,
  "data-instance": "The instance id.",
  "data-orientation": '"horizontal" or "vertical": the panel axis.',
  "data-disabled": "While the Splitter (or, on a handle, that handle) is disabled.",
  "data-dragging": "While a handle is dragged (on a handle: while it is the one dragged).",
})

export const splitterMeta = {
  scope: "splitter",
  name: "Splitter",
  stateless: false,
  parts: [
    {
      name: "Splitter.Root",
      part: "root",
      element: "div",
      description: "The flex container of the panels and handles; owns the sizes.",
    },
    {
      name: "Splitter.Panel",
      part: "panel",
      element: "div",
      description:
        "Panel `index`: `flex-grow` equal to its size on a zero basis, so the server renders the final layout.",
    },
    {
      name: "Splitter.Handle",
      part: "handle",
      element: "div",
      description:
        "The boundary after panel `index`: a focusable `separator` whose value is that panel's size. Name it with `aria-label` or `aria-labelledby`.",
    },
  ],
  props: {
    panels: {
      type: "SplitterPanel[]",
      description:
        'One entry per panel: `min`, `max`, `collapsedSize` (a number is a percent, `"200px"` is pixels) and `collapsible`.',
    },
    sizes: { type: "number[]", description: "Controlled sizes, in percent, summing to 100." },
    defaultSizes: {
      type: "number[]",
      description: "Uncontrolled initial sizes (default an equal split).",
    },
    onSizesChange: {
      type: "(sizes, { reason, event, cancel }) => void",
      description:
        "Every change, on every pointer move. Not called when the parent changes `sizes`.",
    },
    onSizesCommit: {
      type: "(sizes, { reason }) => void",
      description:
        "Once at the end of each interaction that changed the sizes (release, key): the hook for saving a layout.",
    },
    orientation: {
      type: '"horizontal" | "vertical"',
      default: '"horizontal"',
      description: "`horizontal` lays panels side by side, `vertical` stacks them.",
    },
    step: { type: "number", default: "5", description: "Percent per arrow key." },
    disabled: {
      type: "boolean",
      default: "false",
      description: "No handle moves or is focusable.",
    },
    dir: { type: '"ltr" | "rtl"', description: "Reading direction (default the provider's)." },
  },
  dataAttributes: {
    root: base("root"),
    panel: {
      ...base("panel"),
      "data-index": "The panel's index.",
      "data-size": "Its size in percent.",
      "data-state": '"collapsed" or "expanded", on collapsible panels only.',
    },
    handle: {
      ...base("handle"),
      "data-index": "The index of the panel before it (its primary panel).",
      "data-focus": "Focused.",
      "data-focus-visible": "Keyboard focus.",
    },
  },
  keyboard: [
    [
      "ArrowLeft, ArrowRight",
      "Horizontal Splitter: moves the boundary by `step` (mirrored in RTL).",
    ],
    ["ArrowUp, ArrowDown", "Vertical Splitter: moves the boundary by `step`."],
    ["Home", "Gives the primary panel its smallest reachable size (may collapse it)."],
    ["End", "Gives the primary panel its largest reachable size."],
    ["Enter", "Collapses a collapsible primary panel, or restores its size before it collapsed."],
    ["Escape", "During a drag: restores the sizes at the press."],
  ],
  states: {
    idle: "No drag; keys resize.",
    dragging: "A handle is dragged; `data-dragging` on the Root, the panels and that handle.",
  },
  contract: {
    actions: {
      focusHandle: ["keyboard"],
      step: ["keyboard"],
      toEdge: ["keyboard"],
      toggleCollapse: ["keyboard"],
      setSize: ["pointer", "keyboard", "touch", "virtual"],
      pointerDown: ["pointer", "touch", "virtual"],
      pointerMove: ["pointer", "touch", "virtual"],
      pointerUp: ["pointer", "touch", "virtual"],
      cancelDrag: ["pointer", "keyboard", "touch", "virtual"],
    },
    queries: ["sizes", "isDragging", "orientation", "isCollapsed", "bounds"],
    traits: ["valued", "directional"],
  },
} as const satisfies ComponentMeta
