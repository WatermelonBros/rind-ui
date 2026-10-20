// Image Viewer's API facts for the generated docs (scripts/docs-gen.ts). Data only; checked
// against the code in image-viewer.connect.test.ts.

import type { ComponentMeta } from "../meta"

const base = (part: string) => ({
  "data-scope": '"image-viewer"',
  "data-part": `"${part}"`,
  "data-instance": "The instance id.",
})
const shared = {
  "data-state": '"loading", "idle", "panning" or "settling".',
  "data-zoomed": "Zoomed past fit.",
  "data-panning": "While dragging.",
  "data-zoom": 'The zoom ("1", "2.5").',
}
const button = (part: string) => ({ ...base(part), "data-disabled": "At the limit." })

export const imageViewerMeta = {
  scope: "image-viewer",
  name: "Image Viewer",
  stateless: false,
  parts: [
    {
      name: "ImageViewer.Root",
      part: "root",
      element: "div",
      description: "Holds the viewer; sets `--rind-image-zoom` and the offsets.",
    },
    {
      name: "ImageViewer.Viewport",
      part: "viewport",
      element: "div",
      description:
        'A focusable `role="group"` ("image viewer"), named by the image\'s alt; keys, drag, wheel and pinch.',
    },
    {
      name: "ImageViewer.Image",
      part: "image",
      element: "img",
      description: "The image, placed by the zoom and pan; its alt names the viewport.",
    },
    {
      name: "ImageViewer.ZoomIn",
      part: "zoom-in",
      element: "button",
      description: "Disabled at `maxZoom`.",
    },
    {
      name: "ImageViewer.ZoomOut",
      part: "zoom-out",
      element: "button",
      description: "Disabled at fit.",
    },
    {
      name: "ImageViewer.Reset",
      part: "reset",
      element: "button",
      description: "Back to fit; disabled there.",
    },
    {
      name: "ImageViewer.ZoomText",
      part: "zoom-text",
      element: "span",
      description: '"200%" for sighted users (`aria-hidden`: the change is announced).',
    },
  ],
  props: {
    zoom: { type: "number", description: "Controlled zoom (1 = the image fitted)." },
    defaultZoom: {
      type: "number",
      default: "1",
      description: "Uncontrolled initial zoom; Reset's target.",
    },
    onZoomChange: { type: "(zoom, details) => void", description: "Every zoom change." },
    minZoom: { type: "number", default: "1", description: "The smallest zoom." },
    maxZoom: { type: "number", default: "4", description: "The largest zoom." },
    step: { type: "number", default: "0.5", description: "+ / − and the buttons." },
    doubleClickZoom: {
      type: "number",
      default: "2",
      description: "A double click toggles fit and this.",
    },
    wheel: {
      type: '"page" | "zoom"',
      default: '"page"',
      description: "A plain wheel scrolls the page (ctrl-wheel and pinch always zoom), or zooms.",
    },
    messages: {
      type: "Partial<ImageViewerMessages>",
      description: "Overrides the role description, instructions, button names and zoom text.",
    },
    locale: { type: "string", description: "Default: the provider's locale." },
    render: {
      type: "element | (props, state) => element",
      description: "Substitutes the rendered element without changing behaviour.",
    },
  },
  dataAttributes: {
    root: { ...base("root"), ...shared },
    viewport: {
      ...base("viewport"),
      ...shared,
      "data-focus": "Focused.",
      "data-focus-visible": "Keyboard focus.",
    },
    image: base("image"),
    "zoom-in": button("zoom-in"),
    "zoom-out": button("zoom-out"),
    reset: button("reset"),
    "zoom-text": base("zoom-text"),
  },
  keyboard: [
    ["+, =", "Zoom in about the centre."],
    ["−", "Zoom out."],
    ["0", "Reset to fit."],
    ["Arrows", "Move the image by 10% of the view (Shift: 50%), when zoomed."],
  ],
  states: {
    loading: "Until the image and the viewport have a size.",
    idle: "Ready.",
    panning: "While dragging the image.",
    settling: "After a key or button change, until the zoom is announced.",
  },
  contract: {
    actions: {
      settleLayout: ["pointer", "keyboard", "virtual"],
      zoomIn: ["pointer", "keyboard", "virtual"],
      zoomOut: ["pointer", "keyboard", "virtual"],
      reset: ["pointer", "keyboard", "virtual"],
      pan: ["pointer", "keyboard", "virtual"],
    },
    queries: ["zoom", "offset", "canZoomIn", "canZoomOut"],
    traits: [],
  },
} as const satisfies ComponentMeta
