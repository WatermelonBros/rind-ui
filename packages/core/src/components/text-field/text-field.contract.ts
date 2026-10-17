import { contract, type Invariant } from "../../contract/contract"
import type { Env } from "../../contract/env"
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
  | "visibility-trigger"
  | "visibility-indicator"

/** The control: the Input, else the Textarea. */
async function control(env: Env<P>) {
  const input = env.part("input")
  return (await input.exists()) ? input : env.part("textarea")
}

const inertKey = { preventDefault() {}, stopPropagation() {} }
/** A key pressed while the oracle composes is the IME's (the page marks it composing). */
const composingView = (view: unknown) => (view as { readonly state?: string }).state === "composing"

/** The trigger's first name, per run (a run's env is its own object). */
const firstName = new WeakMap<object, string>()

/** A password Text Field: a VisibilityTrigger, or an input that is or was a password. */
const isPassword = async (env: Env<P>, visible: unknown) => {
  if (await env.part("visibility-trigger").exists()) return true
  const input = env.part("input")
  return (await input.exists()) && ((await input.attr("type")) === "password" || visible === true)
}

/** Text Field invariants (spec "Text Field Invariants"). */
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
  {
    name: "text-field-one-searchbox",
    check: async ({ env }) => {
      const input = env.part("input")
      if (!(await input.exists()) || (await input.attr("type")) !== "search") return undefined
      const n = await env.find({ role: "searchbox" }).count()
      return n === 1 ? undefined : `${n} searchboxes are rendered (exactly one expected)`
    },
  },
  {
    name: "text-field-empty-flag",
    // Against the page's value: the oracle does not model typed text (the input owns it).
    check: async ({ env }) => {
      const c = await control(env)
      if (!(await c.exists())) return undefined
      const empty = (await c.value()) === ""
      const flagged = (await c.attr("data-empty")) !== null
      return flagged === empty
        ? undefined
        : `data-empty is ${flagged ? "set" : "missing"} while the value is ${empty ? "empty" : "not empty"}`
    },
  },
  {
    name: "text-field-type-follows-visible",
    check: async ({ env, values }) => {
      if (!(await isPassword(env, values["visible"]))) return undefined
      const type = await env.part("input").attr("type")
      const expected = values["visible"] === true ? "text" : "password"
      return type === expected ? undefined : `the input is type="${type}" (expected ${expected})`
    },
  },
  {
    name: "text-field-pressed-follows-visible",
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
    name: "text-field-stable-toggle-name",
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
    // No keyboard alternative exists (WCAG 2.1.1), unlike the ClearTrigger.
    name: "text-field-toggle-in-tab-order",
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
    name: "text-field-password-no-spellcheck",
    check: async ({ env, values }) => {
      if (!(await isPassword(env, values["visible"]))) return undefined
      return (await env.part("input").attr("spellcheck")) === "false"
        ? undefined
        : "the input is spell-checked (revealed text would reach spellcheck services)"
    },
  },
]

/** The Text Field's contract (spec "Contract"). */
export const textFieldContract = contract("text-field", {
  machine: textFieldMachine,
  anatomy: [
    "root",
    "label",
    "description",
    "error-message",
    "input",
    "textarea",
    "clear-trigger",
    "character-count",
    "visibility-trigger",
    "visibility-indicator",
  ],
  // By the control's name: a password input has no ARIA role (search: searchbox).
  locate: ({ name }: { readonly name: string | RegExp }) => ({ label: name }),
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
    // Keyboard only: Escape is a key.
    escape: {
      keyboard: async (env) => (await control(env)).press("Escape"),
      done: async () => true,
    },
    // Keyboard only: submitting by pointer is the form's button, not the field's.
    submit: {
      keyboard: async (env) => (await control(env)).press("Enter"),
      done: async () => true,
    },
    toggleVisibility: {
      pointer: async (env) => env.part("visibility-trigger").click(),
      touch: async (env) => env.part("visibility-trigger").tap(),
      keyboard: async (env) => {
        const trigger = env.part("visibility-trigger")
        await trigger.focus()
        await trigger.press("Space")
      },
      done: async () => true,
    },
    submitForm: {
      pointer: async (env) => env.find({ role: "button", name: "Submit" }).click(),
      keyboard: async (env) => env.find({ role: "button", name: "Submit" }).press("Enter"),
      done: { isVisible: false },
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
    isEmpty: async (env) => (await (await control(env)).attr("data-empty")) !== null,
    isVisible: async (env) =>
      (await env.part("visibility-trigger").attr("aria-pressed")) === "true",
    inputType: async (env) => env.part("input").attr("type"),
    toggleName: async (env) => env.part("visibility-trigger").accessibleName(),
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
    // The oracle's key event: the page's own is the one consumed (or not).
    ESCAPE: {
      action: "escape",
      event: (view) => ({ event: inertKey, composing: composingView(view) }),
    },
    SUBMIT: {
      action: "submit",
      event: (view) => ({ event: inertKey, composing: composingView(view) }),
    },
    "VISIBILITY.TOGGLE": "toggleVisibility",
    "VISIBILITY.HIDE": "submitForm",
  },
  traits: ["field-associated"],
  invariants: textFieldInvariants,
})
