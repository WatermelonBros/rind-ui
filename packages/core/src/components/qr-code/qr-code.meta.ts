// QR Code's API facts for the generated docs (scripts/docs-gen.ts). Data only; checked
// against the code in qr-code.meta.test.ts.

import type { ComponentMeta } from "../meta"

const base = (part: string) => ({
  "data-scope": '"qr-code"',
  "data-part": `"${part}"`,
  "data-instance": "The instance id.",
})

export const qrCodeMeta = {
  scope: "qr-code",
  name: "QR Code",
  stateless: false,
  parts: [
    {
      name: "QrCode.Root",
      part: "root",
      element: "div",
      description: "Holds the value, the encoding and the result state; sizes nothing itself.",
    },
    {
      name: "QrCode.Frame",
      part: "frame",
      element: "svg",
      description:
        'The symbol with its quiet zone in the `viewBox`; `role="img"` with a name and the value as description when there is a symbol, `aria-hidden` otherwise.',
    },
    {
      name: "QrCode.Pattern",
      part: "pattern",
      element: "path",
      description: "One path of merged module runs; its fill comes from CSS.",
    },
    {
      name: "QrCode.Overlay",
      part: "overlay",
      element: "div",
      description:
        "Optional centred content (a logo) over the symbol; the modules under it stay. Reports `data-covers`.",
    },
    {
      name: "QrCode.ValueText",
      part: "value-text",
      element: "span",
      description: "The value as visually hidden text, the frame's description. Optional.",
    },
    {
      name: "QrCode.DownloadTrigger",
      part: "download-trigger",
      element: "button",
      description:
        "Saves the symbol as PNG, JPEG, WebP or SVG; `aria-disabled` while there is no symbol. Named by its content or `messages.download`.",
    },
  ],
  props: {
    value: { type: "string", description: "Root: the encoded value (controlled)." },
    defaultValue: { type: "string", default: '""', description: "Root: the initial value." },
    onValueChange: {
      type: "(value, details) => void",
      description: "Root: every change of the value, once.",
    },
    encoding: {
      type: "{ ecc?, boostEcc?, minVersion?, maxVersion?, mask?, eci?, quietZone? }",
      default: '{ ecc: "M", quietZone: 4 }',
      description:
        "Root: encoder options, compared by value (an inline object does not re-encode). `ecc` L/M/Q/H, `quietZone` in modules.",
    },
    onEncodeError: {
      type: "(error) => void",
      description: 'Root: the encoder failed ("too-long", "invalid-option"); once per value.',
    },
    onDownload: {
      type: "({ fileName, mimeType, overlay }) => void",
      description: 'Root: once per download; `overlay` is "included", "omitted" or "none".',
    },
    mimeType: {
      type: '"image/png" | "image/jpeg" | "image/webp" | "image/svg+xml"',
      default: '"image/png"',
      description: "DownloadTrigger: the file type.",
    },
    fileName: {
      type: "string",
      default: '"qr-code.<ext>"',
      description: "DownloadTrigger: the file name; path separators are removed.",
    },
    size: {
      type: "number",
      default: "1024",
      description:
        "DownloadTrigger: the image width in CSS pixels, rounded up to whole pixels per module.",
    },
    quality: { type: "number", description: "DownloadTrigger: 0–1 for JPEG and WebP." },
    messages: {
      type: "{ label?: string; download?: string }",
      description:
        'Root: the frame\'s default name ("QR code") and the trigger\'s ("Download QR code").',
    },
    render: {
      type: "ReactElement | (props, state) => ReactNode",
      description: "Substitutes the rendered element of any part.",
    },
  },
  dataAttributes: {
    root: {
      ...base("root"),
      "data-state": '"ready" | "empty" | "invalid": the result of encoding the value.',
      "data-version": "The symbol's version (1–40) when ready.",
      "data-ecc": "The level used (L, M, Q, H) when ready.",
      "data-modules": "Modules per side without the quiet zone, when ready.",
      "data-last-download": "The file name of the last download.",
    },
    frame: { ...base("frame"), "data-state": "The root's `data-state`." },
    pattern: base("pattern"),
    overlay: {
      ...base("overlay"),
      "data-covers": "Percent of the symbol the overlay covers (0–100).",
    },
    "value-text": base("value-text"),
    "download-trigger": {
      ...base("download-trigger"),
      "data-state": '"idle" | "downloading".',
      "data-disabled": "Present while there is no symbol to download.",
      "data-focus": "Present while focused.",
      "data-focus-visible": "Present while focused from the keyboard.",
      "data-pressed": "Present while pressed.",
    },
  },
  keyboard: [["Enter / Space", "On the download trigger: downloads the symbol."]],
  states: {
    ready: "Idle: the symbol is shown; a download can start.",
    downloading: "An export is running; further presses are ignored.",
  },
  contract: {
    actions: {
      setValue: ["pointer", "keyboard", "virtual"],
      download: ["pointer", "keyboard", "touch", "virtual"],
    },
    queries: [
      "value",
      "state",
      "version",
      "ecc",
      "size",
      "matrix",
      "decoded",
      "description",
      "isEmpty",
      "error",
      "isDownloading",
      "lastDownload",
    ],
    traits: [],
  },
} as const satisfies ComponentMeta
