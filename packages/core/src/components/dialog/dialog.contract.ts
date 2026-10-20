import { contract, type Trait } from "../../contract/contract"
import type { Env, Part } from "../../contract/env"
import { dialogMachine } from "./dialog.machine"
import {
  dialogFamilyActions,
  dialogFamilyQueries,
  dialogIsOpen,
  dialogLocate,
} from "./dialog-family.contract"

type P =
  | "trigger"
  | "backdrop"
  | "positioner"
  | "content"
  | "title"
  | "description"
  | "close-trigger"
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
  throw new Error(`dialog: no action named ${String(name)}`)
}

/** The Dialog's contract (spec "Dialog Contract"); non-modal instances drop `modal`. */
type DialogTraits = readonly Extract<Trait, "layer" | "restores-focus" | "modal" | "presence">[]

/** The variant: modal or not, and a confirmation (`role="alertdialog"`). */
interface Variant {
  readonly modal: boolean
  /** `role="alertdialog"`: Cancel and Action, no close trigger, outside presses ignored. */
  readonly alert?: boolean
}

/* @__NO_SIDE_EFFECTS__ */
function dialogContractWith(traits: DialogTraits, { modal, alert = false }: Variant) {
  return contract("dialog", {
    machine: dialogMachine,
    anatomy: [
      "trigger",
      "backdrop",
      "positioner",
      "content",
      "title",
      "description",
      "close-trigger",
      "cancel",
      "action",
    ],
    locate: dialogLocate,
    queries: dialogFamilyQueries,
    actions: {
      ...dialogFamilyActions(!alert),
      close: {
        pointer: async (env: Env<P>) => env.part("close-trigger").click(),
        touch: async (env: Env<P>) => env.part("close-trigger").tap(),
        keyboard: async (env: Env<P>) => env.part("close-trigger").press("Enter"),
        done: async (env: Env<P>) => !(await dialogIsOpen(env)),
      },
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
    // A non-modal dialog stays open when the user works on the page (focus outside).
    states: {
      open: modal ? { isOpen: true, hasFocus: true } : { isOpen: true },
      closed: { isOpen: false },
    },
    // Title, description and close triggers carry only the scoping attributes.
    dataState: {
      open: { trigger: "open", backdrop: "open", positioner: "open", content: "open" },
      closed: { trigger: "closed" },
    },
    events: {
      TRIGGER_PRESS: {
        from: {
          closed: "open",
          open: {
            skip: "a modal dialog's trigger is inert while open (the DOM tests cover the non-modal toggle)",
          },
        },
      },
      CLOSE_TRIGGER_PRESS: alert
        ? { skip: "a confirmation has Cancel and Action, no close trigger" }
        : "close",
      CANCEL_PRESS: "cancel",
      ACTION_PRESS: "confirm",
      ESCAPE_KEY: "pressEscape",
      OUTSIDE_PRESS: modal
        ? "pressOutside"
        : {
            skip: "a non-modal dialog stays open on outside presses (the page stays usable: DOM tests)",
          },
      OPEN: { skip: "programmatic (actionsRef.open): covered by the machine tests" },
      CLOSE: { skip: "programmatic (actionsRef.close): covered by the machine tests" },
      PARENT_DISMISSED: {
        skip: "closing the parent layer: covered by the nested-dialog DOM tests",
      },
      OUTSIDE_FOCUS: { skip: "a dialog never closes on outside focus (dismiss option off)" },
      "$sync:open": { props: (target) => ({ open: target === "open" }) },
    },
    traits,
    semantics: { trigger: "trigger", content: "content", label: "title" },
  })
}

/** A modal dialog: layer, restores focus, presence, modal. */
export const dialogContract = dialogContractWith(["modal", "presence"], { modal: true })
/** A non-modal dialog (`modal={false}`): no inert, no containment. */
export const nonModalDialogContract = dialogContractWith(["layer", "restores-focus", "presence"], {
  modal: false,
})
/** A confirmation (`role="alertdialog"`): always modal; Cancel and Action close it. */
export const alertDialogRoleContract = dialogContractWith(["modal", "presence"], {
  modal: true,
  alert: true,
})
