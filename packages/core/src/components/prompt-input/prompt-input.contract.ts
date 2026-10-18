// The Prompt Input contract (prompt-input "Prompt Input Contract"): located by the
// Textarea's role (textbox, or combobox once Mentions attaches) and name; type, submit, stop,
// attach, paste, recall, the attachments (input-chips' removeChip and chips).

import { contract } from "../../contract/contract"
import type { Env, FileSpec } from "../../contract/env"
import { type PromptInputStatus, promptInputMachine } from "./prompt-input.machine"

type P =
  | "root"
  | "label"
  | "description"
  | "textarea"
  | "submit"
  | "attach-trigger"
  | "file-picker"
  | "files"
  | "chips"
  | "chip"
  | "chip-text"
  | "chip-remove"
  | "chips-summary"
  | "character-count"
type E = Env<P>

const textarea = (env: E) => env.part("textarea")
const focusTextarea = async (env: E) => {
  if (!(await textarea(env).isFocused())) await textarea(env).focus()
}
const names = async (env: E) => {
  const out: string[] = []
  for (const t of await env.part("chip-text").all()) out.push(await t.text())
  return out
}
const removeByName = {
  pointer: async (env: E, name: string) => {
    const all = await names(env)
    const removes = await env.part("chip-remove").all()
    await removes[all.indexOf(name)]?.click()
  },
  keyboard: async (env: E, name: string) => {
    const all = await names(env)
    await (await env.part("chip").all())[all.indexOf(name)]?.focus()
    await env.keyboard("Backspace")
  },
  done: async (env: E, name: string) => !(await names(env)).includes(name),
}

export const promptInputContract = contract("prompt-input", {
  machine: promptInputMachine,
  anatomy: [
    "root",
    "label",
    "description",
    "textarea",
    "submit",
    "attach-trigger",
    "file-picker",
    "files",
    "chips",
    "chip",
    "chip-text",
    "chip-remove",
    "chips-summary",
    "character-count",
  ],
  locate: ({ name }: { readonly name: string | RegExp }) => ({
    role: ["textbox", "combobox"],
    name,
  }),
  queries: {
    value: (env: E) => textarea(env).value(),
    /** The machine state, from the Root's `data-state`. */
    state: async (env: E) => (await env.part("root").attr("data-state")) ?? "idle",
    /** The attachment names, in order. */
    attachments: names,
    /** input-chips: the chip names. */
    chips: names,
    /** A press on Submit would send now. */
    canSubmit: async (env: E) =>
      (await env.part("submit").attr("data-action")) === "send" &&
      (await env.part("submit").attr("aria-disabled")) === null &&
      (await env.part("submit").attr("disabled")) === null,
    submitName: (env: E) => env.part("submit").accessibleName(),
    /** "send" or "stop". */
    submitAction: async (env: E) => (await env.part("submit").attr("data-action")) ?? "send",
    characterCount: (env: E) => env.part("character-count").text(),
    isOverLimit: async (env: E) => (await env.part("root").attr("data-over-limit")) !== null,
    isDisabled: async (env: E) => (await env.part("root").attr("data-disabled")) !== null,
    isDragging: async (env: E) => (await env.part("root").attr("data-dragging")) !== null,
  },
  actions: {
    focusIn: {
      keyboard: async (env: E) => {
        if (!(await textarea(env).isFocused())) await textarea(env).focusWithTab()
      },
      done: async () => true,
    },
    tabOut: { keyboard: (env: E) => env.keyboard("Tab"), done: async () => true },
    type: {
      keyboard: async (env: E, text: string) => {
        await focusTextarea(env)
        await textarea(env).type(text)
      },
      done: async () => true,
    },
    /** One letter as a committed composition (the model's text change). */
    typeR: {
      keyboard: async (env: E) => {
        await focusTextarea(env)
        await textarea(env).compose(["r"], "r")
      },
      done: async () => true,
    },
    /** Sets the draft as assistive technology does (no keys). */
    fill: {
      keyboard: async (env: E, text: string) => textarea(env).fill(text),
      done: async (env: E, text: string) => (await textarea(env).value()) === text,
    },
    compose: {
      keyboard: async (env: E, text: string, commit: boolean) => {
        await focusTextarea(env)
        await textarea(env).compose(
          [...text].map((_, i) => text.slice(0, i + 1)),
          commit ? text : undefined,
        )
      },
      done: async () => true,
    },
    /** Keyboard: Enter in the Textarea (Mod+Enter with `mod`); pointer: press Submit. */
    submit: {
      keyboard: async (env: E, options?: { readonly mod?: boolean }) => {
        await focusTextarea(env)
        await textarea(env).press("Enter", options?.mod ? { mod: true } : {})
      },
      pointer: (env: E) => env.part("submit").click(),
      done: async () => true,
    },
    /** Pointer: press Submit (it is Stop while busy); keyboard: focus it, Enter. */
    stop: {
      pointer: (env: E) => env.part("submit").click(),
      keyboard: async (env: E) => {
        await env.part("submit").focus()
        await env.keyboard("Enter")
      },
      done: async (env: E) =>
        (await env.part("root").attr("data-state")) !== "submitting" &&
        (await env.part("root").attr("data-state")) !== "streaming",
    },
    /** What the file chooser does after AttachTrigger opens it. */
    attach: {
      pointer: (env: E, files: readonly FileSpec[]) => env.part("file-picker").setFiles(files),
      none: { keyboard: "the file chooser is the operating system's dialog" },
      done: async () => true,
    },
    paste: {
      keyboard: async (env: E, text: string) => {
        await focusTextarea(env)
        await textarea(env).paste(text)
      },
      done: async () => true,
    },
    /** ArrowUp (older) or ArrowDown (newer) in the Textarea. */
    recall: {
      keyboard: async (env: E, direction: "older" | "newer") => {
        await focusTextarea(env)
        await textarea(env).press(direction === "older" ? "ArrowUp" : "ArrowDown")
      },
      done: async () => true,
    },
    backspace: { keyboard: (env: E) => env.keyboard("Backspace"), done: async () => true },
    caret: { keyboard: (env: E) => env.keyboard("End"), done: async () => true },
    removeAttachment: removeByName,
    /** input-chips' name for removeAttachment. */
    removeChip: removeByName,
  },
  states: {
    idle: { state: "idle" },
    composing: { state: "composing" },
    submitting: { state: "submitting", submitAction: "stop" },
    streaming: { state: "streaming", submitAction: "stop" },
    stopped: { state: "stopped" },
  },
  events: {
    INPUT: {
      action: "typeR",
      event: (view) => ({ value: `${String(view.values["value"] ?? "")}r`, composing: false }),
    },
    FOCUS: { skip: "covered by every action" },
    BLUR: { skip: "covered by every action (tab out: driver tests)" },
    CARET: "caret",
    BACKSPACE_EMPTY: "backspace",
    SUBMIT: { action: "submit", event: () => ({ event: null, formData: null }) },
    STOP: { action: "stop", event: () => ({ clickCount: 1 }) },
    "COMPOSITION.START": { skip: "IME: compose() scenario and driver tests" },
    "COMPOSITION.END": { skip: "IME: compose() scenario and driver tests" },
    STATUS: { skip: "sent by the $props:status edge" },
    "$props:status": {
      props: (target) => ({
        status: (target === "submitting" || target === "streaming"
          ? target
          : "idle") as PromptInputStatus,
      }),
    },
    SETTLED: { skip: "the fixture's onSubmit promise: scenario tests" },
    "STOP.SETTLE": { skip: "sent on entering stopped" },
    "FILES.ADD": { skip: "attach(files) / paste / drop: scenario and driver tests" },
    "DRAG.ENTER": { skip: "a file drag: browser scenario tests" },
    "DRAG.LEAVE": { skip: "a file drag: browser scenario tests" },
    RECALL: { skip: "recall(direction): scenario and driver tests (needs history)" },
    "SET.VALUE": { skip: "programmatic (the API)" },
    "CHIP.NAVIGATE": { skip: "chip focus: chip scenario tests (roving)" },
    "CHIP.BLUR": { skip: "chip focus: chip scenario tests" },
    "CHIP.REMOVE": { skip: "removeAttachment(name): scenario and driver tests" },
    "CHIP.TYPE": { skip: "typing on a chip: scenario tests" },
  },
  traits: [],
})
