import { contract, type Invariant } from "../../contract/contract"
import type { Env, Part } from "../../contract/env"
import { radioGroupMachine } from "./radio-group.machine"

type P =
  | "root"
  | "label"
  | "description"
  | "error-message"
  | "item"
  | "item-control"
  | "item-indicator"
  | "item-label"
  | "item-description"
  | "hidden-input"
type E = Env<P>

/**
 * The radio an item event acts on, per argument class (no value, first disabled, checked
 * disabled, …): contracts are static, so a model test sets it per configuration. `key` is
 * the item value, `label` its radio's accessible name.
 */
export const radioGroupArgs: { current: { readonly key: string; readonly label: string } } = {
  current: { key: "", label: "" },
}

const radio = (env: E, name: string | RegExp) => env.part("item-control", { role: "radio", name })
const controls = (env: E) => env.part("item-control").all()
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

/** Per-contract invariants (spec "Tab Stop And Focus"). */
export const radioGroupInvariants: readonly Invariant<P, string>[] = [
  {
    // Outside the group, Tab enters at the checked radio if it is enabled, else the first
    // enabled one (base-ui#1740, bits-ui#1568).
    name: "radio-group-tab-stop",
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

/** The Radio Group's contract (spec "Contract"). */
export const radioGroupContract = contract("radio-group", {
  machine: radioGroupMachine,
  anatomy: [
    "root",
    "label",
    "description",
    "error-message",
    "item",
    "item-control",
    "item-indicator",
    "item-label",
    "item-description",
    "hidden-input",
  ],
  locate: ({ name }: { readonly name: string | RegExp }) => ({ role: "radiogroup", name }),
  actions: {
    check: {
      pointer: async (env, name: string | RegExp) => radio(env, name).click(),
      touch: async (env, name: string | RegExp) => radio(env, name).tap(),
      // Into the group, then ArrowDown until it is checked (bounded: one cycle).
      keyboard: async (env, name: string | RegExp) => {
        const all = await controls(env)
        let stop: Part | undefined
        for (const c of all) if ((await c.attr("tabindex")) === "0") stop = c
        await (stop ?? radio(env, name)).focus()
        for (let i = 0; i <= all.length; i++) {
          const now = await checkedName(env)
          if (now !== null && (typeof name === "string" ? now === name : name.test(now))) return
          // Hosted by a toolbar, arrows only move: Space checks the radio once reached.
          if (await radio(env, name).isFocused()) {
            await radio(env, name).press("Space")
            return
          }
          await env.keyboard("ArrowDown")
        }
      },
      // Checked, unless the radio or the group ignores activation.
      done: async (env, name: string | RegExp) => {
        const now = await checkedName(env)
        const hit = now !== null && (typeof name === "string" ? now === name : name.test(now))
        return hit || (await inert(radio(env, name))) || (await groupInert(env))
      },
    },
    /** One activation of the radio (the PRESS mapping; `check` arrows for the driver). */
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
    focusRadio: {
      // Focus alone never checks (radix#938): Tab, a script, a dialog or the AT cursor.
      // Keyboard only: a pointer never focuses without pressing (that is PRESS).
      keyboard: async (env, name: string | RegExp) => radio(env, name).focus(),
      done: async () => true,
    },
    arrowNext: {
      keyboard: async (env) => env.keyboard("ArrowDown"),
      done: async () => true,
    },
    leave: {
      // Out of the group (a Tab): the story's button after it.
      keyboard: async (env) => env.find({ role: "button", name: "After" }).focus(),
      done: async () => true,
    },
  },
  queries: {
    radios: async (env) => {
      const out: string[] = []
      for (const c of await controls(env)) out.push(await c.accessibleName())
      return out
    },
    checked: checkedName,
    focusedRadio: async (env) => {
      const f = env.focused()
      if (!(await f.exists()) || (await f.attr("role")) !== "radio") return null
      return f.accessibleName()
    },
    isDisabled: async (env, name: string | RegExp) => inert(radio(env, name)),
    isReadOnly: async (env) => (await env.part("root").attr("aria-readonly")) === "true",
    isRequired: async (env) => (await env.part("root").attr("aria-required")) === "true",
    isInvalid: async (env) => (await env.part("root").attr("aria-invalid")) === "true",
    /** What the owning form would submit for the group (checked, enabled inputs). */
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
      args: (() => [radioGroupArgs.current.label]) as never,
      event: () => ({ key: radioGroupArgs.current.key }),
    },
    FOCUS: {
      action: "focusRadio",
      args: (() => [radioGroupArgs.current.label]) as never,
      event: () => ({ key: radioGroupArgs.current.key }),
    },
    NAVIGATE: { action: "arrowNext", event: () => ({ move: "next" }) },
    BLUR: "leave",
    "COLLECTION.CHANGE": { skip: "items are static parts: covered by the DOM tests" },
    "$props:collection": { skip: "items are static parts: covered by the DOM tests" },
    RESET: { skip: "a form reset is driven through the form: covered by the form tests" },
    "INDICATOR.MEASURE": { skip: "environment event: measured layout (Segmented Control)" },
  },
  traits: ["composite-roving", "selectable", "directional", "form-associated", "field-associated"],
  semantics: { item: "item-control" },
  invariants: radioGroupInvariants,
  // Focusing a radio enters the group and moves `focusedRadio`; it never checks one (a
  // check on focus fails the form-associated trait: the input disagrees with the oracle).
  commitsOnFocus: [
    { part: "item-control", state: "idle" },
    { part: "item-control", state: "focused" },
  ],
  formInput: {
    multiple: true,
    expected: (values, input) => ({ checked: values["value"] === input?.value }),
    // A reset (and a parent's change) dispatches no event.
    silentEvents: ["RESET"],
  },
})
