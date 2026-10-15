import { contract, type Invariant } from "../../contract/contract"
import type { Env } from "../../contract/env"
import type { AnyMachine } from "../../machine/types"
import { textFieldMachine } from "./text-field.machine"

type P =
  | "root"
  | "label"
  | "description"
  | "error-message"
  | "input"
  | "textarea"
  | "clear-trigger"
  | "character-count"

/** The control: the Input, else the Textarea. */
async function control(env: Env<P>) {
  const input = env.part("input")
  return (await input.exists()) ? input : env.part("textarea")
}

/** Text Field invariants that need no oracle value (spec "Text Field Invariants"). */
export const textFieldInvariants: readonly Invariant<P, string>[] = [
  {
    name: "text-field-one-textbox",
    check: async ({ env }) => {
      const n = (await env.part("input").count()) + (await env.part("textarea").count())
      return n === 1 ? undefined : `${n} input/textarea parts are rendered (exactly one expected)`
    },
  },
  {
    name: "text-field-clear-trigger-when-clearable",
    check: async ({ env }) => {
      const c = await control(env)
      if (!(await c.exists())) return undefined
      const editable =
        (await c.attr("disabled")) === null &&
        (await c.attr("readonly")) === null &&
        (await c.attr("aria-disabled")) !== "true"
      const clearable = editable && (await c.value()) !== ""
      const rendered = (await env.part("clear-trigger").count()) > 0
      // Only checked when the story renders a ClearTrigger part at all (clearable or not).
      if (rendered && !clearable)
        return "a ClearTrigger is rendered while the field is not clearable"
      return undefined
    },
  },
]

/** The contract for a Text Field or a preset's scope (spec "Contract"). */
export function textFieldContractFor<M extends AnyMachine>(scope: string, machine: M) {
  return contract(scope, {
    machine: machine as typeof textFieldMachine,
    anatomy: [
      "root",
      "label",
      "description",
      "error-message",
      "input",
      "textarea",
      "clear-trigger",
      "character-count",
    ],
    locate: ({ name }: { readonly name: string | RegExp }) => ({ role: "textbox", name }),
    actions: {
      type: {
        pointer: async (env, text: string) => {
          const c = await control(env)
          await c.click()
          await c.type(text)
        },
        keyboard: async (env, text: string) => (await control(env)).type(text),
        done: async () => true,
      },
      fill: {
        keyboard: async (env, text: string) => {
          const c = await control(env)
          await c.press("A", { mod: true })
          await c.type(text)
        },
        done: async () => true,
      },
      clear: {
        // A refused Clear (read-only, disabled) has no ClearTrigger to press.
        pointer: async (env) => {
          const trigger = env.part("clear-trigger")
          if (await trigger.exists()) await trigger.click()
        },
        keyboard: async (env) => {
          const c = await control(env)
          await c.press("A", { mod: true })
          await c.press("Backspace")
        },
        done: { value: "" },
      },
      compose: {
        keyboard: async (env, text: string, committed: string) =>
          (await control(env)).compose(
            [...text].map((_, i) => text.slice(0, i + 1)),
            committed,
          ),
        done: async () => true,
      },
      /** Opens a composition (stays composing): the model's COMPOSITION.START. */
      composeOpen: {
        keyboard: async (env, text: string) =>
          (await control(env)).compose([...text].map((_, i) => text.slice(0, i + 1))),
        done: { isComposing: true },
      },
      /** Commits the open composition: the model's COMPOSITION.END. */
      composeEnd: {
        keyboard: async (env, committed: string) => (await control(env)).compose([], committed),
        done: { isComposing: false },
      },
      blur: {
        keyboard: async (env) => {
          const c = await control(env)
          if (!(await c.isFocused())) await c.focus()
          await env.keyboard("Tab")
        },
        done: async () => true,
      },
      reset: {
        pointer: async (env) => env.find({ role: "button", name: "Reset" }).click(),
        keyboard: async (env) => env.find({ role: "button", name: "Reset" }).press("Enter"),
        done: async () => true,
      },
    },
    queries: {
      value: async (env) => (await control(env)).value(),
      name: async (env) => (await control(env)).accessibleName(),
      description: async (env) => (await control(env)).accessibleDescription(),
      isInvalid: async (env) => (await (await control(env)).attr("aria-invalid")) === "true",
      isDisabled: async (env) => {
        const c = await control(env)
        return (await c.attr("disabled")) !== null || (await c.attr("aria-disabled")) === "true"
      },
      isReadOnly: async (env) => (await (await control(env)).attr("readonly")) !== null,
      isRequired: async (env) => {
        const c = await control(env)
        return (await c.attr("required")) !== null || (await c.attr("aria-required")) === "true"
      },
      errors: async ({ part }) =>
        Promise.all((await part("error-message").all()).map((p) => p.text())),
      characterCount: async ({ part }) => {
        const c = part("character-count")
        return (await c.exists()) ? c.text() : null
      },
      isClearable: async ({ part }) => (await part("clear-trigger").count()) > 0,
      isComposing: async (env) => (await (await control(env)).attr("data-composing")) !== null,
    },
    states: { idle: { isComposing: false }, composing: { isComposing: true } },
    events: {
      // The mapping's `args` type falls back to the action constraint (no parameters), so
      // the argument lists are asserted: they match `type(text)` and `compose(text, committed)`.
      INPUT: { action: "type", args: (() => ["x"]) as never },
      CLEAR: "clear",
      "COMPOSITION.START": { action: "composeOpen", args: (() => ["かな"]) as never },
      "COMPOSITION.END": { action: "composeEnd", args: (() => ["かな"]) as never },
      RESET: "reset",
      FOCUS: { skip: "covered by every action" },
      BLUR: { skip: "covered by every action" },
    },
    traits: ["field-associated"],
    invariants: textFieldInvariants,
  })
}

export const textFieldContract = textFieldContractFor("text-field", textFieldMachine)
