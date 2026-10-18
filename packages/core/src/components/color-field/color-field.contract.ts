// Color Field's contract (spec "Contract"): typing never commits; `commit` (Enter), `blur`,
// `fill` (type then commit); the hidden input is the form value.

import { contract } from "../../contract/contract"
import type { Env } from "../../contract/env"
import { COLOR_PICKER_SCOPE, colorFieldPart } from "../color-picker/color-picker.naming"
import type { ColorFormat } from "../shared/color/color"
import { formatColor } from "../shared/color/format"
import { tryParseColor } from "../shared/color/parse"
import { colorFieldMachine } from "./color-field.machine"

type P = "root" | "label" | "description" | "error-message" | "input" | "hidden-input"
type E = Env<P>

const isDirty = async (env: E) => (await env.part("input").attr("data-dirty")) !== null

/**
 * Replaces the text as typing does, by keyboard: Tab in, End, Backspace to clear it
 * (select-all is not a step every environment performs), then the new text.
 */
async function replaceText(env: E, text: string) {
  const input = env.part("input")
  if (!(await input.isFocused())) await input.focusWithTab()
  await input.press("End")
  for (let n = (await input.value()).length; n > 0; n--) await input.press("Backspace")
  if (text !== "") await input.type(text)
}

export const colorFieldContract = contract(COLOR_PICKER_SCOPE, {
  partName: colorFieldPart,
  machine: colorFieldMachine,
  anatomy: ["root", "label", "description", "error-message", "input", "hidden-input"],
  locate: ({ name }: { readonly name: string | RegExp }) => ({ role: "textbox", name }),
  actions: {
    type: {
      keyboard: async (env, text: string) => replaceText(env, text),
      done: async (env, _text: string) =>
        (await isDirty(env)) || (await env.part("input").attr("readonly")) !== null,
    },
    commit: {
      keyboard: async (env) => env.part("input").press("Enter"),
      done: async (env) =>
        !(await isDirty(env)) || (await env.part("input").attr("aria-invalid")) === "true",
    },
    blur: {
      keyboard: async (env) => env.part("input").press("Tab"),
      done: async (env) => !(await env.part("input").isFocused()),
    },
    paste: {
      // A paste is an insertion of the whole text (the field trims and filters it).
      keyboard: async (env, text: string) => replaceText(env, text.trim()),
      done: async () => true,
    },
    escape: {
      keyboard: async (env) => env.part("input").press("Escape"),
      done: async (env) => !(await isDirty(env)),
    },
    fill: {
      keyboard: async (env, text: string) => {
        await replaceText(env, text)
        await env.part("input").press("Enter")
      },
      done: async (env, _text: string) =>
        !(await isDirty(env)) || (await env.part("input").attr("aria-invalid")) === "true",
    },
    resetForm: {
      pointer: async (env) => env.find({ role: "button", name: "Reset" }).click(),
      keyboard: async (env) => env.find({ role: "button", name: "Reset" }).press("Enter"),
      done: async (env) =>
        (await env.part("hidden-input").value()) ===
        ((await env.part("hidden-input").attr("value")) ?? ""),
    },
  },
  queries: {
    text: async (env) => env.part("input").value(),
    color: async (env, format: ColorFormat = "hex") => {
      const c = tryParseColor(await env.part("hidden-input").value())
      return c ? formatColor(c, format) : null
    },
    isInvalid: async (env) => (await env.part("input").attr("aria-invalid")) === "true",
    isDirty,
    formValue: async (env) => env.part("hidden-input").value(),
  },
  states: {
    idle: { isDirty: false },
    editing: { isDirty: true },
    invalid: { isDirty: true, isInvalid: true },
  },
  events: {
    INPUT: { action: "type", args: (() => ["3366ff"]) as never, event: () => ({ text: "3366ff" }) },
    COMMIT: "commit",
    BLUR: "blur",
    ESCAPE: "escape",
    RESET: "resetForm",
    FLUSH: { skip: "the owner's call (a picker closing); covered by the picker's scenarios" },
    ADOPT: { skip: "autofill of the hidden input; a scenario test" },
    "$props:value": { skip: "the parent's prop change" },
  },
  // Focus leaving the input is a blur, which commits the draft (the hidden input takes the
  // focus the Field's validity gives it).
  commitsOnFocus: [{ part: "hidden-input", state: "editing" }],
  traits: ["form-associated", "field-associated"],
  semantics: { label: "label" },
})
