import { contract, type Invariant } from "../../contract/contract"
import type { Env } from "../../contract/env"
import { passwordInputMachine } from "./password-input.machine"

type P =
  | "root"
  | "label"
  | "description"
  | "error-message"
  | "input"
  | "visibility-trigger"
  | "indicator"
type E = Env<P>

const isVisible = async (env: E) =>
  (await env.part("visibility-trigger").attr("aria-pressed")) === "true"

/** The trigger's first name, per run (a run's env is its own object). */
const firstName = new WeakMap<object, string>()

/** Password Input invariants (spec "Password Input Invariants"), checked after every step. */
export const passwordInputInvariants: readonly Invariant<P, string>[] = [
  {
    name: "password-input-type-follows-visible",
    check: async ({ env, values }) => {
      const type = await env.part("input").attr("type")
      const expected = values["visible"] === true ? "text" : "password"
      return type === expected ? undefined : `the input is type="${type}" (expected ${expected})`
    },
  },
  {
    name: "password-input-pressed-follows-visible",
    check: async ({ env, values }) => {
      const trigger = env.part("visibility-trigger")
      if (!(await trigger.exists())) return undefined
      const pressed = await trigger.attr("aria-pressed")
      return pressed === String(values["visible"] === true)
        ? undefined
        : `the trigger has aria-pressed="${pressed}" while visible is ${values["visible"]}`
    },
  },
  {
    name: "password-input-stable-name",
    check: async ({ env }) => {
      const trigger = env.part("visibility-trigger")
      if (!(await trigger.exists())) return undefined
      const now = await trigger.accessibleName()
      const first = firstName.get(env)
      if (first === undefined) {
        firstName.set(env, now)
        return undefined
      }
      return now === first
        ? undefined
        : `the trigger's name changed from "${first}" to "${now}" (aria-pressed carries the state)`
    },
  },
  {
    // No keyboard alternative exists (WCAG 2.1.1), unlike Text Field's ClearTrigger.
    name: "password-input-trigger-in-tab-order",
    check: async ({ env }) => {
      const trigger = env.part("visibility-trigger")
      if (!(await trigger.exists()) || (await trigger.attr("disabled")) !== null) return undefined
      const tabindex = await trigger.attr("tabindex")
      return tabindex !== null && Number(tabindex) < 0
        ? `the trigger has tabindex="${tabindex}" (it must be in the Tab order)`
        : undefined
    },
  },
  {
    name: "password-input-no-spellcheck",
    check: async ({ env }) =>
      (await env.part("input").attr("spellcheck")) === "false"
        ? undefined
        : "the input is spell-checked (revealed text would reach spellcheck services)",
  },
]

/** The Password Input's contract (spec "Contract"). */
export const passwordInputContract = contract("password-input", {
  machine: passwordInputMachine,
  anatomy: [
    "root",
    "label",
    "description",
    "error-message",
    "input",
    "visibility-trigger",
    "indicator",
  ],
  // A password input has no ARIA role: its label names it.
  locate: ({ name }: { readonly name: string | RegExp }) => ({ label: name }),
  actions: {
    type: {
      pointer: async (env: E, text: string) => {
        await env.part("input").click()
        await env.part("input").type(text)
      },
      keyboard: async (env: E, text: string) => env.part("input").type(text),
      done: async () => true,
    },
    fill: {
      keyboard: async (env: E, text: string) => {
        const input = env.part("input")
        await input.press("A", { mod: true })
        await input.type(text)
      },
      done: async () => true,
    },
    clear: {
      keyboard: async (env: E) => {
        const input = env.part("input")
        await input.press("A", { mod: true })
        await input.press("Backspace")
      },
      done: { value: "" },
    },
    compose: {
      keyboard: async (env: E, text: string, committed: string) =>
        env.part("input").compose(
          [...text].map((_, i) => text.slice(0, i + 1)),
          committed,
        ),
      done: async () => true,
    },
    composeOpen: {
      keyboard: async (env: E, text: string) =>
        env.part("input").compose([...text].map((_, i) => text.slice(0, i + 1))),
      done: { isComposing: true },
    },
    composeEnd: {
      keyboard: async (env: E, committed: string) => env.part("input").compose([], committed),
      done: { isComposing: false },
    },
    blur: {
      keyboard: async (env: E) => {
        const input = env.part("input")
        if (!(await input.isFocused())) await input.focus()
        await env.keyboard("Tab")
      },
      done: async () => true,
    },
    toggleVisibility: {
      pointer: async (env: E) => env.part("visibility-trigger").click(),
      touch: async (env: E) => env.part("visibility-trigger").tap(),
      keyboard: async (env: E) => {
        const trigger = env.part("visibility-trigger")
        await trigger.focus()
        await trigger.press("Space")
      },
      done: async () => true,
    },
    submitForm: {
      pointer: async (env: E) => env.find({ role: "button", name: "Submit" }).click(),
      keyboard: async (env: E) => env.find({ role: "button", name: "Submit" }).press("Enter"),
      done: { isVisible: false },
    },
    resetForm: {
      pointer: async (env: E) => env.find({ role: "button", name: "Reset" }).click(),
      keyboard: async (env: E) => env.find({ role: "button", name: "Reset" }).press("Enter"),
      done: async () => true,
    },
  },
  queries: {
    value: async (env: E) => env.part("input").value(),
    isVisible: async (env: E) => isVisible(env),
    inputType: async (env: E) => env.part("input").attr("type"),
    toggleName: async (env: E) => env.part("visibility-trigger").accessibleName(),
    isInvalid: async (env: E) => (await env.part("input").attr("aria-invalid")) === "true",
    isDisabled: async (env: E) => {
      const input = env.part("input")
      return (
        (await input.attr("disabled")) !== null || (await input.attr("aria-disabled")) === "true"
      )
    },
    isComposing: async (env: E) => (await env.part("input").attr("data-composing")) !== null,
  },
  states: { idle: { isComposing: false }, composing: { isComposing: true } },
  events: {
    INPUT: { action: "type", args: (() => ["x"]) as never },
    CLEAR: { skip: "the ClearTrigger is Text Field's, covered by its contract" },
    "COMPOSITION.START": { action: "composeOpen", args: (() => ["かな"]) as never },
    "COMPOSITION.END": { action: "composeEnd", args: (() => ["かな"]) as never },
    RESET: "resetForm",
    FOCUS: { skip: "covered by every action" },
    BLUR: { skip: "covered by every action" },
    "VISIBILITY.TOGGLE": "toggleVisibility",
    "VISIBILITY.HIDE": "submitForm",
  },
  traits: ["field-associated"],
  invariants: passwordInputInvariants,
})
