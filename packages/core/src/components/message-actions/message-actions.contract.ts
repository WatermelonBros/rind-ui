import { contract } from "../../contract/contract"
import type { Env } from "../../contract/env"
import { messageActionsMachine, type RegenerateState } from "./message-actions.machine"

type P =
  | "root"
  | "item"
  | "copy"
  | "regenerate"
  | "edit"
  | "feedback"
  | "feedback-item"
  | "versions"
  | "version-previous"
  | "version-next"
  | "version-status"
type E = Env<P>

const press = (part: P) => ({
  pointer: (env: E) => env.part(part).click(),
  touch: (env: E) => env.part(part).tap(),
  keyboard: async (env: E) => {
    await env.part(part).focus()
    await env.part(part).press("Enter")
  },
  done: async () => true,
})

async function rateWith(env: E, value: "up" | "down", how: "click" | "tap" | "key") {
  for (const item of await env.part("feedback-item").all()) {
    if ((await item.attr("data-value")) !== value) continue
    if (how === "click") return item.click()
    if (how === "tap") return item.tap()
    await item.focus()
    return item.press("Enter")
  }
  throw new Error(`message-actions: no FeedbackItem "${value}"`)
}

/** The Clipboard trigger inside Copy (the Copy part hosts it). */
const copyTrigger = (env: E) => env.part("copy").scoped("clipboard", "trigger")

/** Message Actions' contract (spec "Message Actions Contract"). */
export const messageActionsContract = contract("message-actions", {
  machine: messageActionsMachine,
  anatomy: [
    "root",
    "item",
    "copy",
    "regenerate",
    "edit",
    "feedback",
    "feedback-item",
    "versions",
    "version-previous",
    "version-next",
    "version-status",
  ],
  locate: (anchor?: { readonly name: string | RegExp }) =>
    anchor ? { role: "toolbar", name: anchor.name } : { part: "root" },
  actions: {
    copy: {
      pointer: (env: E) => copyTrigger(env).click(),
      touch: (env: E) => copyTrigger(env).tap(),
      keyboard: async (env: E) => {
        await copyTrigger(env).focus()
        await copyTrigger(env).press("Enter")
      },
      done: async () => true,
    },
    regenerate: press("regenerate"),
    edit: press("edit"),
    rate: {
      pointer: (env: E, value: "up" | "down") => rateWith(env, value, "click"),
      touch: (env: E, value: "up" | "down") => rateWith(env, value, "tap"),
      keyboard: (env: E, value: "up" | "down") => rateWith(env, value, "key"),
      done: async () => true,
    },
    previousVersion: press("version-previous"),
    nextVersion: press("version-next"),
  },
  queries: {
    isActive: async (env: E) => (await env.part("root").attr("data-active")) !== null,
    regenerateState: async (env: E) =>
      ((await env.part("regenerate").attr("data-state")) ?? "idle") as RegenerateState,
    rating: async (env: E) => {
      for (const item of await env.part("feedback-item").all()) {
        if ((await item.attr("aria-pressed")) === "true") return item.attr("data-value")
      }
      return null
    },
    version: async (env: E) => ({
      index: Number((await env.part("versions").attr("data-index")) ?? 0),
      count: Number((await env.part("versions").attr("data-count")) ?? 0),
    }),
    isEditing: async (env: E) => (await env.part("root").attr("data-editing")) !== null,
  },
  states: { live: {}, settling: {} },
  events: {
    "PRESS.REGENERATE": "regenerate",
    "PRESS.EDIT": "edit",
    "PRESS.PREVIOUS": "previousVersion",
    "PRESS.NEXT": "nextVersion",
  },
  traits: [],
})
