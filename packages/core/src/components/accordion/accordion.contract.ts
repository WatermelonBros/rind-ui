import { contract, type Invariant } from "../../contract/contract"
import type { Env, Part } from "../../contract/env"
import { accordionMachine, isLocked } from "./accordion.machine"

type P = "root" | "item" | "header" | "trigger" | "content" | "indicator"
type E = Env<P>

/**
 * The item an item event is produced on, per argument class (the first item, another item,
 * a disabled item): contracts are static, so a model test sets it per configuration. `item`
 * is the item's value, `label` its trigger's accessible name.
 */
export const accordionArgs: { current: { readonly item: string; readonly label: string } } = {
  current: { item: "", label: "" },
}

const trigger = (env: E, label: string | RegExp) =>
  env.part("trigger", { role: "button", name: label })
const expanded = async (t: Part) => (await t.attr("aria-expanded")) === "true"
const contentOf = async (env: E, label: string | RegExp): Promise<Part | undefined> => {
  const id = await trigger(env, label).attr("aria-controls")
  if (id === null) return undefined
  for (const c of await env.part("content").all()) if ((await c.attr("id")) === id) return c
  return undefined
}
/** Focus on the named trigger first, unless a trigger already has it. */
const fromTrigger = async (env: E) => {
  const focused = env.focused()
  if (!(await focused.exists()) || (await focused.attr("data-part")) !== "trigger") {
    await trigger(env, accordionArgs.current.label).focus()
  }
}
const horizontal = async (env: E) =>
  (await env.part("root").attr("data-orientation")) === "horizontal"

/** Per-contract invariants (spec "Contract"). */
export const accordionInvariants: readonly Invariant<P, string>[] = [
  {
    name: "accordion-single-at-most-one",
    check: async ({ env, props }) => {
      if (props["multiple"] === true) return undefined
      let n = 0
      for (const t of await env.part("trigger").all()) if (await expanded(t)) n += 1
      return n > 1 ? `${n} triggers are expanded in single mode` : undefined
    },
  },
  {
    name: "accordion-lock",
    check: async ({ env, props }) => {
      if (!isLocked(props)) return undefined
      for (const t of await env.part("trigger").all()) {
        if ((await expanded(t)) && (await t.attr("aria-disabled")) !== "true") {
          return `the open trigger "${await t.accessibleName()}" is not aria-disabled while locked`
        }
      }
      return undefined
    },
  },
  {
    name: "accordion-heading",
    // Every trigger sits in a header exposed as a heading with a level. "The only element
    // child" is the header's development warning (Part has no child access).
    check: async ({ env }) => {
      const inHeading = new Set<string>()
      for (const h of await env.part("header").all()) {
        const tag = await h.tagName()
        const heading = /^h[1-6]$/.test(tag) || (await h.attr("role")) === "heading"
        const level = /^h[1-6]$/.test(tag) || (await h.attr("aria-level")) !== null
        if (!heading || !level) continue
        for (const t of await h.scoped("accordion", "trigger").all()) {
          inHeading.add(await t.accessibleName())
        }
      }
      for (const t of await env.part("trigger").all()) {
        const name = await t.accessibleName()
        if (!inHeading.has(name)) return `the trigger of item "${name}" is not inside a heading`
      }
      return undefined
    },
  },
  {
    name: "accordion-region-rule",
    check: async ({ env, props }) => {
      const triggers = await env.part("trigger").all()
      const role = props["contentRole"]
      const region =
        role !== undefined ? role === "region" : props["multiple"] !== true || triggers.length <= 6
      for (const t of triggers) {
        const id = await t.attr("aria-controls")
        if (id === null) continue
        let c: Part | undefined
        for (const x of await env.part("content").all()) if ((await x.attr("id")) === id) c = x
        if (!c) continue
        const name = await t.accessibleName()
        const open = await expanded(t)
        const has = (await c.attr("role")) === "region"
        if (open && region !== has) {
          return `the open content of "${name}" ${has ? "is" : "is not"} a region against the region rule`
        }
        if (!open && (await c.attr("role")) !== null)
          return `the closed content of "${name}" has a role`
        if (has && (await c.attr("aria-labelledby")) !== (await t.attr("id"))) {
          return `the region of "${name}" is not labelled by its trigger`
        }
      }
      return undefined
    },
  },
]

/** The Accordion's contract (spec "Contract"). */
export const accordionContract = contract("accordion", {
  machine: accordionMachine,
  anatomy: ["root", "item", "header", "trigger", "content", "indicator"],
  locate: ({ item }: { readonly item: string | RegExp }) => ({ role: "button", name: item }),
  actions: {
    expand: {
      pointer: async (env, label: string | RegExp) => {
        const t = trigger(env, label)
        if (!(await expanded(t))) await t.click()
      },
      keyboard: async (env, label: string | RegExp) => {
        const t = trigger(env, label)
        if (!(await expanded(t))) await t.press("Enter")
      },
      done: async (env, label: string | RegExp) => expanded(trigger(env, label)),
    },
    collapse: {
      pointer: async (env, label: string | RegExp) => {
        const t = trigger(env, label)
        if (await expanded(t)) await t.click()
      },
      keyboard: async (env, label: string | RegExp) => {
        const t = trigger(env, label)
        if (await expanded(t)) await t.press("Enter")
      },
      // A locked item stays open (non-collapsible single mode).
      done: async (env, label: string | RegExp) => {
        const t = trigger(env, label)
        return !(await expanded(t)) || (await t.attr("aria-disabled")) === "true"
      },
    },
    toggle: {
      pointer: async (env, label: string | RegExp) => trigger(env, label).click(),
      keyboard: async (env, label: string | RegExp) => trigger(env, label).press("Enter"),
      done: async () => true,
    },
    // Keyboard navigation between triggers: no pointer twin exists (a pointer moves focus by
    // pressing the trigger itself, which toggles it).
    focusNext: {
      keyboard: async (env) => {
        await fromTrigger(env)
        await env.keyboard((await horizontal(env)) ? "ArrowRight" : "ArrowDown")
      },
      done: async () => true,
    },
    focusPrev: {
      keyboard: async (env) => {
        await fromTrigger(env)
        await env.keyboard((await horizontal(env)) ? "ArrowLeft" : "ArrowUp")
      },
      done: async () => true,
    },
    focusFirst: {
      keyboard: async (env) => {
        await fromTrigger(env)
        await env.keyboard("Home")
      },
      done: async () => true,
    },
    focusLast: {
      keyboard: async (env) => {
        await fromTrigger(env)
        await env.keyboard("End")
      },
      done: async () => true,
    },
  },
  queries: {
    /** Labels of the expanded triggers, in document order. */
    expanded: async (env) => {
      const out: string[] = []
      for (const t of await env.part("trigger").all()) {
        if (await expanded(t)) out.push(await t.accessibleName())
      }
      return out
    },
    items: async (env) => {
      const out: string[] = []
      for (const t of await env.part("trigger").all()) out.push(await t.accessibleName())
      return out
    },
    isDisabled: async (env, label: string | RegExp) => {
      const t = trigger(env, label)
      return (await t.attr("disabled")) !== null || (await t.attr("aria-disabled")) === "true"
    },
    contentText: async (env, label: string | RegExp) => {
      const c = await contentOf(env, label)
      return c ? c.text() : null
    },
  },
  states: { idle: {} },
  events: {
    "ITEM.TOGGLE": {
      action: "toggle",
      // The mapping's args type misses the action's own arguments (text-field has the same
      // gap): toggle takes the label, which is what this returns.
      args: (() => [accordionArgs.current.label]) as never,
      event: () => ({ item: accordionArgs.current.item }),
    },
    "ITEM.OPEN": { skip: "find-in-page (beforematch) and the api: covered by the browser tests" },
    "ITEM.CLOSE": { skip: "the api: driven through the value prop" },
    "ITEM.REGISTER": { skip: "sent by each item on mount" },
    "ITEM.UNREGISTER": { skip: "sent by each item on unmount" },
    "FOCUS.NEXT": { action: "focusNext", event: () => ({ from: accordionArgs.current.item }) },
    "FOCUS.PREV": { action: "focusPrev", event: () => ({ from: accordionArgs.current.item }) },
    "FOCUS.FIRST": { action: "focusFirst", event: () => ({ from: accordionArgs.current.item }) },
    "FOCUS.LAST": { action: "focusLast", event: () => ({ from: accordionArgs.current.item }) },
  },
  traits: ["disclosure", "presence", "directional"],
  semantics: { trigger: "trigger", content: "content" },
  invariants: accordionInvariants,
})
