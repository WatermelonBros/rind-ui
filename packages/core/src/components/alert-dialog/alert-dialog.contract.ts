import { contract } from "../../contract/contract"
import type { Env, Part } from "../../contract/env"
import {
  dialogFamilyActions,
  dialogFamilyQueries,
  dialogIsOpen,
  dialogLocate,
} from "../dialog/dialog-family.contract"
import { alertDialogMachine } from "./alert-dialog.machine"

type P =
  | "trigger"
  | "backdrop"
  | "positioner"
  | "content"
  | "title"
  | "description"
  | "cancel"
  | "action"
type E = Env<P>

/** The action named `name`, or the only one. */
async function actionPart(env: E, name?: string | RegExp): Promise<Part> {
  if (name === undefined) return env.part("action")
  for (const a of await env.part("action").all()) {
    const n = await a.accessibleName()
    if (typeof name === "string" ? n === name : name.test(n)) return a
  }
  throw new Error(`alert-dialog: no action named ${String(name)}`)
}

/**
 * The Alert Dialog's contract (spec "Alert Dialog Contract"): the Dialog's actions and
 * queries (shared definition) without `close`, plus `cancel()` and `confirm(name?)`; an
 * outside press leaves it open.
 */
export const alertDialogContract = contract("alert-dialog", {
  machine: alertDialogMachine,
  anatomy: [
    "trigger",
    "backdrop",
    "positioner",
    "content",
    "title",
    "description",
    "cancel",
    "action",
  ],
  locate: dialogLocate,
  queries: dialogFamilyQueries,
  actions: {
    ...dialogFamilyActions(false),
    cancel: {
      pointer: async (env: E) => env.part("cancel").click(),
      touch: async (env: E) => env.part("cancel").tap(),
      keyboard: async (env: E) => env.part("cancel").press("Enter"),
      done: async (env: E) => !(await dialogIsOpen(env)),
    },
    confirm: {
      pointer: async (env: E, name?: string | RegExp) => (await actionPart(env, name)).click(),
      touch: async (env: E, name?: string | RegExp) => (await actionPart(env, name)).tap(),
      keyboard: async (env: E, name?: string | RegExp) =>
        (await actionPart(env, name)).press("Enter"),
      // Closed, unless the consumer cancelled the request (async confirm): it resolves then.
      done: async () => true,
    },
  },
  states: { open: { isOpen: true, hasFocus: true }, closed: { isOpen: false } },
  dataState: {
    open: { trigger: "open", backdrop: "open", positioner: "open", content: "open" },
    closed: { trigger: "closed" },
  },
  events: {
    TRIGGER_PRESS: {
      from: {
        closed: "open",
        open: { skip: "the trigger is inert while the modal alert dialog is open" },
      },
    },
    CANCEL_PRESS: "cancel",
    ACTION_PRESS: "confirm",
    ESCAPE_KEY: "pressEscape",
    OUTSIDE_PRESS: "pressOutside",
    OPEN: { skip: "programmatic (actionsRef.open): covered by the machine tests" },
    CLOSE: { skip: "programmatic (actionsRef.close): covered by the machine tests" },
    PARENT_DISMISSED: { skip: "closing the parent layer: covered by the nested DOM tests" },
    OUTSIDE_FOCUS: { skip: "an alert dialog never closes on outside focus" },
    CLOSE_TRIGGER_PRESS: { skip: "an alert dialog has Cancel and Action, no close trigger" },
    "$sync:open": { props: (target) => ({ open: target === "open" }) },
  },
  traits: ["modal", "presence"],
  semantics: { trigger: "trigger", content: "content", label: "title" },
})
