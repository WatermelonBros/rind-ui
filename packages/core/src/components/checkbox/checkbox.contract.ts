import { contract, type Invariant } from "../../contract/contract"
import type { Env } from "../../contract/env"
import { type CheckedState, checkboxMachine } from "./checkbox.machine"

type P = "root" | "control" | "indicator" | "label" | "description" | "hidden-input"
type E = Env<P>

const checkedState = async (env: E): Promise<CheckedState> => {
  const v = await env.part("control").attr("aria-checked")
  return v === "mixed" ? "indeterminate" : v === "true"
}
const isDisabled = async (env: E) => {
  const c = env.part("control")
  return (await c.attr("disabled")) !== null || (await c.attr("aria-disabled")) === "true"
}
const isReadOnly = async (env: E) => (await env.part("control").attr("aria-readonly")) === "true"

/** The state before a toggle, read by its postcondition (the runner is sequential). */
let beforeToggle: CheckedState | null = null
const toggleWith = (press: (env: E) => Promise<void>) => async (env: E) => {
  beforeToggle = await checkedState(env)
  await press(env)
}
const setTo = (want: boolean, press: (env: E) => Promise<void>) => async (env: E) => {
  if ((await checkedState(env)) !== want) await press(env)
}
const click = (env: E) => env.part("control").click()
const tap = (env: E) => env.part("control").tap()
const space = (env: E) => env.part("control").press("Space")

/** Per-contract invariants (spec "Checkbox Invariants"; the Enter one is a step invariant). */
export const checkboxInvariants: readonly Invariant<P, string>[] = [
  {
    name: "checkbox-aria-checked",
    check: async ({ env, state }) => {
      const want = state === "indeterminate" ? "mixed" : state === "checked" ? "true" : "false"
      const have = await env.part("control").attr("aria-checked")
      return have === want ? undefined : `aria-checked is "${have}" in ${state}, expected "${want}"`
    },
  },
  {
    name: "checkbox-one-checkbox",
    check: async ({ env }) => {
      const controls = await env.part("control").all()
      if (controls.length !== 1) return `${controls.length} controls rendered`
      return (await controls[0]?.attr("role")) === "checkbox"
        ? undefined
        : "the control has no role checkbox"
    },
  },
  {
    name: "checkbox-name-is-label",
    check: async ({ env }) => {
      const label = env.part("label")
      if ((await label.count()) === 0) return undefined
      // Inside a Field the Field's Label names it: compare only an own, non-field name.
      const text = (await label.text()).replace(/\s+/g, " ").trim()
      const name = await env.part("control").accessibleName()
      return name === text ? undefined : `the control is named "${name}", its Label says "${text}"`
    },
  },
]

/** The Checkbox's contract (spec "Contract"). */
export const checkboxContract = contract("checkbox", {
  machine: checkboxMachine,
  anatomy: ["root", "control", "indicator", "label", "description", "hidden-input"],
  locate: ({ name }: { readonly name: string | RegExp }) => ({ role: "checkbox", name }),
  actions: {
    toggle: {
      pointer: toggleWith(click),
      touch: toggleWith(tap),
      keyboard: toggleWith(space),
      // Changed, unless the Checkbox ignores activation.
      done: async (env) =>
        (await isDisabled(env)) ||
        (await isReadOnly(env)) ||
        (await checkedState(env)) !== beforeToggle,
    },
    check: {
      pointer: setTo(true, click),
      touch: setTo(true, tap),
      keyboard: setTo(true, space),
      done: { isChecked: true },
    },
    uncheck: {
      pointer: setTo(false, click),
      touch: setTo(false, tap),
      keyboard: setTo(false, space),
      done: { isChecked: false },
    },
    clickLabel: {
      pointer: async (env) => env.part("label").click(),
      none: {
        keyboard:
          "a label has no keyboard interaction; keyboard users toggle the Control with Space",
      },
      done: async () => true,
    },
    resetForm: {
      pointer: async (env) => env.find({ role: "button", name: "Reset" }).click(),
      keyboard: async (env) => env.find({ role: "button", name: "Reset" }).press("Enter"),
      // The default: the hidden input's `checked` attribute (an indeterminate default has none).
      done: async (env) => {
        const def = (await env.part("hidden-input").attr("checked")) !== null
        const now = await checkedState(env)
        return now === def || now === "indeterminate"
      },
    },
  },
  queries: {
    checkedState,
    isChecked: async (env) => (await checkedState(env)) === true,
    isIndeterminate: async (env) => (await checkedState(env)) === "indeterminate",
    isDisabled,
    isReadOnly,
    isRequired: async (env) => (await env.part("control").attr("aria-required")) === "true",
    isInvalid: async (env) => (await env.part("control").attr("aria-invalid")) === "true",
    name: async (env) => env.part("control").accessibleName(),
    description: async (env) => env.part("control").accessibleDescription(),
    /** What the hidden input would submit (properties), or null. */
    formValue: async (env) => {
      const input = env.part("hidden-input")
      if ((await input.attr("disabled")) !== null || !(await input.checked())) return null
      return input.value()
    },
  },
  states: {
    unchecked: { checkedState: false },
    checked: { checkedState: true },
    indeterminate: { checkedState: "indeterminate" },
  },
  attrs: {
    unchecked: { control: { "aria-checked": "false" } },
    checked: { control: { "aria-checked": "true" } },
    indeterminate: { control: { "aria-checked": "mixed" } },
  },
  dataState: {
    unchecked: {
      root: "unchecked",
      control: "unchecked",
      indicator: "unchecked",
      label: "unchecked",
      description: "unchecked",
    },
    checked: {
      root: "checked",
      control: "checked",
      indicator: "checked",
      label: "checked",
      description: "checked",
    },
    indeterminate: {
      root: "indeterminate",
      control: "indeterminate",
      indicator: "indeterminate",
      label: "indeterminate",
      description: "indeterminate",
    },
  },
  events: {
    TOGGLE: "toggle",
    RESET: "resetForm",
    FOCUS: { skip: "not a user event: focus alone changes no value (focus-does-not-commit)" },
    BLUR: { skip: "not a user event" },
    "$sync:checked": {
      props: (target) => {
        const checked: CheckedState =
          target === "indeterminate" ? "indeterminate" : target === "checked"
        return { checked }
      },
    },
  },
  traits: ["form-associated", "field-associated"],
  semantics: {},
  invariants: checkboxInvariants,
  formInput: {
    expected: (values) => ({
      checked: values["checked"] === true,
      indeterminate: values["checked"] === "indeterminate",
    }),
    // A reset (and a parent's change) dispatches no event.
    silentEvents: ["RESET"],
  },
})
