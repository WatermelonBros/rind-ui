// Skeleton's API facts for the generated docs (scripts/docs-gen.ts). Data only;
// checked against the code in skeleton.meta.test.ts.

import type { ComponentMeta } from "../meta"

const base = (part: string) => ({
  "data-scope": '"skeleton"',
  "data-part": `"${part}"`,
  "data-instance": "The instance id.",
  "data-state": '"loading" or "loaded".',
})

export const skeletonMeta = {
  scope: "skeleton",
  name: "Skeleton",
  stateless: false,
  parts: [
    {
      name: "Skeleton.Root",
      part: "root",
      element: "div",
      description: "Holds the loading state for the whole area; no ARIA attribute of its own.",
    },
    {
      name: "Skeleton.Status",
      part: "status",
      element: "span",
      description:
        'Visually hidden loading text ("Loading", or its children) while loading; nothing when loaded. Place it outside Content.',
    },
    {
      name: "Skeleton.Content",
      part: "content",
      element: "div",
      description: 'The loading region: `aria-busy="true"` while loading.',
    },
    {
      name: "Skeleton.Item",
      part: "item",
      element: "span",
      description:
        'A placeholder shape, or a wrapper over stale content: `aria-hidden="true"` (and `inert` when it has children) while loading.',
    },
  ],
  props: {
    loading: {
      type: "boolean",
      default: "true",
      description: "Root: the loading state (read-only binding). Item: overrides the Root's.",
    },
    announceOnLoad: {
      type: "boolean | string",
      description:
        "Root: announce politely on `loading → loaded` (`true`: `messages.loaded`). Silent by default.",
    },
    animate: {
      type: "boolean",
      default: "true",
      description: "Root or Item: `false` drops `data-animate`, so the theme does not shimmer.",
    },
    messages: {
      type: "{ loading?: string; loaded?: string }",
      description: "Root: overrides the English defaults (also through the provider).",
    },
    "*.render": {
      type: "RenderProp",
      description: "Substitutes the rendered element (Content as a `ul`, say).",
    },
  },
  dataAttributes: {
    root: base("root"),
    status: base("status"),
    content: base("content"),
    item: { ...base("item"), "data-animate": "While loading, unless `animate={false}`." },
  },
  keyboard: [],
  states: {
    loading: 'Content is `aria-busy`, Items hidden, Status reads "Loading".',
    loaded: "Nothing hidden; the content is exposed as rendered.",
  },
  contract: { actions: {}, queries: ["isLoading", "statusText"], traits: [] },
} as const satisfies ComponentMeta
