// Separator's API facts for the generated docs (scripts/docs-gen.ts). Data only, type-only
// imports; checked against the code in separator.meta.test.ts.

import type { ComponentMeta } from "../meta"

export const separatorMeta = {
  scope: "separator",
  name: "Separator",
  stateless: true,
  notParts: ["SeparatorHostContext"],
  parts: [
    {
      name: "Separator.Root",
      part: "root",
      element: "div",
      description: 'The divider: `role="separator"` (implicit on `<hr>`), never focusable.',
    },
  ],
  props: {
    orientation: {
      type: '"horizontal" | "vertical"',
      default: '"horizontal"',
      description:
        "Its own orientation; wins over the container's default (a toolbar's separators are vertical).",
    },
    decorative: {
      type: "boolean",
      default: "false",
      description: 'Purely visual: `role="none"`, removed from the accessibility tree.',
    },
    "*.render": {
      type: "ReactElement | (props, state) => ReactNode",
      description: "Another element, for example `<hr />` (rendered without children).",
    },
  },
  dataAttributes: {
    root: {
      "data-scope": '"separator" (the host\'s scope when rendered by another component)',
      "data-part": '"root" ("separator" under a host scope)',
      "data-instance": "The instance id.",
      "data-orientation": '"horizontal" | "vertical": its own orientation.',
      "data-decorative": 'Present when decorative or when the context forces `role="none"`.',
    },
  },
  keyboard: [],
  contract: { actions: {}, queries: ["orientation", "isDecorative", "isExposed"], traits: [] },
} as const satisfies ComponentMeta
