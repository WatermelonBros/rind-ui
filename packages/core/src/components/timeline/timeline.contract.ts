import { staticContract } from "../../contract/contract"

/**
 * Timeline's contract (add-timeline design §3): the list named `name`, or the only Timeline in
 * the target. No actions.
 */
export const timelineContract = staticContract("timeline", {
  anatomy: [
    "root",
    "item",
    "indicator",
    "connector",
    "content",
    "title",
    "description",
    "time",
    "opposite",
  ],
  locate: (anchor: { readonly name?: string | RegExp } = {}) =>
    anchor.name === undefined ? { part: "root" } : { role: "list", name: anchor.name },
  actions: {},
  queries: {
    count: async (env) => env.part("item").count(),
    /** The index of the item with aria-current="step", or -1. */
    current: async (env) => {
      const items = await env.part("item").all()
      for (const [i, item] of items.entries()) {
        if ((await item.attr("aria-current")) === "step") return i
      }
      return -1
    },
    /** An item's status ("" on a plain log). */
    status: async (env, index: number) =>
      (await env.part("item").nth(index).attr("data-status")) ?? "",
    /** The titles' text (status words included: what a screen reader hears). */
    titles: async (env) => {
      const out: string[] = []
      for (const t of await env.part("title").all()) out.push(await t.text())
      return out
    },
  },
  traits: [],
})
