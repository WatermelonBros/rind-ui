import { staticContract } from "../../contract/contract"

/** The Fieldset's contract: located by role group and name; no actions (props only). */
export const fieldsetContract = staticContract("fieldset", {
  anatomy: ["root", "legend", "description", "error-message"],
  locate: ({ name }: { readonly name: string | RegExp }) => ({ role: "group", name }),
  actions: {},
  queries: {
    name: async ({ part }) => part("root").accessibleName(),
    description: async ({ part }) => part("root").accessibleDescription(),
    isDisabled: async ({ part }) => (await part("root").attr("data-disabled")) !== null,
    isInvalid: async ({ part }) => (await part("root").attr("data-invalid")) !== null,
    errors: async ({ part }) => {
      const error = part("error-message")
      return (await error.exists()) ? error.text() : null
    },
  },
  traits: [],
})
