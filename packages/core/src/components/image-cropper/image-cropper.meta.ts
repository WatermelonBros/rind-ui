// Image Cropper's API facts for the generated docs (scripts/docs-gen.ts). Data only; checked
// against the code in image-cropper.connect.test.ts.

import type { ComponentMeta } from "../meta"

const base = (part: string) => ({
  "data-scope": '"image-cropper"',
  "data-part": `"${part}"`,
  "data-instance": "The instance id.",
})
const active = {
  "data-state": '"loading", "idle", "dragging" or "settling".',
  "data-shape": '"rectangle" or "circle".',
  "data-dragging": "While the crop is dragged or resized.",
  "data-panning": "While the image is panned.",
}

export const imageCropperMeta = {
  scope: "image-cropper",
  name: "ImageCropper",
  stateless: false,
  parts: [
    {
      name: "ImageCropper.Root",
      part: "root",
      element: "div",
      description:
        "A named group (never live); the crop and image transform as CSS variables. Renders the visually hidden instructions.",
    },
    {
      name: "ImageCropper.Viewport",
      part: "viewport",
      element: "div",
      description: "The stage: clips, takes pans, wheel and pinch.",
    },
    {
      name: "ImageCropper.Image",
      part: "image",
      element: "img",
      description: "`aria-hidden`; placed by the same matrix the output uses.",
    },
    {
      name: "ImageCropper.Selection",
      part: "selection",
      element: "div",
      description:
        'The one tab stop: `role="slider"`, "crop area", its value the crop in natural pixels. Arrows move, Alt+arrows resize, + / − zoom.',
    },
    {
      name: "ImageCropper.Handle",
      part: "handle",
      element: "div",
      description: "`aria-hidden` resize handle; `position` n, s, e, w, ne, nw, se, sw.",
    },
    {
      name: "ImageCropper.Grid",
      part: "grid",
      element: "div",
      description: "`aria-hidden` thirds grid; `axis` horizontal or vertical.",
    },
  ],
  props: {
    crop: { type: "Rect", description: "Controlled crop, viewport px." },
    defaultCrop: {
      type: "Rect",
      description: "Uncontrolled initial crop (default: 80 % of the image, centred).",
    },
    onCropChange: {
      type: "(crop, details) => void",
      description: "`details.data`: the crop in natural pixels (`rect`, `corners`).",
    },
    zoom: { type: "number", description: "Controlled zoom." },
    defaultZoom: { type: "number", default: "1", description: "Uncontrolled initial zoom." },
    onZoomChange: { type: "(zoom, details) => void", description: "Zoom changes." },
    minZoom: { type: "number", default: "1", description: "Smallest zoom." },
    maxZoom: { type: "number", default: "5", description: "Largest zoom." },
    zoomStep: { type: "number", default: "0.1", description: "Per wheel notch and per + / −." },
    zoomSensitivity: { type: "number", default: "2", description: "Pinch responsiveness." },
    rotation: { type: "number", description: "Controlled rotation, degrees (any angle)." },
    defaultRotation: {
      type: "number",
      default: "0",
      description: "Uncontrolled initial rotation.",
    },
    onRotationChange: { type: "(rotation, details) => void", description: "Rotation changes." },
    flip: { type: "{ horizontal, vertical }", description: "Controlled flip." },
    defaultFlip: { type: "{ horizontal, vertical }", description: "Uncontrolled initial flip." },
    onFlipChange: { type: "(flip, details) => void", description: "Flip changes." },
    aspectRatio: { type: "number", description: "Width / height; free when omitted." },
    cropShape: {
      type: '"rectangle" | "circle"',
      default: '"rectangle"',
      description: "A circle implies aspect 1.",
    },
    minWidth: { type: "number", default: "40", description: "Viewport px." },
    minHeight: { type: "number", default: "40", description: "Viewport px." },
    maxWidth: { type: "number", default: "Infinity", description: "Viewport px." },
    maxHeight: { type: "number", default: "Infinity", description: "Viewport px." },
    fixedCropArea: {
      type: "boolean",
      default: "false",
      description: "The crop stays; drags and arrows pan the image.",
    },
    nudgeStep: { type: "number", default: "1", description: "Arrow step, px." },
    nudgeStepShift: { type: "number", default: "10", description: "Shift+arrow step, px." },
    nudgeStepCtrl: { type: "number", default: "50", description: "Ctrl/Cmd+arrow step, px." },
    messages: {
      type: "Partial<ImageCropperMessages>",
      description: "Overrides the names and value text.",
    },
    locale: { type: "string", description: "Default: the provider's locale." },
    render: {
      type: "element | (props, state) => element",
      description: "Substitutes the rendered element without changing behaviour.",
    },
  },
  dataAttributes: {
    root: { ...base("root"), ...active, "data-fixed": "With `fixedCropArea`." },
    viewport: { ...base("viewport"), ...active },
    image: {
      ...base("image"),
      "data-ready": "Once the image has loaded.",
      "data-flip-horizontal": "While flipped horizontally.",
      "data-flip-vertical": "While flipped vertically.",
    },
    selection: {
      ...base("selection"),
      ...active,
      "data-x": "Crop x, natural px.",
      "data-y": "Crop y, natural px.",
      "data-width": "Crop width, natural px.",
      "data-height": "Crop height, natural px.",
      "data-covered": "The image covers the crop (always, once loaded).",
      "data-focus": "Focused.",
      "data-focus-visible": "Keyboard focus.",
    },
    handle: {
      ...base("handle"),
      "data-position": "n, s, e, w, ne, nw, se or sw.",
      "data-disabled": "With `fixedCropArea`.",
    },
    grid: { ...base("grid"), "data-axis": '"horizontal" or "vertical".' },
  },
  keyboard: [
    ["Arrows", "Move the crop (pan with a fixed crop area). Shift: further; Ctrl / ⌘: furthest."],
    ["Alt + Arrows", "Resize the right or bottom edge."],
    ["+ / −", "Zoom in or out around the crop's centre."],
  ],
  states: {
    loading: "Until the image has loaded and the viewport is measured.",
    idle: "Ready.",
    dragging: "A pointer moves or resizes the crop, or pans the image.",
    settling: "A keyboard change is waiting 500 ms to be announced.",
  },
  contract: {
    actions: {
      settleLayout: ["pointer", "keyboard", "virtual"],
      nudge: ["keyboard"],
      resize: ["keyboard"],
      zoomIn: ["keyboard"],
      zoomOut: ["keyboard"],
      dragSelection: ["pointer", "virtual"],
      dragHandle: ["pointer", "virtual"],
    },
    queries: ["crop", "zoom", "valueText", "covered"],
    traits: [],
  },
} as const satisfies ComponentMeta
