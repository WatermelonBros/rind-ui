import { staticContract } from "../../contract/contract"

/**
 * Kbd's contract (add-kbd design §5): the only Kbd root inside the driver's target, or the
 * one whose text matches. No actions. A `kbd` has no name of its own: what it says is checked
 * through the name of the control that holds it.
 */
export const kbdContract = staticContract("kbd", {
  anatomy: ["root", "key", "separator"],
  locate: (anchor: { readonly text?: string | RegExp } = {}) =>
    anchor.text === undefined ? { part: "root" } : { text: anchor.text },
  actions: {},
  queries: {
    /** The keys' canonical names, in order ("meta", "shift", "p"). */
    keys: async (env) => {
      const out: string[] = []
      for (const key of await env.part("key").all()) out.push((await key.attr("data-key")) ?? "")
      return out
    },
    /** "apple" or "other". */
    platform: async (env) => (await env.part("root").attr("data-platform")) ?? "other",
  },
  traits: [],
})
