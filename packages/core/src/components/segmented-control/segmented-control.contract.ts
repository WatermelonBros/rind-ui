import { contract, type Invariant } from "../../contract/contract"
import type { Env, Part } from "../../contract/env"
import { radioGroupMachine } from "../radio-group/radio-group.machine"

type P = "root" | "label" | "item" | "indicator" | "hidden-input"
type E = Env<P>

/** The segment an item event acts on, per argument class (set by a model test). */
export const segmentedControlArgs: { current: { readonly key: string; readonly label: string } } = {
  current: { key: "", label: "" },
}

const radio = (env: E, name: string | RegExp) => env.part("item", { role: "radio", name })
const controls = (env: E) => env.part("item").all()
const checkedName = async (env: E) => {
  for (const c of await controls(env)) {
    if ((await c.attr("aria-checked")) === "true") return c.accessibleName()
  }
  return null
}
const inert = async (c: Part) =>
  (await c.attr("disabled")) !== null || (await c.attr("aria-disabled")) === "true"
const groupInert = async (env: E) =>
  (await env.part("root").attr("aria-readonly")) === "true" ||
  (await env.part("root").attr("aria-disabled")) === "true"

/** Radio Group's tab-stop rule (spec "Radio Semantics And Behaviour"). */
export const segmentedControlInvariants: readonly Invariant<P, string>[] = [
  {
    // Outside the group, Tab enters at the checked radio if it is enabled, else the first
    // enabled one (base-ui#1740, bits-ui#1568).
    name: "segmented-control-tab-stop",
    check: async ({ env }) => {
      const focused = env.focused()
      if ((await focused.exists()) && (await focused.attr("role")) === "radio") return undefined
      const all = await controls(env)
      let checked: Part | undefined
      let firstEnabled: Part | undefined
      let stop: Part | undefined
      for (const c of all) {
        const enabled = !(await inert(c))
        if (enabled && !firstEnabled) firstEnabled = c
        if (enabled && (await c.attr("aria-checked")) === "true") checked = c
        if ((await c.attr("tabindex")) === "0") stop = c
      }
      const want = checked ?? firstEnabled
      if (!want || !stop) return undefined
      const [have, expected] = [await stop.accessibleName(), await want.accessibleName()]
      return have === expected ? undefined : `the tab stop is "${have}", expected "${expected}"`
    },
  },
]

/** The Segmented Control's contract (spec "Contract"). */
export const segmentedControlContract = contract("segmented-control", {
  machine: radioGroupMachine,
  anatomy: ["root", "label", "item", "indicator", "hidden-input"],
  locate: ({ name }: { readonly name: string | RegExp }) => ({ role: "radiogroup", name }),
  actions: {
    select: {
      pointer: async (env, name: string | RegExp) => radio(env, name).click(),
      touch: async (env, name: string | RegExp) => radio(env, name).tap(),
      // Into the control, then ArrowRight until it is selected (bounded: one cycle).
      keyboard: async (env, name: string | RegExp) => {
        const all = await controls(env)
        let stop: Part | undefined
        for (const c of all) if ((await c.attr("tabindex")) === "0") stop = c
        await (stop ?? radio(env, name)).focus()
        for (let i = 0; i <= all.length; i++) {
          const now = await checkedName(env)
          if (now !== null && (typeof name === "string" ? now === name : name.test(now))) return
          await env.keyboard("ArrowRight")
        }
      },
      // Selected, unless the segment or the control ignores activation.
      done: async (env, name: string | RegExp) => {
        const now = await checkedName(env)
        const hit = now !== null && (typeof name === "string" ? now === name : name.test(now))
        return hit || (await inert(radio(env, name))) || (await groupInert(env))
      },
    },
    /** One activation (the PRESS mapping; `select` arrows for the driver). */
    press: {
      pointer: async (env, name: string | RegExp) => radio(env, name).click(),
      touch: async (env, name: string | RegExp) => radio(env, name).tap(),
      keyboard: async (env, name: string | RegExp) => {
        const r = radio(env, name)
        await r.focus()
        await r.press("Space")
      },
      done: async () => true,
    },
    focusSegment: {
      // Focus alone never selects: Tab, a script, a dialog or the AT cursor.
      keyboard: async (env, name: string | RegExp) => radio(env, name).focus(),
      done: async () => true,
    },
    arrowNext: {
      keyboard: async (env) => env.keyboard("ArrowRight"),
      done: async () => true,
    },
    leave: {
      keyboard: async (env) => env.find({ role: "button", name: "After" }).focus(),
      done: async () => true,
    },
  },
  queries: {
    segments: async (env) => {
      const out: string[] = []
      for (const c of await controls(env)) out.push(await c.accessibleName())
      return out
    },
    selected: checkedName,
    focusedSegment: async (env) => {
      const f = env.focused()
      if (!(await f.exists()) || (await f.attr("role")) !== "radio") return null
      return f.accessibleName()
    },
    isDisabled: async (env, name: string | RegExp) => inert(radio(env, name)),
    /** What the owning form would submit (the checked, enabled input). */
    formValue: async (env) => {
      const out: [string, string][] = []
      for (const input of await env.part("hidden-input").all()) {
        if ((await input.attr("disabled")) !== null || !(await input.checked())) continue
        out.push([(await input.attr("name")) ?? "", await input.value()])
      }
      return out
    },
  },
  states: { idle: {}, focused: {} },
  events: {
    PRESS: {
      action: "press",
      // The mapping's args type misses the action's own arguments (text-field's gap).
      args: (() => [segmentedControlArgs.current.label]) as never,
      event: () => ({ key: segmentedControlArgs.current.key }),
    },
    FOCUS: {
      action: "focusSegment",
      args: (() => [segmentedControlArgs.current.label]) as never,
      event: () => ({ key: segmentedControlArgs.current.key }),
    },
    NAVIGATE: { action: "arrowNext", event: () => ({ move: "next" }) },
    BLUR: "leave",
    "COLLECTION.CHANGE": { skip: "segments are static parts: covered by the DOM tests" },
    "$props:collection": { skip: "segments are static parts: covered by the DOM tests" },
    RESET: { skip: "a form reset is driven through the form: covered by the form tests" },
    "INDICATOR.MEASURE": { skip: "environment event: measured layout (browser tests)" },
  },
  traits: ["composite-roving", "selectable", "directional", "form-associated"],
  semantics: { item: "item" },
  invariants: segmentedControlInvariants,
  // Focusing a segment enters the control and moves focusedSegment; it never selects (the
  // form-associated and selectable invariants compare with the oracle's value).
  commitsOnFocus: [
    { part: "item", state: "idle" },
    { part: "item", state: "focused" },
  ],
  formInput: {
    multiple: true,
    expected: (values, input) => ({ checked: values["value"] === input?.value }),
    silentEvents: ["RESET"],
  },
})
