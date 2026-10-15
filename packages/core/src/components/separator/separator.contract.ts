import { staticContract } from "../../contract/contract"

/**
 * Separator's contract (design §4): a named separator by role and exact name; otherwise
 * the one separator part inside the driver's target (a container). No actions.
 */
export const separatorContract = staticContract("separator", {
  anatomy: ["root"],
  locate: (anchor: { readonly name?: string | RegExp } = {}) =>
    anchor.name === undefined ? { part: "root" } : { role: "separator", name: anchor.name },
  actions: {},
  queries: {
    orientation: async ({ part }) => (await part("root").attr("data-orientation")) ?? "horizontal",
    /** Not exposed as a separator (role none: decorative, or inside a listbox). */
    isDecorative: async ({ part }) => (await part("root").attr("role")) === "none",
    isExposed: async ({ part }) => (await part("root").attr("role")) !== "none",
  },
  traits: [],
})
