import { contract, type Invariant } from "../../contract/contract"
import type { Env } from "../../contract/env"
import { switchMachine } from "./switch.machine"

type P = "root" | "control" | "thumb" | "label" | "description" | "hidden-input"
type E = Env<P>

const isChecked = async (env: E) => (await env.part("control").attr("aria-checked")) === "true"
const isDisabled = async (env: E) => {
  const c = env.part("control")
  return (await c.attr("disabled")) !== null || (await c.attr("aria-disabled")) === "true"
}
const isReadOnly = async (env: E) => (await env.part("control").attr("aria-readonly")) === "true"

/** The value before a toggle, read by its postcondition (the runner is sequential). */
let before = false
const toggleWith = (press: (env: E) => Promise<void>) => async (env: E) => {
  before = await isChecked(env)
  await press(env)
}

/** Per-contract invariants (spec "Switch Invariants"; name stability is a step invariant). */
export const switchInvariants: readonly Invariant<P, string>[] = [
  {
    name: "switch-aria-checked",
    check: async ({ env, state }) => {
      const have = await env.part("control").attr("aria-checked")
      const want = state === "checked" ? "true" : "false"
      return have === want
        ? undefined
        : `the control's aria-checked is "${have}" in ${state}, expected "${want}" (never "mixed")`
    },
  },
  {
    name: "switch-thumb-hidden",
    check: async ({ env }) => {
      const thumb = env.part("thumb")
      if ((await thumb.count()) === 0) return undefined
      return (await thumb.attr("aria-hidden")) === "true"
        ? undefined
        : "the thumb is not aria-hidden"
    },
  },
]

/** The Switch's contract (spec "Contract"). */
export const switchContract = contract("switch", {
  machine: switchMachine,
  anatomy: ["root", "control", "thumb", "label", "description", "hidden-input"],
  locate: ({ name }: { readonly name: string | RegExp }) => ({ role: "switch", name }),
  actions: {
    toggle: {
      pointer: toggleWith((env) => env.part("control").click()),
      touch: toggleWith((env) => env.part("control").tap()),
      keyboard: toggleWith((env) => env.part("control").press("Space")),
      done: async (env) =>
        (await isDisabled(env)) || (await isReadOnly(env)) || (await isChecked(env)) !== before,
    },
    clickLabel: {
      pointer: async (env) => env.part("label").click(),
      none: { keyboard: "the Label has no keyboard path; keyboard users toggle the Control" },
      done: async () => true,
    },
    resetForm: {
      pointer: async (env) => env.find({ role: "button", name: "Reset" }).click(),
      keyboard: async (env) => env.find({ role: "button", name: "Reset" }).press("Enter"),
      // The default: the hidden input's `checked` attribute.
      done: async (env) =>
        (await isChecked(env)) === ((await env.part("hidden-input").attr("checked")) !== null),
    },
  },
  queries: {
    isChecked,
    isDisabled,
    isReadOnly,
    isRequired: async (env) => (await env.part("control").attr("aria-required")) === "true",
    isInvalid: async (env) => (await env.part("control").attr("aria-invalid")) === "true",
    name: async (env) => env.part("control").accessibleName(),
    /** What the hidden input would submit (properties), or null. */
    formValue: async (env) => {
      const input = env.part("hidden-input")
      if ((await input.attr("disabled")) !== null || !(await input.checked())) return null
      return input.value()
    },
  },
  states: { unchecked: { isChecked: false }, checked: { isChecked: true } },
  attrs: {
    unchecked: { control: { "aria-checked": "false" } },
    checked: { control: { "aria-checked": "true" } },
  },
  dataState: {
    unchecked: { root: "unchecked", control: "unchecked", thumb: "unchecked", label: "unchecked" },
    checked: { root: "checked", control: "checked", thumb: "checked", label: "checked" },
  },
  events: {
    TOGGLE: "toggle",
    RESET: "resetForm",
    FOCUS: { skip: "not a user event: focus alone changes no value (focus-does-not-commit)" },
    BLUR: { skip: "not a user event" },
    "$sync:checked": { props: (target) => ({ checked: target === "checked" }) },
  },
  traits: ["form-associated", "field-associated"],
  semantics: {},
  invariants: switchInvariants,
  formInput: {
    expected: (values) => ({ checked: values["checked"] === true, indeterminate: false }),
    silentEvents: ["RESET"],
  },
})
