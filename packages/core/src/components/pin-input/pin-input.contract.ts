import { contract, type Invariant } from "../../contract/contract"
import type { Env } from "../../contract/env"
import { pinInputMachine } from "./pin-input.machine"

type P = "root" | "label" | "description" | "error-message" | "control" | "input" | "slot"
type E = Env<P>

const slotTexts = async (env: E) => Promise.all((await env.part("slot").all()).map((s) => s.text()))

/** Pin Input invariants (spec "Pin Input Invariants"), read from the page after every step. */
export const pinInputInvariants: readonly Invariant<P, string>[] = [
  {
    name: "pin-input-one-textbox",
    check: async ({ env }) => {
      const n = await env.find({ role: "textbox" }).count()
      return n === 1 ? undefined : `${n} textboxes are rendered (exactly one expected)`
    },
  },
  {
    name: "pin-input-slots-hidden",
    check: async ({ env }) => {
      for (const slot of await env.part("slot").all()) {
        if ((await slot.attr("aria-hidden")) !== "true")
          return "a slot is exposed to assistive technology"
        if ((await slot.attr("tabindex")) !== null) return "a slot is focusable"
      }
      return undefined
    },
  },
  {
    name: "pin-input-filled-slots",
    check: async ({ env }) => {
      const value = await env.part("input").value()
      const slots = await env.part("slot").all()
      for (const [i, slot] of slots.entries()) {
        const filled = (await slot.attr("data-filled")) !== null
        if (filled !== i < value.length) {
          return `slot ${i} ${filled ? "carries" : "lacks"} data-filled while the value is "${value}"`
        }
      }
      return undefined
    },
  },
  {
    name: "pin-input-one-active-slot",
    check: async ({ env }) => {
      let active = 0
      for (const slot of await env.part("slot").all()) {
        if ((await slot.attr("data-active")) !== null) active += 1
      }
      const focused = await env.part("input").isFocused()
      if (active > 1) return `${active} slots carry data-active`
      if (focused && active !== 1) return "the input is focused but no slot is active"
      if (!focused && active !== 0) return "a slot is active while the input is not focused"
      return undefined
    },
  },
]

/** The Pin Input's contract (spec "Contract"). */
export const pinInputContract = contract("pin-input", {
  machine: pinInputMachine,
  anatomy: ["root", "label", "description", "error-message", "control", "input", "slot"],
  locate: ({ name }: { readonly name: string | RegExp }) => ({ role: "textbox", name }),
  actions: {
    type: {
      pointer: async (env: E, text: string) => {
        await env.part("input").click()
        await env.part("input").type(text)
      },
      keyboard: async (env: E, text: string) => env.part("input").type(text),
      done: async () => true,
    },
    // Keyboard only: a paste is a keyboard or context-menu action.
    paste: {
      keyboard: async (env: E, text: string) => {
        const input = env.part("input")
        if (!(await input.isFocused())) await input.focus()
        await input.paste(text)
      },
      done: async () => true,
    },
    fill: {
      keyboard: async (env: E, code: string) => {
        const input = env.part("input")
        if (!(await input.isFocused())) await input.focus()
        await input.press("A", { mod: true })
        await input.paste(code)
      },
      done: async () => true,
    },
    // The password-manager path: a script write has no modality, so both are the same write.
    autofill: {
      pointer: async (env: E, code: string) => env.part("input").fill(code),
      keyboard: async (env: E, code: string) => env.part("input").fill(code),
      done: async () => true,
    },
    backspace: {
      keyboard: async (env: E, times = 1) => {
        const input = env.part("input")
        if (!(await input.isFocused())) await input.focus()
        for (let i = 0; i < times; i++) await input.press("Backspace")
      },
      done: async () => true,
    },
    clear: {
      keyboard: async (env: E) => {
        const input = env.part("input")
        if (!(await input.isFocused())) await input.focus()
        await input.press("A", { mod: true })
        await input.press("Backspace")
      },
      done: { value: "" },
    },
    pressSlot: {
      pointer: async (env: E, index: number) => {
        const slot = (await env.part("slot").all())[index]
        const input = env.part("input")
        const [s, box] = [await slot?.box(), await input.box()]
        if (!s || !box || box.width === 0) {
          throw new Error("pin-input: pressSlot by pointer needs layout (no slot geometry here)")
        }
        const at = { x: (s.x + s.width / 2 - box.x) / box.width, y: 0.5 }
        await input.pointer("down", { at, pointerType: "mouse" })
        await input.pointer("up", { at, pointerType: "mouse" })
      },
      keyboard: async (env: E, index: number) => {
        const input = env.part("input")
        if (!(await input.isFocused())) await input.focus()
        await input.press("Home")
        for (let i = 0; i < index; i++) await input.press("ArrowRight")
      },
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
    reset: {
      pointer: async (env: E) => env.find({ role: "button", name: "Reset" }).click(),
      keyboard: async (env: E) => env.find({ role: "button", name: "Reset" }).press("Enter"),
      done: async () => true,
    },
  },
  queries: {
    value: async (env: E) => env.part("input").value(),
    slots: slotTexts,
    activeSlot: async (env: E) => {
      for (const [i, slot] of (await env.part("slot").all()).entries()) {
        if ((await slot.attr("data-active")) !== null) return i
      }
      return null
    },
    isComplete: async (env: E) => (await env.part("input").attr("data-complete")) !== null,
    isDisabled: async (env: E) => (await env.part("input").attr("disabled")) !== null,
    isReadOnly: async (env: E) => (await env.part("input").attr("readonly")) !== null,
    isInvalid: async (env: E) => (await env.part("input").attr("aria-invalid")) === "true",
    isComposing: async (env: E) => (await env.part("input").attr("data-composing")) !== null,
  },
  states: { idle: { isComposing: false }, composing: { isComposing: true } },
  events: {
    // The oracle's edit: one more "1" at the end (the page plans its own).
    EDIT: {
      action: "type",
      args: (() => ["1"]) as never,
      event: (view) => {
        const v = (view as { values?: { value?: string } }).values?.value ?? ""
        return { edit: { next: `${v}1`, caret: v.length + 1, reason: "INPUT" } }
      },
    },
    INVALID: { skip: "a refused character is a scenario test" },
    INPUT: { action: "autofill", args: (() => ["123456"]) as never },
    "SLOT.PRESS": { action: "pressSlot", args: (() => [1]) as never },
    CARET: { skip: "covered by pressSlot's keyboard path" },
    "COMPOSITION.START": { action: "composeOpen", args: (() => ["1"]) as never },
    "COMPOSITION.END": { action: "composeEnd", args: (() => ["1"]) as never },
    RESET: "reset",
    FOCUS: { skip: "covered by every action" },
    BLUR: { skip: "covered by every action" },
  },
  traits: ["field-associated"],
  invariants: pinInputInvariants,
})
