import { contract } from "../../contract/contract"
import type { Env } from "../../contract/env"
import { suggestionsMachine } from "./suggestions.machine"

type P = "root" | "item" | "label" | "description"
type E = Env<P>

/** The Item whose text is `target`, or the `target`-th. */
async function itemOf(env: E, target: string | number) {
  const items = await env.part("item").all()
  if (typeof target === "number") return items[target]
  for (const item of items) if ((await item.accessibleName()).startsWith(target)) return item
  return undefined
}

const pickWith = (how: "click" | "tap" | "key") => async (env: E, target: string | number) => {
  const item = await itemOf(env, target)
  if (!item) throw new Error(`suggestions: no item ${JSON.stringify(target)}`)
  if (how === "click") return item.click()
  if (how === "tap") return item.tap()
  await item.focus()
  await item.press("Enter")
}

/** Suggestions' contract (spec "Suggestions Contract"): by the group's name, else the only one. */
export const suggestionsContract = contract("suggestions", {
  machine: suggestionsMachine,
  anatomy: ["root", "item", "label", "description"],
  locate: (anchor?: { readonly name: string | RegExp }) =>
    anchor ? { role: "group", name: anchor.name } : { part: "root" },
  actions: {
    pick: {
      pointer: pickWith("click"),
      touch: pickWith("tap"),
      keyboard: pickWith("key"),
      done: async () => true,
    },
  },
  queries: {
    items: async (env: E) => {
      const out: string[] = []
      for (const item of await env.part("item").all()) out.push(await item.accessibleName())
      return out
    },
    count: async (env: E) => Number((await env.part("root").attr("data-count")) ?? 0),
    isLoading: async (env: E) => (await env.part("root").attr("data-state")) === "loading",
    isDisabled: async (env: E) => (await env.part("root").attr("data-state")) === "disabled",
  },
  states: {
    ready: { isLoading: false, isDisabled: false },
    loading: { isLoading: true },
    disabled: { isDisabled: true },
  },
  events: { PRESS: "pick" },
  traits: [],
})
