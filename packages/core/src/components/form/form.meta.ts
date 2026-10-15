// The Form's API facts for the generated docs (scripts/docs-gen.ts). Data only; checked
// against the code in form.meta.test.ts.

import type { ComponentMeta } from "../meta"

export const formMeta = {
  scope: "form",
  name: "Form",
  stateless: false,
  parts: [
    {
      name: "Form.Root",
      part: "root",
      element: "form",
      description: "A native `<form>`; `novalidate` only in `aria` behaviour.",
    },
  ],
  props: {
    validationMode: {
      type: '"submit" | "blur" | "change"',
      description: "Default mode for the Fields inside.",
    },
    validationBehavior: {
      type: '"native" | "aria"',
      description: "Default behaviour for the Fields inside; `aria` adds `novalidate`.",
    },
    errors: {
      type: "Record<string, string | string[]>",
      description:
        "Server errors by exact Field name; shown at once, cleared by that Field's next change.",
    },
    onFormSubmit: {
      type: "(values, { event, submitter }) => void",
      description: "Replaces the native submission with the typed values of every named Field.",
    },
    actionsRef: {
      type: "Ref<{ validate(name?): void }>",
      description: "The imperative `validate`: displays errors, focuses nothing.",
    },
    messages: {
      type: "{ invalidSummary?: (count) => string }",
      description: "The failed-attempt summary.",
    },
    render: { type: "ReactElement | (props, state) => ReactNode", description: "Another element." },
  },
  dataAttributes: {
    root: {
      "data-scope": '"form"',
      "data-part": '"root"',
      "data-instance": "The instance id.",
      "data-validating": "A submission is held for pending async checks.",
      "data-invalid": "The last attempt failed (until the next attempt or reset).",
    },
  },
  keyboard: [],
  states: {
    idle: "Ready; also after a failed attempt.",
    validating: "A submission is held until every async check settles.",
    "awaiting-server": "A submission proceeded; server errors may come back through `errors`.",
  },
  contract: {
    actions: {
      submit: ["pointer", "keyboard", "virtual"],
      reset: ["pointer", "keyboard", "virtual"],
      validate: ["pointer", "virtual"],
    },
    queries: ["isInvalid", "isValidating", "invalidFields", "focusedField", "submissions"],
    traits: [],
  },
} as const satisfies ComponentMeta
