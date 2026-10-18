// Heading's API facts for the generated docs (scripts/docs-gen.ts). Data only, type-only
// imports; checked against the code in heading.meta.test.ts.

import type { ComponentMeta } from "../meta"

export const headingMeta = {
  scope: "heading",
  name: "Heading",
  stateless: true,
  parts: [
    {
      name: "Heading",
      part: "root",
      element: "h{level}",
      description: "The heading: `h2` outside any section.",
    },
    {
      name: "Heading.Level",
      part: "—",
      element: "none",
      description: "A section: sets the level of the headings below it.",
    },
  ],
  props: {
    level: {
      type: "1 | 2 | 3 | 4 | 5 | 6",
      description:
        "On `Heading`: overrides the nesting. On `Heading.Level`: the level below it (default: one more than around it).",
    },
    "*.render": {
      type: "ReactElement | (props, state) => ReactNode",
      description:
        'Another element: a non-heading gets `role="heading"` and `aria-level`, another `h1`–`h6` gets `aria-level`.',
    },
  },
  dataAttributes: {
    root: {
      "data-scope": '"heading"',
      "data-part": '"root"',
      "data-instance": "The instance id.",
      "data-level": '"1"–"6": the computed level.',
    },
  },
  keyboard: [],
  contract: { actions: {}, queries: ["level"], traits: [] },
} as const satisfies ComponentMeta
