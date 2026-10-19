import { contract, type Invariant } from "../../contract/contract"
import type { Env, FileSpec } from "../../contract/env"
import { fileUploadMachine } from "./file-upload.machine"

type P =
  | "root"
  | "label"
  | "dropzone"
  | "trigger"
  | "hidden-input"
  | "summary"
  | "item-group"
  | "item"
  | "item-name"
  | "item-size"
  | "item-preview"
  | "item-remove"
  | "clear-trigger"
type E = Env<P>

const names = async (env: E) => {
  const out: string[] = []
  for (const n of await env.part("item-name").all()) out.push(await n.text())
  return out
}

/**
 * File Upload invariants (spec "File Upload Invariants"): one Trigger; the Dropzone is not
 * focusable; the input stays hidden from assistive technology and out of the tab order.
 */
const invariants: readonly Invariant<P>[] = [
  {
    name: "file-upload-one-trigger",
    check: async ({ env }) =>
      (await env.part("trigger").count()) === 1 ? undefined : "not exactly one Trigger",
  },
  {
    name: "file-upload-dropzone-not-focusable",
    check: async ({ env }) => {
      for (const z of await env.part("dropzone").all()) {
        if ((await z.attr("tabindex")) !== null || (await z.attr("role")) !== null) {
          return "the Dropzone has a tabindex or a role"
        }
      }
      return undefined
    },
  },
  {
    name: "file-upload-input-hidden",
    check: async ({ env }) => {
      const input = env.part("hidden-input")
      if ((await input.attr("aria-hidden")) !== "true") return "the file input is exposed"
      return (await input.attr("tabindex")) === "-1" ? undefined : "the file input is a tab stop"
    },
  },
]

/**
 * File Upload's contract (spec "Contract"): located by the Trigger's role and name. Files come
 * from the chooser (`setFiles` on the input after the Trigger), a drop, or a paste.
 */
export const fileUploadContract = contract("file-upload", {
  machine: fileUploadMachine,
  anatomy: [
    "root",
    "label",
    "dropzone",
    "trigger",
    "hidden-input",
    "summary",
    "item-group",
    "item",
    "item-name",
    "item-size",
    "item-preview",
    "item-remove",
    "clear-trigger",
  ],
  locate: (anchor?: { readonly name: string | RegExp }) =>
    anchor ? { role: "button", name: anchor.name } : { part: "trigger" },
  actions: {
    /** The chooser: the Trigger, then the user's selection on the input. */
    choose: {
      pointer: async (env, files: readonly FileSpec[]) => {
        await env.part("trigger").click()
        await env.part("hidden-input").setFiles(files)
      },
      keyboard: async (env, files: readonly FileSpec[]) => {
        await env.part("trigger").focus()
        await env.part("trigger").press("Enter")
        await env.part("hidden-input").setFiles(files)
      },
      done: async () => true,
    },
    drop: {
      pointer: async (env, files: readonly FileSpec[]) => env.part("dropzone").dropFiles(files),
      none: { keyboard: "a drop is a pointer gesture: paste and the Trigger are the keyboard's" },
      done: async () => true,
    },
    dragEnter: {
      pointer: async (env) => env.part("dropzone").dragFiles("enter"),
      none: { keyboard: "a drag is a pointer gesture" },
      done: async () => true,
    },
    dragLeave: {
      pointer: async (env) => env.part("dropzone").dragFiles("leave"),
      none: { keyboard: "a drag is a pointer gesture" },
      done: async () => true,
    },
    paste: {
      keyboard: async (env, files: readonly FileSpec[]) => {
        await env.part("trigger").focus()
        await env.part("trigger").pasteFiles(files)
      },
      done: async () => true,
    },
    remove: {
      pointer: async (env, name: string) =>
        env.find({ role: "button", name: `Remove ${name}` }).click(),
      keyboard: async (env, name: string) => {
        const b = env.find({ role: "button", name: `Remove ${name}` })
        await b.focus()
        await b.press("Enter")
      },
      done: async () => true,
    },
    clear: {
      pointer: async (env) => env.part("clear-trigger").click(),
      keyboard: async (env) => {
        await env.part("clear-trigger").focus()
        await env.part("clear-trigger").press("Enter")
      },
      done: async () => true,
    },
    resetForm: {
      pointer: async (env) => env.find({ role: "button", name: "Reset" }).click(),
      keyboard: async (env) => env.find({ role: "button", name: "Reset" }).press("Enter"),
      done: async () => true,
    },
  },
  queries: {
    /** The held files' names, from the Items. */
    files: names,
    isDragging: async (env: E) => (await env.part("root").attr("data-dragging")) !== null,
    summary: async (env: E) => env.part("summary").text(),
    isDisabled: async (env: E) => (await env.part("root").attr("data-disabled")) !== null,
    isInvalid: async (env: E) => (await env.part("trigger").attr("aria-invalid")) === "true",
    isRequired: async (env: E) => (await env.part("root").attr("data-required")) !== null,
  },
  states: { idle: {}, dragging: {} },
  events: {
    "DRAG.ENTER": "dragEnter",
    "DRAG.LEAVE": "dragLeave",
    "FILES.ADD": { skip: "the files are the story's: the DOM and model tests map them" },
    "FILE.REMOVE": { skip: "the file is the story's: the DOM tests" },
    "FILES.CLEAR": { skip: "with files held only: the DOM tests" },
    "REJECTIONS.CLEAR": { skip: "an API call: the DOM tests" },
    "PICKER.OPEN": { skip: "opens the OS chooser: the browser tests (filechooser)" },
    RESET: "resetForm",
    "VALUE.SYNCED": { skip: "the parent's prop change: the controlled DOM tests" },
    "$props:files": { skip: "the parent's prop change: the controlled DOM tests" },
  },
  traits: [],
  invariants,
})
