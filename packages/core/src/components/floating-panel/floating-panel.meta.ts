// Floating Panel's API facts for the generated docs (scripts/docs-gen.ts). Data only; checked
// against the code in floating-panel.test.ts.

import type { ComponentMeta } from "../meta"

const base = (part: string) => ({
  "data-scope": '"floating-panel"',
  "data-part": `"${part}"`,
  "data-instance": "The instance id.",
  "data-state": '"open" or "closed".',
  "data-stage": '"default", "minimized" or "maximized".',
  "data-dragging": "While moved by a pointer.",
  "data-resizing": "While resized by a pointer.",
  "data-disabled": "While disabled.",
})
const focus = { "data-focus": "Focused.", "data-focus-visible": "Keyboard focus." }

export const floatingPanelMeta = {
  scope: "floating-panel",
  name: "Floating Panel",
  stateless: false,
  parts: [
    {
      name: "FloatingPanel.Root",
      part: "root",
      element: "div",
      description: "Holds the open state and the rect.",
    },
    {
      name: "FloatingPanel.Trigger",
      part: "trigger",
      element: "button",
      description: "Opens and closes the panel.",
    },
    {
      name: "FloatingPanel.Positioner",
      part: "positioner",
      element: "div",
      description: "Placed by `--rind-floating-panel-x/-y/-width/-height`.",
    },
    {
      name: "FloatingPanel.Content",
      part: "content",
      element: "div",
      description: "The non-modal dialog, named by the Title.",
    },
    { name: "FloatingPanel.Header", part: "header", element: "div", description: "The title bar." },
    {
      name: "FloatingPanel.DragTrigger",
      part: "drag-trigger",
      element: "button",
      description: "Drag to move; arrows move, Alt+arrows resize, Enter maximises.",
    },
    { name: "FloatingPanel.Title", part: "title", element: "h2", description: "Names the panel." },
    {
      name: "FloatingPanel.Description",
      part: "description",
      element: "p",
      description: "Describes the panel.",
    },
    {
      name: "FloatingPanel.Control",
      part: "control",
      element: "div",
      description: "Groups the stage and close triggers.",
    },
    {
      name: "FloatingPanel.StageTrigger",
      part: "stage-trigger",
      element: "button",
      description: "`stage` minimized or maximized; from there it restores.",
    },
    {
      name: "FloatingPanel.CloseTrigger",
      part: "close-trigger",
      element: "button",
      description: "Closes the panel.",
    },
    {
      name: "FloatingPanel.Body",
      part: "body",
      element: "div",
      description: "The content; inert while minimised.",
    },
    {
      name: "FloatingPanel.ResizeTrigger",
      part: "resize-trigger",
      element: "div",
      description:
        "A pointer handle on an edge or corner (`axis`); hidden from assistive technology.",
    },
  ],
  props: {
    open: { type: "boolean", description: "Controlled open state." },
    defaultOpen: { type: "boolean", default: "false", description: "Uncontrolled open state." },
    onOpenChange: {
      type: "(open, details) => void",
      description: "Opened or closed, with the reason.",
    },
    position: { type: "{ x, y }", description: "Controlled position in the boundary." },
    defaultPosition: {
      type: "{ x, y }",
      default: "{ x: 0, y: 0 }",
      description: "Uncontrolled position.",
    },
    onPositionChange: {
      type: "(position, details) => void",
      description: "Once per drag, per key step.",
    },
    size: { type: "{ width, height }", description: "Controlled size." },
    defaultSize: {
      type: "{ width, height }",
      default: "{ width: 360, height: 240 }",
      description: "Uncontrolled size.",
    },
    onSizeChange: {
      type: "(size, details) => void",
      description: "Once per resize, per key step.",
    },
    stage: { type: '"default" | "minimized" | "maximized"', description: "Controlled stage." },
    defaultStage: {
      type: '"default" | "minimized" | "maximized"',
      default: '"default"',
      description: "Uncontrolled stage.",
    },
    onStageChange: {
      type: "(stage, details) => void",
      description: "Minimised, maximised or restored.",
    },
    minSize: {
      type: "{ width, height }",
      default: "{ width: 200, height: 120 }",
      description: "The smallest size.",
    },
    maxSize: {
      type: "{ width, height }",
      description: "The largest size (default: the boundary).",
    },
    minVisible: {
      type: "number",
      default: "48",
      description: "Pixels kept inside the boundary on each axis.",
    },
    step: { type: "number", default: "10", description: "Pixels per arrow key." },
    largeStep: { type: "number", default: "50", description: "Pixels per Shift+arrow." },
    draggable: { type: "boolean", default: "true", description: "Can be moved." },
    resizable: { type: "boolean", default: "true", description: "Can be resized." },
    disabled: {
      type: "boolean",
      default: "false",
      description: "No move, resize or stage change.",
    },
    messages: { type: "Partial<FloatingPanelMessages>", description: "Overrides the strings." },
    render: {
      type: "RenderProp",
      description: "Substitutes the rendered element without changing behaviour.",
    },
  },
  dataAttributes: {
    root: base("root"),
    trigger: { ...base("trigger"), ...focus },
    positioner: base("positioner"),
    content: base("content"),
    header: base("header"),
    "drag-trigger": { ...base("drag-trigger"), ...focus },
    title: base("title"),
    description: base("description"),
    control: base("control"),
    "stage-trigger": {
      ...base("stage-trigger"),
      ...focus,
      "data-stage-target": "The stage a press switches to.",
    },
    "close-trigger": { ...base("close-trigger"), ...focus },
    body: base("body"),
    "resize-trigger": {
      ...base("resize-trigger"),
      "data-axis": '"n", "s", "e", "w", "ne", "nw", "se" or "sw".',
    },
  },
  keyboard: [
    ["Arrow keys", "On the DragTrigger: move by `step` (Shift: `largeStep`)."],
    ["Alt+Arrow keys", "On the DragTrigger: resize from the bottom-right corner."],
    ["Enter, Space", "On the DragTrigger: maximise or restore."],
    ["Escape", "During a drag: cancel it. Otherwise: close (focus inside)."],
  ],
  states: { idle: "At rest.", moving: "A pointer moves it.", resizing: "A pointer resizes it." },
  contract: {
    actions: {
      open: ["pointer", "keyboard", "touch", "virtual"],
      close: ["pointer", "keyboard", "touch", "virtual"],
      moveBy: ["keyboard", "virtual"],
      resizeBy: ["keyboard", "virtual"],
      minimize: ["pointer", "touch", "virtual"],
      maximize: ["pointer", "keyboard", "touch", "virtual"],
      restore: ["pointer", "touch", "virtual"],
    },
    queries: ["isOpen", "position", "size", "stage", "isDragging"],
    traits: [],
  },
} as const satisfies ComponentMeta
