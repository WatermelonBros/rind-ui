import { contract, type Invariant } from "../../contract/contract"
import type { Env } from "../../contract/env"
import { searchFieldMachine } from "./search-field.machine"

type P = "root" | "label" | "description" | "error-message" | "input" | "clear-trigger"
type E = Env<P>

const inertKey = { preventDefault() {}, stopPropagation() {} }

/** Search Field invariants that need no step record (spec "Search Field Invariants"). */
export const searchFieldInvariants: readonly Invariant<P, string>[] = [
  {
    name: "search-field-one-searchbox",
    check: async ({ env }) => {
      const n = await env.find({ role: "searchbox" }).count()
      return n === 1 ? undefined : `${n} searchboxes are rendered (exactly one expected)`
    },
  },
  {
    name: "search-field-empty-flag",
    // Against the page's value: the oracle does not model typed text (the input owns it).
    check: async ({ env }) => {
      const empty = (await env.part("input").value()) === ""
      const flagged = (await env.part("input").attr("data-empty")) !== null
      return flagged === empty
        ? undefined
        : `data-empty is ${flagged ? "set" : "missing"} while the value is ${empty ? "empty" : "not empty"}`
    },
  },
]

/** The Search Field's contract (spec "Contract"). */
export const searchFieldContract = contract("search-field", {
  machine: searchFieldMachine,
  anatomy: ["root", "label", "description", "error-message", "input", "clear-trigger"],
  locate: ({ name }: { readonly name: string | RegExp }) => ({ role: "searchbox", name }),
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
    // Escape is the ClearTrigger's keyboard twin.
    clear: {
      pointer: async (env: E) => {
        const trigger = env.part("clear-trigger")
        if (await trigger.exists()) await trigger.click()
      },
      keyboard: async (env: E) => env.part("input").press("Escape"),
      done: { value: "" },
    },
    // Keyboard only: Escape is a key.
    escape: {
      keyboard: async (env: E) => env.part("input").press("Escape"),
      done: async () => true,
    },
    // Keyboard only: submitting by pointer is the form's button, not the field's.
    submit: {
      keyboard: async (env: E) => env.part("input").press("Enter"),
      done: async () => true,
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
  },
  queries: {
    value: async (env: E) => env.part("input").value(),
    isEmpty: async (env: E) => (await env.part("input").attr("data-empty")) !== null,
    isClearable: async (env: E) => (await env.part("clear-trigger").count()) > 0,
    description: async (env: E) => env.part("input").accessibleDescription(),
    isInvalid: async (env: E) => (await env.part("input").attr("aria-invalid")) === "true",
    isComposing: async (env: E) => (await env.part("input").attr("data-composing")) !== null,
  },
  states: { idle: { isComposing: false }, composing: { isComposing: true } },
  events: {
    INPUT: { action: "type", args: (() => ["x"]) as never },
    CLEAR: "clear",
    "COMPOSITION.START": { action: "composeOpen", args: (() => ["かな"]) as never },
    "COMPOSITION.END": { action: "composeEnd", args: (() => ["かな"]) as never },
    RESET: { skip: "a form reset is Text Field's, covered by its contract" },
    FOCUS: { skip: "covered by every action" },
    BLUR: { skip: "covered by every action" },
    // The oracle's key event: the page's own is the one consumed (or not).
    ESCAPE: { action: "escape", event: () => ({ event: inertKey, composing: false }) },
    SUBMIT: { action: "submit", event: () => ({ event: inertKey, composing: false }) },
  },
  traits: ["field-associated"],
  invariants: searchFieldInvariants,
})
