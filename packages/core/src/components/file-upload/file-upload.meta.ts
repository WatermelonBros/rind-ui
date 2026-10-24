// File Upload's API facts for the generated docs (scripts/docs-gen.ts). Data only; checked
// against the code in file-upload.meta.test.ts.

import type { ComponentMeta } from "../meta"

const base = (part: string) => ({
  "data-scope": '"file-upload"',
  "data-part": `"${part}"`,
  "data-instance": "The instance id.",
  "data-disabled": "While disabled (own, Field or fieldset).",
  "data-readonly": "While read-only.",
  "data-required": "While required.",
  "data-invalid": "While the Field or `invalid` says so (never for rejections).",
  "data-dragging": "While a file drag is over the Dropzone.",
  "data-empty": "While no file is held.",
})

export const fileUploadMeta = {
  scope: "file-upload",
  name: "FileUpload",
  stateless: false,
  parts: [
    {
      name: "FileUpload.Root",
      part: "root",
      element: "div",
      description:
        "Holds the files. Renders, after its children, the native file input (the form carrier and the chooser, hidden) and the selection summary.",
    },
    {
      name: "FileUpload.Label",
      part: "label",
      element: "span",
      description: 'Names the Trigger with its content ("CV, Choose file").',
    },
    {
      name: "FileUpload.Dropzone",
      part: "dropzone",
      element: "div",
      description:
        "Takes file drops (no role, no tab stop); a press on its own area opens the chooser. Put the Trigger inside or next to it.",
    },
    {
      name: "FileUpload.Trigger",
      part: "trigger",
      element: "button",
      description:
        'Opens the chooser; the one keyboard way in. Described by the summary ("No file chosen", the name, "3 files"); a paste of files on it adds them.',
    },
    {
      name: "(inside Root)",
      part: "hidden-input",
      element: "input",
      description:
        '`type="file"`, `aria-hidden`, `tabindex="-1"`: holds exactly the held `File`s for the form.',
    },
    {
      name: "(inside Root)",
      part: "summary",
      element: "span",
      description: "Visually hidden selection summary describing the Trigger.",
    },
    {
      name: "FileUpload.ItemGroup",
      part: "item-group",
      element: "ul",
      description: 'The held files, named "Selected files"; render it with `files.map`.',
    },
    { name: "FileUpload.Item", part: "item", element: "li", description: "One held file." },
    { name: "FileUpload.ItemName", part: "item-name", element: "span", description: "Its name." },
    {
      name: "FileUpload.ItemSize",
      part: "item-size",
      element: "span",
      description: "Its size for the locale (base 1000).",
    },
    {
      name: "FileUpload.ItemPreview",
      part: "item-preview",
      element: "img",
      description: 'An image `File`\'s preview (`alt=""`); the object URL is revoked on unmount.',
    },
    {
      name: "FileUpload.ItemRemove",
      part: "item-remove",
      element: "button",
      description:
        'Removes its file; named "Remove {name}". Focus moves to the next file, else the previous, else the Trigger.',
    },
    {
      name: "FileUpload.ClearTrigger",
      part: "clear-trigger",
      element: "button",
      description:
        'Removes every file; named "Remove all files"; rendered only while files are held.',
    },
  ],
  props: {
    files: { type: "readonly F[]", description: "Controlled held files." },
    defaultFiles: {
      type: "readonly F[]",
      default: "[]",
      description: "Uncontrolled initial files.",
    },
    onFilesChange: {
      type: "(files, details) => void",
      description:
        'The whole new list; `details.reason`: "add", "remove", "clear", "reset" or "api".',
    },
    accept: {
      type: "string | readonly string[]",
      description: "MIME types, `type/*` and `.ext`; an empty type falls back to the extension.",
    },
    maxFiles: {
      type: "number",
      default: "1",
      description: "The most files held. With 1 a new file replaces the held one.",
    },
    maxFileSize: { type: "number", description: "Bytes." },
    minFileSize: { type: "number", description: "Bytes." },
    directory: {
      type: "boolean",
      default: "false",
      description:
        "Take folders: `webkitdirectory` on the chooser, traversal on drop (`filePath(file)`).",
    },
    validate: {
      type: "(file, { files }) => string | null",
      description: "A code rejects the file (`CUSTOM`).",
    },
    onReject: {
      type: "(rejections) => void",
      description: "Once per gesture: `{ file, reason, code? }[]`.",
    },
    dropSource: {
      type: "(zone, sink) => () => void",
      description: "Where drops come from (default the DOM; a Tauri window's drag-drop events).",
    },
    preventDocumentDrop: {
      type: "boolean",
      default: "true",
      description: "A file dropped outside the Dropzone does not navigate the page.",
    },
    capture: { type: '"user" | "environment"', description: "The native `capture` hint." },
    name: { type: "string", description: "The form field name." },
    form: { type: "string", description: "The form id, when outside it." },
    disabled: {
      type: "boolean",
      default: "false",
      description: "Nothing is taken or removed; not submitted.",
    },
    readOnly: {
      type: "boolean",
      default: "false",
      description: "Focusable and submitted, but nothing is added or removed.",
    },
    required: {
      type: "boolean",
      default: "false",
      description: "The form is invalid with no file.",
    },
    invalid: { type: "boolean", default: "false", description: "Forces the invalid state." },
    messages: { type: "Partial<FileUploadMessages>", description: "Overrides the strings." },
    locale: { type: "string", description: "Default: the provider's locale." },
    render: {
      type: "RenderProp",
      description: "Substitutes the rendered element without changing behaviour.",
    },
  },
  dataAttributes: {
    root: base("root"),
    label: base("label"),
    dropzone: base("dropzone"),
    trigger: {
      ...base("trigger"),
      "data-focus": "Focused.",
      "data-focus-visible": "Keyboard focus.",
    },
    "hidden-input": base("hidden-input"),
    summary: base("summary"),
    "item-group": base("item-group"),
    item: { ...base("item"), "data-index": "The file's position." },
    "item-name": base("item-name"),
    "item-size": base("item-size"),
    "item-preview": base("item-preview"),
    "item-remove": base("item-remove"),
    "clear-trigger": base("clear-trigger"),
  },
  keyboard: [
    ["Enter, Space", "On the Trigger: opens the file chooser."],
    ["Ctrl+V / ⌘V", "On the Trigger: adds the pasted files."],
    ["Enter, Space", "On a Remove button: removes that file."],
  ],
  states: {
    idle: "No file drag over the Dropzone.",
    dragging: "A file drag is over the Dropzone (no verdict until the drop).",
  },
  contract: {
    actions: {
      choose: ["pointer", "keyboard", "virtual"],
      drop: ["pointer", "virtual"],
      dragEnter: ["pointer", "virtual"],
      dragLeave: ["pointer", "virtual"],
      paste: ["keyboard"],
      remove: ["pointer", "keyboard", "virtual"],
      clear: ["pointer", "keyboard", "virtual"],
      resetForm: ["pointer", "keyboard", "virtual"],
    },
    queries: ["files", "isDragging", "summary", "isDisabled", "isInvalid", "isRequired"],
    traits: [],
  },
} as const satisfies ComponentMeta
