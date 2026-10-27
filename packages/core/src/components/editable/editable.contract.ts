import { contract } from "../../contract/contract"
import type { Env } from "../../contract/env"
import { editableMachine } from "./editable.machine"

type P =
  | "root"
  | "label"
  | "area"
  | "preview"
  | "input"
  | "control"
  | "edit-trigger"
  | "submit-trigger"
  | "cancel-trigger"
  | "hidden-input"
type E = Env<P>

const editing = async (env: E) => (await env.part("root").attr("data-state")) === "edit"

/** Editable's contract (spec "Editable Contract"): by the Label's text, else the only one. */
export const editableContract = contract("editable", {
  machine: editableMachine,
  anatomy: [
    "root",
    "label",
    "area",
    "preview",
    "input",
    "control",
    "edit-trigger",
    "submit-trigger",
    "cancel-trigger",
    "hidden-input",
  ],
  locate: (anchor?: { readonly label: string | RegExp }) =>
    anchor ? { text: anchor.label } : { part: "root" },
  actions: {
    edit: {
      pointer: (env: E) => env.part("preview").click(),
      touch: (env: E) => env.part("preview").tap(),
      keyboard: async (env: E) => {
        await env.part("preview").focus()
        await env.part("preview").press("Enter")
      },
      done: editing,
    },
    type: {
      keyboard: async (env: E, text: string) => {
        await env.part("input").fill("")
        await env.part("input").type(text)
      },
      none: { pointer: "typing is the keyboard's", touch: "typing is the keyboard's" },
      done: async () => true,
    },
    submit: {
      keyboard: (env: E) => env.part("input").press("Enter"),
      pointer: (env: E) => env.part("submit-trigger").click(),
      touch: (env: E) => env.part("submit-trigger").tap(),
      done: async (env: E) => !(await editing(env)),
    },
    cancel: {
      keyboard: (env: E) => env.part("input").press("Escape"),
      pointer: (env: E) => env.part("cancel-trigger").click(),
      touch: (env: E) => env.part("cancel-trigger").tap(),
      done: async (env: E) => !(await editing(env)),
    },
  },
  queries: {
    isEditing: editing,
    value: async (env: E) => env.part("hidden-input").value(),
    draft: async (env: E) => env.part("input").value(),
    previewText: async (env: E) => env.part("preview").text(),
  },
  states: { preview: { isEditing: false }, edit: { isEditing: true } },
  events: { EDIT: "edit", SUBMIT: "submit", CANCEL: "cancel" },
  traits: [],
})
