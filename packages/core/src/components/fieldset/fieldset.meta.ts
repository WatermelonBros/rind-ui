// The Fieldset's API facts for the generated docs (scripts/docs-gen.ts). Data only;
// checked against the code in fieldset.meta.test.ts.

import type { ComponentMeta } from "../meta"

const parts = (part: string) => ({
  "data-scope": '"fieldset"',
  "data-part": `"${part}"`,
  "data-instance": "The instance id.",
  "data-disabled": "While disabled, by its own prop or an enclosing Fieldset.",
  "data-invalid": "While `invalid`.",
})

export const fieldsetMeta = {
  scope: "fieldset",
  name: "Fieldset",
  stateless: true,
  parts: [
    {
      name: "Fieldset.Root",
      part: "root",
      element: "fieldset",
      description: "The group; named by its Legend, described by Description and ErrorMessage.",
    },
    {
      name: "Fieldset.Legend",
      part: "legend",
      element: "legend",
      description: "The group's name; render it as the root's first child.",
    },
    {
      name: "Fieldset.Description",
      part: "description",
      element: "p",
      description: "Help text for the whole group.",
    },
    {
      name: "Fieldset.ErrorMessage",
      part: "error-message",
      element: "p",
      description: "Rendered only while `invalid` (or with `forceMount`); not a live region.",
    },
  ],
  props: {
    disabled: {
      type: "boolean",
      default: "false",
      description:
        "On Root: disables every control inside, native and rind-ui, portalled parts included (the first Legend's content is exempt).",
    },
    invalid: {
      type: "boolean",
      default: "false",
      description: "On Root: shows the ErrorMessage. Never passed to the controls inside.",
    },
    "*.forceMount": {
      type: "boolean",
      default: "false",
      description: "On ErrorMessage: keep it mounted while not invalid.",
    },
    "*.render": {
      type: "ReactElement | (props, state) => ReactNode",
      description:
        'Every part. A substituted Root gets `role="group"` and `aria-disabled` but cannot disable native controls.',
    },
  },
  dataAttributes: {
    root: parts("root"),
    legend: parts("legend"),
    description: parts("description"),
    "error-message": parts("error-message"),
  },
  keyboard: [],
  contract: {
    actions: {},
    queries: ["name", "description", "isDisabled", "isInvalid", "errors"],
    traits: [],
  },
} as const satisfies ComponentMeta
