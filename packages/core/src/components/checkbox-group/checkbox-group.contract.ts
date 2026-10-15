import { contract, type Invariant } from "../../contract/contract"
import type { Env, Part } from "../../contract/env"
import { checkboxGroupMachine, parentStateOf } from "./checkbox-group.machine"

type P = "root" | "label" | "description" | "error-message"
type E = Env<P>

/** Item Controls (Checkbox parts inside the group's Root), the Parent excluded. */
const controls = async (env: E) => {
  const all = await env.part("root").scoped("checkbox", "control").all()
  const out: { part: Part; parent: boolean }[] = []
  for (const part of all) out.push({ part, parent: (await part.attr("data-parent")) !== null })
  return out
}
const items = async (env: E) => (await controls(env)).filter((c) => !c.parent).map((c) => c.part)
const parent = async (env: E) => (await controls(env)).find((c) => c.parent)?.part
const item = async (env: E, label: string | RegExp) => {
  for (const c of await items(env)) {
    const name = await c.accessibleName()
    if (typeof label === "string" ? name === label : label.test(name)) return c
  }
  throw new Error(`no item named ${String(label)} in the group`)
}
const value = async (env: E) => {
  const out: string[] = []
  for (const c of await items(env)) {
    if ((await c.attr("aria-checked")) === "true") out.push((await c.attr("data-value")) ?? "")
  }
  return out
}
const sameSet = (a: readonly string[], b: readonly string[]) =>
  a.length === b.length && a.every((v) => b.includes(v))

/** The item label the ITEM.TOGGLE mapping acts on: the first enabled item. */
export const checkboxGroupArgs: { current: { readonly item: string; readonly label: string } } = {
  current: { item: "", label: "" },
}

/** The value before an action, read by its postcondition (the runner is sequential). */
let before: readonly string[] = []

/** Per-contract invariants (design §6). */
export const checkboxGroupInvariants: readonly Invariant<P, string>[] = [
  {
    name: "checkbox-group-parent-state",
    check: async ({ env, props }) => {
      const p = await parent(env)
      if (!p) return undefined
      const all = (props["allValues"] as readonly string[] | undefined) ?? []
      const want = parentStateOf(await value(env), all)
      const aria = want === "indeterminate" ? "mixed" : want === "checked" ? "true" : "false"
      const have = await p.attr("aria-checked")
      return have === aria
        ? undefined
        : `the Parent's aria-checked is "${have}", expected "${aria}"`
    },
  },
]

/** The Checkbox Group's contract (spec "Contract"). */
export const checkboxGroupContract = contract("checkbox-group", {
  machine: checkboxGroupMachine,
  anatomy: ["root", "label", "description", "error-message"],
  locate: ({ name }: { readonly name: string | RegExp }) => ({ role: "group", name }),
  actions: {
    toggle: {
      pointer: async (env, label: string | RegExp) => {
        before = await value(env)
        await (await item(env, label)).click()
      },
      keyboard: async (env, label: string | RegExp) => {
        before = await value(env)
        await (await item(env, label)).press("Space")
      },
      // Changed, unless the item or the group ignores activation.
      done: async (env, label: string | RegExp) => {
        const c = await item(env, label)
        const inert =
          (await c.attr("disabled")) !== null ||
          (await c.attr("aria-disabled")) === "true" ||
          (await c.attr("aria-readonly")) === "true"
        return inert || !sameSet(await value(env), before)
      },
    },
    toggleParent: {
      pointer: async (env) => {
        before = await value(env)
        await (await parent(env))?.click()
      },
      keyboard: async (env) => {
        before = await value(env)
        await (await parent(env))?.press("Space")
      },
      done: async () => true,
    },
  },
  queries: {
    value,
    parentState: async (env) => {
      const p = await parent(env)
      const a = p ? await p.attr("aria-checked") : null
      return a === "mixed" ? "mixed" : a === "true" ? "checked" : "unchecked"
    },
    isDisabled: async (env) => (await env.part("root").attr("data-disabled")) !== null,
    isRequired: async (env) => (await env.part("root").attr("data-required")) !== null,
    isInvalid: async (env) => (await env.part("root").attr("data-invalid")) !== null,
  },
  states: { ready: {} },
  events: {
    "ITEM.TOGGLE": {
      action: "toggle",
      // The mapping's args type misses the action's own arguments (text-field's gap).
      args: (() => [checkboxGroupArgs.current.label]) as never,
      event: (view) => ({
        value: checkboxGroupArgs.current.item,
        checked: !((view.values["value"] as readonly string[] | undefined) ?? []).includes(
          checkboxGroupArgs.current.item,
        ),
      }),
    },
    "PARENT.TOGGLE": "toggleParent",
    "ITEM.REGISTER": { skip: "sent by each item on mount" },
    "ITEM.UNREGISTER": { skip: "sent by each item on unmount" },
    RESET: { skip: "a form reset: covered by the browser tests" },
  },
  traits: ["form-associated", "field-associated"],
  semantics: {},
  invariants: checkboxGroupInvariants,
  formInput: {
    multiple: true,
    expected: (values, input) => ({
      checked: ((values["value"] as readonly string[] | undefined) ?? []).includes(
        input?.value ?? "",
      ),
    }),
    // A Parent toggle and a reset change items without the user toggling them.
    silentEvents: ["PARENT.TOGGLE", "RESET"],
  },
})
