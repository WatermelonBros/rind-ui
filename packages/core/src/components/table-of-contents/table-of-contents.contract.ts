import { contract, type Invariant } from "../../contract/contract"
import type { Env } from "../../contract/env"
import { tableOfContentsMachine } from "./table-of-contents.machine"

type P = "root" | "title" | "list" | "item" | "link" | "indicator"
type E = Env<P>

const linkNamed = async (env: E, label: string) => {
  for (const link of await env.part("link").all()) {
    if ((await link.text()) === label) return link
  }
  throw new Error(`table-of-contents: no link "${label}"`)
}

/** Table of Contents invariants (spec): at most one current location. */
const invariants: readonly Invariant<P>[] = [
  {
    name: "table-of-contents-one-current",
    check: async ({ env }) => {
      let n = 0
      for (const link of await env.part("link").all()) {
        if ((await link.attr("aria-current")) === "location") n++
      }
      return n <= 1 ? undefined : `${n} links are current`
    },
  },
]

/** Table of Contents' contract (spec "Contract"): located by the landmark's name. */
export const tableOfContentsContract = contract("table-of-contents", {
  machine: tableOfContentsMachine,
  anatomy: ["root", "title", "list", "item", "link", "indicator"],
  locate: (anchor?: { readonly name: string | RegExp }) =>
    anchor ? { role: "navigation", name: anchor.name } : { part: "root" },
  actions: {
    /** Follows the link labelled `label`. */
    follow: {
      pointer: async (env, label: string) => (await linkNamed(env, label)).click(),
      keyboard: async (env, label: string) => {
        const link = await linkNamed(env, label)
        const target = (await link.attr("href"))?.slice(1)
        await link.focus()
        await link.press("Enter")
        // The heading takes focus on the next frame: every run waits for it (no race with the
        // step's snapshot).
        const landed = async () => {
          const el = env.focused()
          return (await el.exists()) && (await el.attr("id")) === target
        }
        for (let t = 0; t < 500 && !(await landed()); t += 16) await env.advance(16)
      },
      done: async (): Promise<boolean> => true,
    },
  },
  queries: {
    /** The current link's text ("" for none). */
    current: async (env: E) => {
      for (const link of await env.part("link").all()) {
        if ((await link.attr("aria-current")) === "location") return link.text()
      }
      return ""
    },
    /** The texts of the links whose sections are in view. */
    visible: async (env: E) => {
      const out: string[] = []
      for (const link of await env.part("link").all()) {
        if ((await link.attr("data-visible")) !== null) out.push(await link.text())
      }
      return out
    },
    /** The focused element's text when it is a heading, else "". */
    focusedHeading: async (env: E) => {
      const el = env.focused()
      if (!(await el.exists())) return ""
      return /^h[1-6]$/.test(await el.tagName()) ? el.text() : ""
    },
  },
  states: { tracking: {}, navigating: {} },
  events: {
    NAVIGATE: {
      action: "follow",
      // `as never`: the mapping's args are typed across every action; follow takes (label).
      args: (() => ["Install"]) as never,
      event: () => ({ id: "install" }),
    },
    POSITION: { skip: "the reading position follows real scrolling: the DOM tests" },
    "USER.SCROLL": { skip: "a real wheel or touch: the DOM tests" },
    "VALUE.SYNCED": { skip: "the parent's value: the controlled DOM tests" },
    "$props:value": { skip: "the parent's value: the controlled DOM tests" },
  },
  traits: [],
  invariants,
  // `focusedHeading` reads focus: focusing a link changes it.
  commitsOnFocus: (["tracking", "navigating"] as const).map((state) => ({
    part: "link" as const,
    state,
  })),
})
