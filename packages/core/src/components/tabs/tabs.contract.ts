import { contract, type Invariant } from "../../contract/contract"
import type { Env, Part } from "../../contract/env"
import { tabsMachine } from "./tabs.machine"

type P = "root" | "list" | "tab" | "panel" | "indicator"
type E = Env<P>

/** The tab an item event acts on, per argument class (set by a model test). */
export const tabsArgs: { current: { readonly key: string; readonly label: string } } = {
  current: { key: "", label: "" },
}

const tab = (env: E, name: string | RegExp) => env.part("tab", { role: "tab", name })
const tabs = (env: E) => env.part("tab").all()
const names = async (list: readonly Part[]) => {
  const out: string[] = []
  for (const p of list) out.push(await p.accessibleName())
  return out
}
const inert = async (p: Part) =>
  (await p.attr("disabled")) !== null || (await p.attr("aria-disabled")) === "true"
const vertical = async (env: E) => (await env.part("list").attr("aria-orientation")) === "vertical"

/** Arrows from the tab stop to `target` (bounded: one full cycle). */
async function arrowTo(env: E, target: Part) {
  const all = await tabs(env)
  let stop: Part | undefined
  for (const p of all) if ((await p.attr("tabindex")) === "0") stop = p
  if (!(stop ?? target) || !(await (stop ?? target).exists())) return
  if (!(await target.isFocused())) await (stop ?? target).focus()
  const key = (await vertical(env)) ? "ArrowDown" : "ArrowRight"
  for (let i = 0; i <= all.length && !(await target.isFocused()); i++) await env.keyboard(key)
}

/** Per-component invariants (spec "Roles And ARIA", "Panels"). */
export const tabsInvariants: readonly Invariant<P, string>[] = [
  {
    // A disabled tab is never the stop while an enabled one exists (react-spectrum#10633).
    name: "tabs-tab-stop",
    check: async ({ env, props }) => {
      if (props["focusableWhenDisabled"] === true) return undefined
      let stop: Part | undefined
      let enabled = false
      for (const t of await tabs(env)) {
        if ((await t.attr("tabindex")) === "0") stop = t
        if (!(await inert(t))) enabled = true
      }
      return stop && enabled && (await inert(stop))
        ? `the tab stop is the disabled tab "${await stop.accessibleName()}"`
        : undefined
    },
  },
  {
    // aria-controls only to a rendered panel (radix#1703), and the visible panel is the
    // selected tab's.
    name: "tabs-panels",
    check: async ({ env }) => {
      for (const t of await tabs(env)) {
        const id = await t.attr("aria-controls")
        if (id === null) continue
        const panel = env.part("panel").all()
        let found = false
        for (const p of await panel) if ((await p.attr("id")) === id) found = true
        if (!found) return `"${await t.accessibleName()}" controls a panel that is not rendered`
      }
      const visible: string[] = []
      for (const p of await env.part("panel").all()) {
        if ((await p.attr("hidden")) === null) visible.push((await p.attr("data-key")) ?? "")
      }
      if (visible.length > 1) return `${visible.length} panels are visible`
      let selected: string | null = null
      for (const t of await tabs(env)) {
        if ((await t.attr("aria-selected")) === "true") selected = await t.attr("data-key")
      }
      if (visible.length === 1 && visible[0] !== selected) {
        return `the visible panel is "${visible[0]}" but the selected tab is "${selected}"`
      }
      return undefined
    },
  },
]

/** The Tabs contract (spec "Contract"). */
export const tabsContract = contract("tabs", {
  machine: tabsMachine,
  anatomy: ["root", "list", "tab", "panel", "indicator"],
  locate: ({ name }: { readonly name: string | RegExp }) => ({ role: "tablist", name }),
  actions: {
    select: {
      pointer: async (env, name: string | RegExp) => tab(env, name).click(),
      touch: async (env, name: string | RegExp) => tab(env, name).tap(),
      // Arrows to the tab, then Enter (manual mode; automatic already selected it).
      keyboard: async (env, name: string | RegExp) => {
        const target = tab(env, name)
        await arrowTo(env, target)
        if ((await target.isFocused()) && (await target.attr("aria-selected")) !== "true") {
          await target.press("Enter")
        }
      },
      // Selected, unless the tab refuses it (disabled).
      done: async (env, name: string | RegExp) => {
        const t = tab(env, name)
        return (await inert(t)) || (await t.attr("aria-selected")) === "true"
      },
    },
    focusTab: {
      // Keyboard only: a pointer "focus" is a press, which is `select`.
      keyboard: async (env, name: string | RegExp) => arrowTo(env, tab(env, name)),
      done: async (env, name: string | RegExp) => {
        const t = tab(env, name)
        return (await inert(t)) || (await t.isFocused())
      },
    },
    /** One activation (the PRESS mapping). */
    press: {
      pointer: async (env, name: string | RegExp) => tab(env, name).click(),
      touch: async (env, name: string | RegExp) => tab(env, name).tap(),
      keyboard: async (env, name: string | RegExp) => {
        const t = tab(env, name)
        await t.focus()
        await t.press("Enter")
      },
      done: async () => true,
    },
    /** Focus alone (the FOCUS mapping): Tab, a script, a dialog or the AT cursor. */
    focus: {
      keyboard: async (env, name: string | RegExp) => tab(env, name).focus(),
      done: async () => true,
    },
    arrowNext: {
      keyboard: async (env) => env.keyboard((await vertical(env)) ? "ArrowDown" : "ArrowRight"),
      done: async () => true,
    },
    leave: {
      keyboard: async (env) => env.find({ role: "button", name: "After" }).focus(),
      done: async () => true,
    },
  },
  queries: {
    tabs: async (env) => names(await tabs(env)),
    selected: async (env) => {
      for (const t of await tabs(env)) {
        if ((await t.attr("aria-selected")) === "true") return t.accessibleName()
      }
      return null
    },
    focusedTab: async (env) => {
      const f = env.focused()
      if (!(await f.exists()) || (await f.attr("role")) !== "tab") return null
      return f.accessibleName()
    },
    panel: async (env) => {
      for (const p of await env.part("panel").all()) {
        if ((await p.attr("hidden")) === null) {
          return { name: await p.accessibleName(), text: await p.text() }
        }
      }
      return null
    },
    isDisabled: async (env, name: string | RegExp) => inert(tab(env, name)),
  },
  states: { idle: {}, focused: {} },
  events: {
    PRESS: {
      action: "press",
      // The mapping's args type misses the action's own arguments (text-field's gap).
      args: (() => [tabsArgs.current.label]) as never,
      event: () => ({ key: tabsArgs.current.key }),
    },
    FOCUS: {
      action: "focus",
      args: (() => [tabsArgs.current.label]) as never,
      event: () => ({ key: tabsArgs.current.key }),
    },
    NAVIGATE: { action: "arrowNext", event: () => ({ move: "next" }) },
    BLUR: "leave",
    INITIAL: { skip: "sent by the machine once the tabs register: covered by the DOM tests" },
    "find-in-page": { skip: "find-in-page is browser-driven; covered by browser tests" },
    "PANEL.TABBABLE": { skip: "environment event: DOM mutation" },
    "INDICATOR.MEASURE": { skip: "environment event: measured layout" },
    "COLLECTION.CHANGE": { skip: "tabs are static parts: covered by the DOM tests" },
    "$props:collection": { skip: "tabs are static parts: covered by the DOM tests" },
  },
  semantics: { item: "tab" },
  traits: ["composite-roving", "selectable", "directional"],
  // Focus enters the list (idle → focused) and moves focusedTab; it never selects (the
  // selectable invariant compares aria-selected with the oracle's value after each step).
  commitsOnFocus: [
    { part: "tab", state: "idle" },
    { part: "tab", state: "focused" },
    // A text-only panel and an all-disabled list are tab stops outside the tabs: focusing
    // them sends no FOCUS (the runner's what-if assumes one) and only leaves focusedTab.
    { part: "panel", state: "idle" },
    { part: "panel", state: "focused" },
    { part: "list", state: "idle" },
    { part: "list", state: "focused" },
  ],
  invariants: tabsInvariants,
})
