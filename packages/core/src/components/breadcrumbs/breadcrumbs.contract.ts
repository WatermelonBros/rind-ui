import { type Invariant, staticContract } from "../../contract/contract"
import type { Env, Part } from "../../contract/env"

type P = "root" | "list" | "item" | "link" | "separator" | "ellipsis"

/** The ellipsis' trigger: the button named by the Ellipsis' `label` (its `data-label`). */
async function trigger(env: Env<P>): Promise<Part> {
  const name = (await env.part("ellipsis").attr("data-label")) ?? ""
  return env.find({ role: "button", name })
}

/** The element of the trail that carries `aria-current`: a link part, or an Item's control. */
async function currentEls(env: Env<P>): Promise<Part[]> {
  const out: Part[] = []
  for (const link of await env.part("link").all()) {
    if ((await link.attr("aria-current")) !== null) out.push(link)
  }
  if (out.length > 0) return out
  // A non-link Item (a Menu trigger) sets aria-current itself: its Item has data-current.
  for (const item of await env.part("item").all()) {
    if ((await item.attr("data-current")) !== null) out.push(item)
  }
  return out
}

/** An item's spoken name: its link (or current text) when it has one, else its text. */
async function itemName(item: Part): Promise<string> {
  const link = item.scoped("breadcrumbs", "link")
  return (await link.count()) > 0 ? link.nth(0).text() : item.text()
}

/** Separators are hidden glyphs inside an Item, never list items (APG). */
const separatorsHidden: Invariant<P> = {
  name: "breadcrumbs-separators-hidden",
  check: async ({ env }) => {
    for (const sep of await env.part("separator").all()) {
      if ((await sep.attr("aria-hidden")) !== "true") return "a separator is not aria-hidden"
      const tag = await sep.tagName()
      if (tag === "li") return "a separator is a list item <li>: put it inside an Item"
    }
    return undefined
  },
}

/** At most one element of the trail carries `aria-current`. */
const singleCurrent: Invariant<P> = {
  name: "breadcrumbs-single-current",
  check: async ({ env }) => {
    const n = (await currentEls(env)).length
    return n > 1 ? `${n} elements have aria-current, expected at most one` : undefined
  },
}

/** The list's items are the Items and the Ellipsis, each an `<li>`. */
const listChildrenAreCrumbs: Invariant<P> = {
  name: "breadcrumbs-list-children-are-crumbs",
  check: async ({ env }) => {
    if ((await env.part("list").tagName()) !== "ol") return "the list is not an <ol>"
    for (const part of ["item", "ellipsis"] as const) {
      for (const el of await env.part(part).all()) {
        const tag = await el.tagName()
        if (tag !== "li") return `a breadcrumbs ${part} is a <${tag}>, not an <li>`
      }
    }
    return undefined
  },
}

/** Breadcrumbs' contract (design §7): located by its `navigation` landmark's name. */
export const breadcrumbsContract = staticContract("breadcrumbs", {
  anatomy: ["root", "list", "item", "link", "separator", "ellipsis"],
  locate: ({ name }: { readonly name: string | RegExp }) => ({ role: "navigation", name }),
  actions: {
    follow: {
      pointer: async ({ part }, name: string) => part("link", { role: "link", name }).click(),
      keyboard: async ({ part }, name: string) =>
        part("link", { role: "link", name }).press("Enter"),
      done: async (env) => env.navigated(),
    },
    openCollapsed: {
      pointer: async (env) => (await trigger(env)).click(),
      keyboard: async (env) => {
        await (await trigger(env)).focus()
        await env.keyboard("Enter")
      },
      done: async (env) => (await (await trigger(env)).attr("aria-expanded")) === "true",
    },
    followCollapsed: {
      pointer: async (env, name: string) => {
        await (await trigger(env)).click()
        await (await collapsedItem(env, name)).click()
      },
      keyboard: async (env, name: string) => {
        await (await trigger(env)).focus()
        await env.keyboard("Enter")
        await (await collapsedItem(env, name)).press("Enter")
      },
      done: async (env) => env.navigated(),
    },
  },
  queries: {
    /** Visible crumb names in order, the ellipsis as its trigger's name. */
    items: async (env) => {
      const out: string[] = []
      let ellipsis = false
      for (const item of await env.part("item").all()) {
        if ((await item.attr("hidden")) !== null) {
          if (!ellipsis) out.push((await env.part("ellipsis").attr("data-label")) ?? "")
          ellipsis = true
          continue
        }
        out.push(await itemName(item))
      }
      return out
    },
    current: async (env) => {
      const [el] = await currentEls(env)
      if (!el) return null
      return { name: await el.text(), value: await el.attr("aria-current") }
    },
    collapsedCount: async (env) =>
      (await env.part("ellipsis").exists())
        ? Number((await env.part("ellipsis").attr("data-count")) ?? 0)
        : 0,
    href: async (env, name: string) => env.part("link", { role: "link", name }).attr("href"),
  },
  traits: [],
  invariants: [separatorsHidden, singleCurrent, listChildrenAreCrumbs],
})

/** A collapsed item in the open ellipsis popup: a menu item, else a link (a Popover list). */
async function collapsedItem(env: Env<P>, name: string): Promise<Part> {
  const item = env.find({ role: "menuitem", name })
  const link = env.find({ role: "link", name })
  // The popup opens after the trigger's activation: wait for either form to appear.
  const found = await env.until(
    async () => ((await item.exists()) ? "menuitem" : (await link.exists()) ? "link" : null),
    (kind) => kind !== null,
  )
  return found === "menuitem" ? item : link
}
