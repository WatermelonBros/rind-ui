import { contract, type Invariant } from "../../contract/contract"
import type { Env } from "../../contract/env"
import { stepperMachine } from "./stepper.machine"

type P =
  | "root"
  | "list"
  | "item"
  | "trigger"
  | "indicator"
  | "title"
  | "description"
  | "separator"
  | "content"
  | "prev-trigger"
  | "next-trigger"
  | "progress"
type E = Env<P>

const stepOf = async (env: E) => {
  for (const item of await env.part("item").all()) {
    if ((await item.attr("aria-current")) === "step") return Number(await item.attr("data-index"))
  }
  return -1
}
const triggerAt = async (env: E, index: number) => {
  for (const t of await env.part("trigger").all()) {
    if ((await t.attr("data-index")) === String(index)) return t
  }
  throw new Error(`stepper: no trigger at ${index}`)
}

/**
 * Stepper invariants (spec): one current item; an unreachable step is not a button; only the
 * current content is shown; no tab roles.
 */
const invariants: readonly Invariant<P>[] = [
  {
    name: "stepper-one-current",
    check: async ({ env }) => {
      let n = 0
      for (const item of await env.part("item").all()) {
        if ((await item.attr("aria-current")) === "step") n++
      }
      return n === 1 ? undefined : `${n} items are current`
    },
  },
  {
    name: "stepper-no-tabs",
    check: async ({ env }) => {
      for (const t of await env.part("trigger").all()) {
        const role = await t.attr("role")
        if (role === "tab") return "a trigger has role tab"
      }
      return undefined
    },
  },
  {
    name: "stepper-one-content-shown",
    check: async ({ env }) => {
      const contents = await env.part("content").all()
      if (contents.length === 0) return undefined
      let shown = 0
      for (const c of contents) if ((await c.attr("hidden")) === null) shown++
      return shown === 1 ? undefined : `${shown} contents are shown`
    },
  },
]

/** Stepper's contract (spec "Contract"): located by the Root's name. */
export const stepperContract = contract("stepper", {
  machine: stepperMachine,
  anatomy: [
    "root",
    "list",
    "item",
    "trigger",
    "indicator",
    "title",
    "description",
    "separator",
    "content",
    "prev-trigger",
    "next-trigger",
    "progress",
  ],
  locate: (anchor?: { readonly name: string | RegExp }) =>
    anchor ? { role: "group", name: anchor.name } : { part: "root" },
  actions: {
    next: {
      pointer: async (env) => env.part("next-trigger").click(),
      keyboard: async (env) => {
        await env.part("next-trigger").focus()
        await env.part("next-trigger").press("Enter")
      },
      done: async (): Promise<boolean> => true,
    },
    prev: {
      pointer: async (env) => env.part("prev-trigger").click(),
      keyboard: async (env) => {
        await env.part("prev-trigger").focus()
        await env.part("prev-trigger").press("Enter")
      },
      done: async (): Promise<boolean> => true,
    },
    select: {
      pointer: async (env, index: number) => (await triggerAt(env, index)).click(),
      keyboard: async (env, index: number) => {
        const t = await triggerAt(env, index)
        await t.focus()
        await t.press("Enter")
      },
      done: async (): Promise<boolean> => true,
    },
  },
  queries: {
    step: stepOf,
    count: async (env: E) => env.part("item").count(),
    status: async (env: E, index: number) =>
      (await (await triggerAt(env, index)).attr("data-status")) ?? "",
    reachable: async (env: E, index: number) =>
      (await (await triggerAt(env, index)).tagName()) === "button",
    focusInContent: async (env: E) => {
      for (const c of await env.part("content").all()) {
        if ((await c.attr("hidden")) === null) return c.isFocused()
      }
      return false
    },
  },
  states: { active: {} },
  events: {
    NEXT: "next",
    PREV: "prev",
    // Step 0 is always visited: the model's one select target. `as never`: the mapping's args
    // type is inferred across every action's union; `select` takes exactly `[index]`.
    SELECT: { action: "select", args: (() => [0]) as never, event: () => ({ index: 0 }) },
    "STEP.SYNCED": { skip: "the parent's step: the controlled DOM tests" },
    "$props:step": { skip: "the parent's step: the controlled DOM tests" },
  },
  traits: [],
  invariants,
  // `focusInContent` reads focus itself: focusing any focusable part changes it.
  commitsOnFocus: (["trigger", "content", "prev-trigger", "next-trigger"] as const).map((part) => ({
    part,
    state: "active" as const,
  })),
})
