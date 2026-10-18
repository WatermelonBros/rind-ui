// Avatar's API facts for the generated docs (scripts/docs-gen.ts). Data only; checked
// against the code in avatar.meta.test.ts.

import type { ComponentMeta } from "../meta"

const base = (part: string) => ({
  "data-scope": '"avatar"',
  "data-part": `"${part}"`,
  "data-instance": "The instance id.",
})
const withState = (part: string) => ({
  ...base(part),
  "data-state": '"idle" | "loading" | "loaded" | "error": the image status.',
})

export const avatarMeta = {
  scope: "avatar",
  name: "Avatar",
  stateless: false,
  parts: [
    {
      name: "Avatar.Root",
      part: "root",
      element: "span",
      description:
        'Carries the one accessible name: `role="img"` with your `aria-label`/`aria-labelledby`, or nothing with `aria-hidden="true"` (decorative).',
    },
    {
      name: "Avatar.Image",
      part: "image",
      element: "img",
      description:
        'The image and the only loader: `alt=""`, `hidden` only with no source or after an error, never while loading (lazy loading works).',
    },
    {
      name: "Avatar.Fallback",
      part: "fallback",
      element: "span",
      description: "Initials or an icon, rendered while the image is not loaded.",
    },
    {
      name: "Avatar.Group",
      part: "group",
      element: "div",
      description: 'A named `role="group"` of avatars; keeps no state and chooses no avatars.',
    },
    {
      name: "Avatar.GroupOverflow",
      part: "group-overflow",
      element: "span",
      description: '"+N" visible and hidden from assistive technology, "N more" visually hidden.',
    },
  ],
  props: {
    fallbackDelay: {
      type: "number",
      default: "0",
      description:
        "Root: milliseconds the Fallback waits while the image is loading. No source or an error shows it at once. Client-only: with a delay the server HTML has no Fallback.",
    },
    onStatusChange: {
      type: "(status, { reason, event }) => void",
      description: "Root: called on every status change (observed, not controlled).",
    },
    "*.count": {
      type: "number",
      description: "GroupOverflow: how many avatars are not shown.",
    },
    "*.messages": {
      type: "{ overflowLabel?: (count) => string }",
      description: 'Root and GroupOverflow: the overflow label (default "N more").',
    },
    "*.render": {
      type: "ReactElement | (props, state) => ReactNode",
      description:
        "Substitutes the rendered element; on Image, a framework image component receives the ref, `alt`, `hidden`, `data-*` and the load handlers.",
    },
  },
  dataAttributes: {
    root: withState("root"),
    image: withState("image"),
    fallback: withState("fallback"),
    group: base("group"),
    "group-overflow": base("group-overflow"),
  },
  keyboard: [],
  states: {
    idle: "No image, or no `src`/`srcSet`: the Fallback shows.",
    loading: "The image is loading; the Fallback shows after `fallbackDelay`.",
    loaded: "The image is displayable; the Fallback is unmounted.",
    error: "The image failed; the `<img>` is hidden and the Fallback shows.",
  },
  contract: {
    actions: { waitForStatus: ["pointer", "keyboard", "touch", "virtual"] },
    queries: ["status", "isFallbackVisible", "name"],
    traits: [],
  },
} as const satisfies ComponentMeta
