import { contract } from "../../contract/contract"
import type { Env } from "../../contract/env"
import { alertMachine } from "./alert.machine"

type P = "root" | "icon" | "title" | "description" | "close-trigger"

/** A dismissed alert unmounts (its anchor or its root is gone): that is closed too. */
const gone = (e: unknown) =>
  e instanceof Error && /no element matches the anchor|\.root: not found/.test(e.message)

const isOpen = async (env: Env<P>) => {
  try {
    return (await env.part("root").attr("data-state")) === "open"
  } catch (e) {
    if (gone(e)) return false
    throw e
  }
}

const textOf = async (env: Env<P>, part: "title" | "description") => {
  const el = env.part(part)
  return (await el.count()) > 0 ? el.text() : ""
}

/** Alert's contract (design §5). */
export const alertContract = contract("alert", {
  machine: alertMachine,
  anatomy: ["root", "icon", "title", "description", "close-trigger"],
  // The Title's exact text (a root has no role and no name), or the one alert in a container.
  locate: (anchor: { readonly title?: string | RegExp } = {}) =>
    anchor.title === undefined ? { part: "root" } : { text: anchor.title },
  actions: {
    dismiss: {
      pointer: async (env) => env.part("close-trigger").click(),
      touch: async (env) => env.part("close-trigger").tap(),
      keyboard: async (env) => {
        await env.part("close-trigger").focus()
        await env.part("close-trigger").press("Enter")
      },
      done: { isOpen: false },
    },
  },
  queries: {
    isOpen,
    title: (env: Env<P>) => textOf(env, "title"),
    description: (env: Env<P>) => textOf(env, "description"),
  },
  states: { open: { isOpen: true }, closed: { isOpen: false } },
  events: {
    // A dismissal is CLOSE (focus moves out) then the queued CLOSE.COMMIT (open → closed).
    "CLOSE.COMMIT": "dismiss",
    CLOSE: { skip: "the first half of a dismissal; driven through CLOSE.COMMIT's dismiss" },
    "ROOT.MOUNT": { skip: "mount; covered by the machine unit tests (hydrating true/false)" },
    "CONTENT.CHANGE": {
      skip: "a text change of the rendered content; covered by the DOM and machine tests",
    },
    "$sync:open": { props: (target) => ({ open: target === "open" }) },
  },
  // A dismissed alert unmounts once its exit animation ends.
  absentIn: ["closed"],
  traits: ["presence"],
  semantics: { content: "root" },
})
