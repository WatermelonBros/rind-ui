// Badge's API facts for the generated docs (scripts/docs-gen.ts). Data only, type-only
// imports; checked against the code in badge.meta.test.ts.

import type { ComponentMeta } from "../meta"

export const badgeMeta = {
  scope: "badge",
  name: "Badge",
  stateless: true,
  parts: [
    {
      name: "Badge.Root",
      part: "root",
      element: "span",
      description: "The badge: no role, never a live region, never focusable.",
    },
  ],
  props: {
    label: {
      type: "string",
      description:
        "The text assistive technology gets: the visible content is hidden from it and the label rendered visually hidden.",
    },
    id: {
      type: "string",
      description:
        "Default: generated. A host that keeps an `aria-label` lists it in `aria-describedby`.",
    },
    "*.render": {
      type: "ReactElement | (props, state) => ReactNode",
      description: "Another element.",
    },
  },
  dataAttributes: {
    root: {
      "data-scope": '"badge"',
      "data-part": '"root"',
      "data-instance": "The instance id.",
    },
  },
  keyboard: [],
  contract: { actions: {}, queries: ["text", "isExposed"], traits: [] },
} as const satisfies ComponentMeta
