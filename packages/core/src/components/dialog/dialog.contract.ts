import { contract, type Trait } from "../../contract/contract"
import type { Env } from "../../contract/env"
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

/** The Dialog's contract (spec "Dialog Contract"); non-modal instances drop `modal`. */
type DialogTraits = readonly Extract<Trait, "layer" | "restores-focus" | "modal" | "presence">[]

function dialogContractWith(traits: DialogTraits, modal: boolean) {
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
    ],
    locate: dialogLocate,
    queries: dialogFamilyQueries,
    actions: {
      ...dialogFamilyActions(true),
      close: {
        pointer: async (env: Env<P>) => env.part("close-trigger").click(),
        touch: async (env: Env<P>) => env.part("close-trigger").tap(),
        keyboard: async (env: Env<P>) => env.part("close-trigger").press("Enter"),
        done: async (env: Env<P>) => !(await dialogIsOpen(env)),
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
      CLOSE_TRIGGER_PRESS: "close",
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
export const dialogContract = dialogContractWith(["modal", "presence"], true)
/** A non-modal dialog (`modal={false}`): no inert, no containment. */
export const nonModalDialogContract = dialogContractWith(
  ["layer", "restores-focus", "presence"],
  false,
)
