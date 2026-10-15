// The Label's API facts for the generated docs (scripts/docs-gen.ts). Data only, type-only
// imports; checked against the code in label.meta.test.ts.

import type { ComponentMeta } from "../meta"

export const labelMeta = {
  scope: "label",
  name: "Label",
  stateless: true,
  parts: [
    {
      name: "Label (Label.Root)",
      part: "root",
      element: "label",
      description: "A native `<label>`: no role, no ARIA.",
    },
  ],
  props: {
    htmlFor: {
      type: "string",
      description:
        "The id of the control it names. Kept on the server; dropped after mount when it names a non-labelable element (focus is forwarded instead, with a development warning).",
    },
    id: {
      type: "string",
      description: "Generated when absent, the same on the server and the client.",
    },
    render: {
      type: "ReactElement | (props) => ReactNode",
      description: "Another element: a non-`<label>` forwards focus to `htmlFor`'s element itself.",
    },
  },
  dataAttributes: {
    root: {
      "data-scope": '"label"',
      "data-part": '"root"',
      "data-instance": "The instance id.",
    },
  },
  keyboard: [],
  contract: {
    actions: { click: ["pointer", "virtual"], doubleClick: ["pointer", "virtual"] },
    queries: ["text", "controlName", "isControlFocused", "selectedText"],
    traits: [],
  },
} as const satisfies ComponentMeta
