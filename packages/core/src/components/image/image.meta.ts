// Image's API facts for the generated docs (scripts/docs-gen.ts). Data only; checked against
// the code in image.meta.test.ts.

import type { ComponentMeta } from "../meta"

const withState = (part: string) => ({
  "data-scope": '"image"',
  "data-part": `"${part}"`,
  "data-instance": "The instance id.",
  "data-state": '"idle" | "loading" | "loaded" | "error": the image status.',
})

export const imageMeta = {
  scope: "image",
  name: "Image",
  stateless: false,
  parts: [
    {
      name: "Image.Root",
      part: "root",
      element: "span",
      description:
        'Holds the required `alt`. With no image to show (`idle`, `error`) it carries the name: `role="img"` and `aria-label={alt}`.',
    },
    {
      name: "Image.Img",
      part: "img",
      element: "img",
      description:
        "The image and the only loader, named by Root's `alt` while loading and loaded; `hidden` with no source or after an error, never while loading.",
    },
    {
      name: "Image.Fallback",
      part: "fallback",
      element: "span",
      description:
        'Shown while the image is not loaded; always `aria-hidden="true"` (the name is the image\'s).',
    },
  ],
  props: {
    alt: {
      type: "string",
      description:
        'Root, required: the text alternative. `alt=""` marks a decorative image (nothing is exposed).',
    },
    fallbackDelay: {
      type: "number",
      default: "0",
      description:
        "Root: milliseconds the Fallback waits while the image is loading. No source or an error shows it at once. Client-only.",
    },
    onStatusChange: {
      type: "(status, { reason, event }) => void",
      description: "Root: called on every status change (observed, not controlled).",
    },
    "*.render": {
      type: "ReactElement | (props, state) => ReactNode",
      description:
        "Substitutes the rendered element; on Img, a framework image component receives the ref, `alt`, `hidden`, `data-*` and the load handlers.",
    },
  },
  dataAttributes: {
    root: { ...withState("root"), "data-decorative": 'Present when `alt=""`.' },
    img: withState("img"),
    fallback: withState("fallback"),
  },
  keyboard: [],
  states: {
    idle: "No `src`/`srcSet`: the `<img>` is hidden, Root carries the name, the Fallback shows.",
    loading: "The image is loading, named by its `alt`; the Fallback shows after `fallbackDelay`.",
    loaded: "The image is displayed, named by its `alt`; the Fallback is unmounted.",
    error: "The image failed: the `<img>` is hidden, Root carries the name, the Fallback shows.",
  },
  contract: {
    actions: { waitForStatus: ["pointer", "keyboard", "touch", "virtual"] },
    queries: ["status", "isFallbackVisible", "name"],
    traits: [],
  },
} as const satisfies ComponentMeta
