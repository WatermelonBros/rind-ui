import { contract, type Invariant } from "../../contract/contract"
import type { Env } from "../../contract/env"
import { collapsibleMachine } from "./collapsible.machine"

type P = "root" | "trigger" | "content" | "indicator"

const isOpen = async (env: Env<P>) => (await env.part("trigger").attr("aria-expanded")) === "true"

/** Per-contract invariants (spec "Contract"). */
export const collapsibleInvariants: readonly Invariant<P, string>[] = [
  {
    name: "collapsible-content-no-aria-hidden",
    check: async ({ env }) => {
      const content = env.part("content")
      if ((await content.count()) === 0) return undefined
      return (await content.attr("aria-hidden")) !== null
        ? "the content part carries aria-hidden (hidden content is hidden by `hidden`)"
        : undefined
    },
  },
  {
    name: "collapsible-aria-controls-iff-content",
    check: async ({ env }) => {
      const rendered = (await env.part("content").count()) > 0
      const controls = (await env.part("trigger").attr("aria-controls")) !== null
      return rendered === controls
        ? undefined
        : `the trigger ${controls ? "has" : "lacks"} aria-controls while the content is ${rendered ? "rendered" : "not rendered"}`
    },
  },
  {
    name: "collapsible-size-properties",
    check: async ({ env }) => {
      const content = env.part("content")
      if ((await content.count()) === 0) return undefined
      const style = (await content.attr("style")) ?? ""
      for (const axis of ["height", "width"]) {
        if (!style.includes(`--rind-collapsible-content-${axis}`)) {
          return `the content does not define --rind-collapsible-content-${axis}`
        }
      }
      return undefined
    },
  },
]

/** The Collapsible's contract (spec "Contract"). */
export const collapsibleContract = contract("collapsible", {
  machine: collapsibleMachine,
  anatomy: ["root", "trigger", "content", "indicator"],
  locate: ({ name }: { readonly name: string | RegExp }) => ({ role: "button", name }),
  actions: {
    open: {
      pointer: async (env) => {
        if (!(await isOpen(env))) await env.part("trigger").click()
      },
      keyboard: async (env) => {
        if (!(await isOpen(env))) await env.part("trigger").press("Enter")
      },
      done: { isOpen: true },
    },
    close: {
      pointer: async (env) => {
        if (await isOpen(env)) await env.part("trigger").click()
      },
      keyboard: async (env) => {
        if (await isOpen(env)) await env.part("trigger").press("Enter")
      },
      done: { isOpen: false },
    },
    toggle: {
      pointer: async (env) => env.part("trigger").click(),
      keyboard: async (env) => env.part("trigger").press("Enter"),
      done: async () => true,
    },
  },
  queries: {
    isOpen,
    isDisabled: async (env) => {
      const t = env.part("trigger")
      return (await t.attr("disabled")) !== null || (await t.attr("aria-disabled")) === "true"
    },
    contentText: async ({ part }) => {
      const c = part("content")
      return (await c.count()) > 0 ? c.text() : null
    },
    hiddenMode: async ({ part }) => {
      const c = part("content")
      if ((await c.count()) === 0) return "unmounted"
      const hidden = await c.attr("hidden")
      return hidden === null ? "visible" : hidden === "until-found" ? "until-found" : "hidden"
    },
  },
  states: { open: { isOpen: true }, closed: { isOpen: false } },
  dataState: { open: "open", closed: "closed" },
  attrs: {
    open: { trigger: { "aria-expanded": "true" } },
    closed: { trigger: { "aria-expanded": "false" } },
  },
  events: {
    TOGGLE: "toggle",
    // OPEN with reason "find-in-page" comes from the browser's search: not driven.
    OPEN: {
      skip: "find-in-page (beforematch) and the api: covered by the browser tests and $sync:open",
    },
    CLOSE: { skip: "the api: driven through the open prop ($sync:open)" },
    "$sync:open": { props: (target) => ({ open: target === "open" }) },
  },
  traits: ["disclosure", "presence"],
  semantics: { trigger: "trigger", content: "content" },
  invariants: collapsibleInvariants,
})
