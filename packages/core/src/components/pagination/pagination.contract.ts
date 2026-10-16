// Pagination's contract (design §7, spec "Pagination Contract"): pointer and keyboard twins
// for every action (keyboard: Tab to the control, Enter), queries read from ARIA, and the
// per-contract invariants of the spec.

import { contract, type Invariant } from "../../contract/contract"
import type { Env, Part } from "../../contract/env"
import type { PaginationDirection } from "./pagination.connect"
import { paginationMachine } from "./pagination.machine"
import { paginationRange } from "./pagination.range"

type P = "root" | "list" | "item" | "page" | "ellipsis" | "first" | "previous" | "next" | "last"
type E = Env<P>

/** The total of the instance a model test renders (set by the test, per argument class). */
export const paginationArgs: { current: { totalPages: number } } = { current: { totalPages: 1 } }

const pageControl = (env: E, n: number): Part => env.part("root").withAttr("data-value", String(n))

async function currentPage(env: E): Promise<number | null> {
  for (const p of await env.part("page").all()) {
    if ((await p.attr("aria-current")) === "page") return Number(await p.attr("data-value"))
  }
  return null
}

const unavailable = async (p: Part) =>
  (await p.attr("aria-disabled")) === "true" || (await p.attr("disabled")) !== null

/** The page before the last action, for the triggers' postconditions. */
let before: number | null = null
const remember = async (env: E) => {
  before = await currentPage(env)
}

const activate = (part: (env: E) => Part) => ({
  pointer: async (env: E) => {
    await remember(env)
    await part(env).click()
  },
  keyboard: async (env: E) => {
    await remember(env)
    const p = part(env)
    if (!(await p.isFocused())) await p.focusWithTab()
    await p.press("Enter")
  },
})

const trigger = (direction: PaginationDirection, done: (from: number) => number) => ({
  ...activate((env) => env.part(direction)),
  done: async (env: E) => (await currentPage(env)) === done(before ?? 1),
})

/** Spec "Pagination Contract": per-contract invariants. */
export const paginationInvariants: readonly Invariant<P, string>[] = [
  {
    name: "pagination-one-current-page",
    check: async ({ env, values, props }) => {
      const marked: string[] = []
      for (const el of await env.part("root").withAttr("data-scope").all()) {
        if ((await el.attr("aria-current")) !== null)
          marked.push((await el.attr("data-part")) ?? "?")
      }
      const total = Number(props["totalPages"] ?? paginationArgs.current.totalPages)
      const expected = Math.min(Math.max(1, Number(values["page"] ?? 1)), Math.max(1, total))
      if (marked.length !== 1 || marked[0] !== "page") {
        return `expected one page part with aria-current, found ${marked.length} (${marked.join(", ")})`
      }
      const shown = await currentPage(env)
      return shown === expected
        ? undefined
        : `the page part marks page ${shown}, oracle ${expected}`
    },
  },
  {
    name: "pagination-range-matches-oracle",
    check: async ({ env, values, props }) => {
      const total = Number(props["totalPages"] ?? paginationArgs.current.totalPages)
      const expected = paginationRange({
        page: Number(values["page"] ?? 1),
        totalPages: total,
        siblingCount: props["siblingCount"] as number | undefined,
        boundaryCount: props["boundaryCount"] as number | undefined,
      }).map((e) => (e.type === "page" ? e.value : "ellipsis"))
      const seen = await visiblePages(env)
      return JSON.stringify(seen) === JSON.stringify(expected)
        ? undefined
        : `visible pages ${JSON.stringify(seen)}, expected ${JSON.stringify(expected)}`
    },
  },
  {
    name: "pagination-ellipsis-not-focusable",
    check: async ({ env }) => {
      for (const e of await env.part("ellipsis").all()) {
        if ((await e.attr("tabindex")) !== null || (await e.attr("role")) !== null) {
          return "an ellipsis is focusable or has a role"
        }
      }
      return undefined
    },
  },
  {
    name: "pagination-disabled-link-no-href",
    check: async ({ env }) => {
      for (const d of ["first", "previous", "next", "last"] as const) {
        const p = env.part(d)
        if (!(await p.exists())) continue
        if ((await unavailable(p)) && (await p.attr("href")) !== null) {
          return `the unavailable ${d} link has an href`
        }
      }
      return undefined
    },
  },
]

/** Page numbers and "ellipsis", in DOM order (triggers left out). */
async function visiblePages(env: E): Promise<(number | "ellipsis")[]> {
  const out: (number | "ellipsis")[] = []
  for (const el of await env.part("list").withAttr("data-scope", "pagination").all()) {
    const part = await el.attr("data-part")
    if (part === "page") out.push(Number(await el.attr("data-value")))
    else if (part === "ellipsis") out.push("ellipsis")
  }
  return out
}

/** SET_PAGE's page per argument class: one that is visible from where the oracle is. */
const targetPage = (page: number) => {
  const total = paginationArgs.current.totalPages
  return page === 1 ? Math.min(total, 3) : 1
}

export const paginationContract = contract("pagination", {
  machine: paginationMachine,
  anatomy: ["root", "list", "item", "page", "ellipsis", "first", "previous", "next", "last"],
  locate: ({ name }: { readonly name: string | RegExp }) => ({ role: "navigation", name }),
  actions: {
    goTo: {
      pointer: async (env: E, n: number) => {
        await remember(env)
        await pageControl(env, n).click()
      },
      keyboard: async (env: E, n: number) => {
        await remember(env)
        const p = pageControl(env, n)
        if (!(await p.isFocused())) await p.focusWithTab()
        await p.press("Enter")
      },
      done: async (env: E, n: number) => (await currentPage(env)) === n,
    },
    next: trigger("next", (from) => from + 1),
    previous: trigger("previous", (from) => from - 1),
    first: trigger("first", () => 1),
    last: {
      ...activate((env) => env.part("last")),
      // The last page is the last number of the range (the total is always shown).
      done: async (env: E) => {
        const pages = (await visiblePages(env)).filter((p) => p !== "ellipsis")
        return (await currentPage(env)) === pages[pages.length - 1]
      },
    },
  },
  queries: {
    currentPage,
    visiblePages,
    isDisabled: async (env: E, control: PaginationDirection | number) =>
      unavailable(typeof control === "number" ? pageControl(env, control) : env.part(control)),
    href: async (env: E, n: number) => pageControl(env, n).attr("href"),
    /**
     * Whether a control has focus. Takes the control (not `focused()`): a query without
     * arguments is part of every observation, and focus moving is not a state change.
     */
    isFocused: async (env: E, control: PaginationDirection | number) =>
      (typeof control === "number" ? pageControl(env, control) : env.part(control)).isFocused(),
  },
  states: { idle: {} },
  events: {
    SET_PAGE: {
      action: "goTo",
      args: ((view: { values: { page?: number } }) => [targetPage(view.values.page ?? 1)]) as never,
      event: (view) => ({ page: targetPage(Number(view.values["page"] ?? 1)) }),
    },
    NEXT: "next",
    PREV: "previous",
    FIRST: "first",
    LAST: "last",
    SET_PAGE_SIZE: { skip: "set by the consumer's control; covered by $props:pageSize" },
    "COUNT.CHANGE": { skip: "emitted from props; covered by $props:count" },
    "$sync:page": { props: () => ({ page: 1 }) },
    "$sync:pageSize": { skip: "page size is the consumer's control; $props:pageSize covers it" },
    "$props:count": { props: () => ({ count: 11 }) },
    "$props:totalPages": { props: () => ({ totalPages: 2 }) },
    "$props:pageSize": { props: () => ({ pageSize: 25 }) },
    "$props:disabled": { props: () => ({ disabled: true }) },
  },
  traits: [],
  invariants: paginationInvariants,
})
