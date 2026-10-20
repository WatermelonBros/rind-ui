import { staticContract } from "../../contract/contract"

/**
 * A Separator contract for the component that draws it: the Separator itself (scope
 * `separator`, part `root`), or a host's (scope `toolbar`, part `separator`: the separator
 * capability's hosted form). A named separator is located by role and exact name; otherwise
 * the one separator part inside the driver's target (a container). No actions.
 */
/* @__NO_SIDE_EFFECTS__ */
export function separatorContractFor(scope: string) {
  const part = scope === "separator" ? "root" : "separator"
  return staticContract(scope, {
    anatomy: [part],
    locate: (anchor: { readonly name?: string | RegExp } = {}) =>
      anchor.name === undefined ? { part } : { role: "separator", name: anchor.name },
    actions: {},
    queries: {
      orientation: async (env) => (await env.part(part).attr("data-orientation")) ?? "horizontal",
      /** Not exposed as a separator (role none: decorative, or inside a listbox). */
      isDecorative: async (env) => (await env.part(part).attr("role")) === "none",
      isExposed: async (env) => (await env.part(part).attr("role")) !== "none",
    },
    traits: [],
  })
}

/** Separator's contract (design §4). */
export const separatorContract = separatorContractFor("separator")
