// The Tags Input contract (tags-input "Tags Input Contract"): located by role textbox and
// name; the input-chips fragment (chips, removeTag), creation, paste, editing, compose.

import { contract } from "../../contract/contract"
import type { Env } from "../../contract/env"
import { tagsInputMachine } from "./tags-input.machine"

type P =
  | "root"
  | "label"
  | "control"
  | "input"
  | "chips"
  | "chip"
  | "chip-text"
  | "chip-input"
  | "chip-remove"
  | "chips-summary"
  | "clear-trigger"
  | "hidden-input"
type E = Env<P>

const input = (env: E) => env.part("input")
const focusInput = async (env: E) => {
  if (!(await input(env).isFocused())) await input(env).focus()
}
/** Tag names in order (each chip's text part). */
const tagNames = async (env: E) => {
  const out: string[] = []
  for (const t of await env.part("chip-text").all()) out.push(await t.text())
  return out
}
const chipNamed = async (env: E, name: string) => {
  const names = await tagNames(env)
  const chips = await env.part("chip").all()
  return chips[names.indexOf(name)]
}
const state = (env: E) => env.part("control").attr("data-state")

export const tagsInputContract = contract("tags-input", {
  machine: tagsInputMachine,
  anatomy: [
    "root",
    "label",
    "control",
    "input",
    "chips",
    "chip",
    "chip-text",
    "chip-input",
    "chip-remove",
    "chips-summary",
    "clear-trigger",
    "hidden-input",
  ],
  locate: ({ name }: { readonly name: string | RegExp }) => ({ role: "textbox", name }),
  queries: {
    tags: tagNames,
    /** input-chips: the chip names. */
    chips: tagNames,
    inputValue: (env: E) => input(env).value(),
    isAtMax: async (env: E) => (await env.part("control").attr("data-at-max")) !== null,
    /** The draft's refusal reason, or null. */
    refusal: (env: E) => input(env).attr("data-refused"),
    isEditing: async (env: E) => (await state(env)) === "editing",
    isActive: async (env: E) => (await state(env)) !== "idle",
  },
  actions: {
    focusIn: {
      keyboard: async (env: E) => {
        if (!(await input(env).isFocused())) await input(env).focusWithTab()
      },
      done: { isActive: true },
    },
    type: {
      keyboard: async (env: E, text: string) => {
        await focusInput(env)
        await input(env).type(text)
      },
      done: async () => true,
    },
    /** One letter as a committed composition (the model's text change; see Combobox). */
    typeR: {
      keyboard: async (env: E) => {
        await focusInput(env)
        await input(env).compose(["r"], "r")
      },
      done: async () => true,
    },
    addTag: {
      keyboard: async (env: E, text: string) => {
        await focusInput(env)
        await input(env).type(text)
        await input(env).press("Enter")
      },
      // Keyboard only: creating a tag has no pointer gesture.
      done: async () => true,
    },
    paste: {
      keyboard: async (env: E, text: string) => {
        await focusInput(env)
        await input(env).paste(text)
      },
      done: async () => true,
    },
    compose: {
      keyboard: async (env: E, text: string, commit: boolean) => {
        await focusInput(env)
        await input(env).compose(
          [...text].map((_, i) => text.slice(0, i + 1)),
          commit ? text : undefined,
        )
      },
      done: async () => true,
    },
    pressEnter: { keyboard: (env: E) => env.keyboard("Enter"), done: async () => true },
    backspace: { keyboard: (env: E) => env.keyboard("Backspace"), done: async () => true },
    caret: { keyboard: (env: E) => env.keyboard("End"), done: async () => true },
    tabOut: { keyboard: (env: E) => env.keyboard("Tab"), done: { isActive: false } },
    /** Focus the chip, Enter, replace the text, Enter (pointer: double press). */
    editTag: {
      keyboard: async (env: E, name: string, text: string) => {
        await (await chipNamed(env, name))?.focus()
        await env.keyboard("Enter")
        await env.part("chip-input").fill(text)
        await env.part("chip-input").press("Enter")
      },
      pointer: async (env: E, name: string, text: string) => {
        await (await chipNamed(env, name))?.doubleClick()
        await env.part("chip-input").fill(text)
        await env.part("chip-input").press("Enter")
      },
      done: async (env: E, _name: string, text: string) =>
        (await tagNames(env)).includes(text.trim()) || text.trim() === "",
    },
    removeTag: {
      pointer: async (env: E, name: string) => {
        const names = await tagNames(env)
        const removes = await env.part("chip-remove").all()
        await removes[names.indexOf(name)]?.click()
      },
      keyboard: async (env: E, name: string) => {
        await (await chipNamed(env, name))?.focus()
        await env.keyboard("Backspace")
      },
      done: async (env: E, name: string) => !(await tagNames(env)).includes(name),
    },
    /** input-chips' name for removeTag. */
    removeChip: {
      pointer: async (env: E, name: string) => {
        const names = await tagNames(env)
        const removes = await env.part("chip-remove").all()
        await removes[names.indexOf(name)]?.click()
      },
      keyboard: async (env: E, name: string) => {
        await (await chipNamed(env, name))?.focus()
        await env.keyboard("Backspace")
      },
      done: async (env: E, name: string) => !(await tagNames(env)).includes(name),
    },
    /** Pointer: ClearTrigger; keyboard: remove the chips one by one (it is tabindex -1). */
    clear: {
      pointer: (env: E) => env.part("clear-trigger").click(),
      keyboard: async (env: E) => {
        await focusInput(env)
        await input(env).press("A", { mod: true })
        await input(env).press("Backspace")
        for (let n = (await tagNames(env)).length; n > 0; n--) {
          await input(env).press("Backspace")
          await input(env).press("Backspace")
        }
      },
      done: async () => true,
    },
  },
  states: {
    idle: { isActive: false },
    typing: { isActive: true, isEditing: false },
    editing: { isEditing: true },
  },
  events: {
    "INPUT.CHANGE": {
      action: "typeR",
      event: (view) => ({
        text: `${String(view.values["inputValue"] ?? "")}r`,
        inputType: "insertText",
        composing: false,
        caretAtEnd: true,
      }),
    },
    "INPUT.FOCUS": "focusIn",
    ENTER: { action: "pressEnter", event: () => ({ composing: false }) },
    BACKSPACE_EMPTY: "backspace",
    CARET: "caret",
    "FOCUS.LEAVE": "tabOut",
    PASTE: { skip: "paste(text): scenario and driver tests (the clipboard text is the argument)" },
    ESCAPE: { skip: "Escape has no effect without suggestions" },
    "COMPOSITION.START": { skip: "IME: compose() scenario and driver tests" },
    "COMPOSITION.END": { skip: "IME: compose() scenario and driver tests" },
    "TAG.EDIT": { skip: "editTag(name, text): scenario and driver tests" },
    "EDIT.CHANGE": { skip: "editTag(name, text): scenario and driver tests" },
    "EDIT.COMMIT": { skip: "editTag(name, text): scenario and driver tests" },
    "EDIT.CANCEL": { skip: "the Escape edit scenario" },
    "EDIT.BLUR": { skip: "edit blur: scenario tests" },
    "CHIP.NAVIGATE": { skip: "chip focus: chip scenario tests (roving)" },
    "CHIP.BLUR": { skip: "chip focus: chip scenario tests" },
    "CHIP.REMOVE": { skip: "removeTag(name): scenario and driver tests" },
    "CHIP.TYPE": { skip: "typing on a chip: scenario tests" },
    "CLEAR.PRESS": { skip: "clear(): driver tests (the button is tabindex -1)" },
    ADD: { skip: "programmatic" },
    CLEAR: { skip: "programmatic" },
    "FORM.RESET": { skip: "a form reset: form scenario tests" },
    "VALUE.SYNC": { skip: "sent by the $props:value edge" },
    "$props:value": { skip: "a controlled value: the over-max scenario tests" },
  },
  traits: ["form-associated", "field-associated", "composite-roving"],
  formInput: {
    values: ["value"],
    expected: (vals) => ({
      value: ((vals["value"] as readonly string[] | undefined) ?? []).join(","),
    }),
  },
  commitsOnFocus: [
    { part: "input", state: "idle" },
    { part: "chip", state: "idle" },
    { part: "chip", state: "typing" },
    { part: "hidden-input", state: "idle" },
    { part: "hidden-input", state: "typing" },
    { part: "clear-trigger", state: "typing" },
    { part: "chip-remove", state: "typing" },
  ],
})
