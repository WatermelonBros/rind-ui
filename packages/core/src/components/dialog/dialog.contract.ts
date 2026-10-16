import { contract, type Trait } from "../../contract/contract"
import type { Env } from "../../contract/env"
import { dialogMachine } from "./dialog.machine"

type P =
  | "trigger"
  | "backdrop"
  | "positioner"
  | "content"
  | "title"
  | "description"
  | "close-trigger"
type E = Env<P>

/**
 * A dialog is located through its trigger (a closed dialog has no content to find):
 * `trigger` names it, defaulting to the dialog's `name` (the opening control usually
 * repeats it). `title()` reads the dialog's own name.
 */
const locate = ({
  name,
  trigger,
}: {
  readonly name: string | RegExp
  readonly trigger?: string | RegExp
}) => ({
  role: "button" as const,
  name: trigger ?? name,
})

const isOpen = async (env: E) =>
  (await env.part("content").exists()) && (await env.part("content").attr("data-state")) === "open"
const hasFocus = async (env: E) =>
  (await env.part("content").exists()) &&
  (await env.part("content").attr("data-focus-within")) !== null

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
    locate,
    queries: {
      isOpen,
      isModal: async (env) => (await env.part("content").attr("aria-modal")) === "true",
      title: async (env) =>
        (await env.part("content").exists()) ? env.part("content").accessibleName() : null,
      description: async (env) =>
        (await env.part("content").exists()) ? env.part("content").accessibleDescription() : null,
      hasFocus,
      isTopmost: async (env) =>
        (await env.part("content").exists()) &&
        (await env.part("content").attr("data-has-nested")) === null,
      /** The last close reason, kebab case ("escape-key"), until the next open. */
      closeReason: async (env) => env.part("trigger").attr("data-close-reason"),
    },
    actions: {
      open: {
        pointer: async (env) => env.part("trigger").click(),
        touch: async (env) => env.part("trigger").tap(),
        keyboard: async (env) => env.part("trigger").press("Enter"),
        // Open once focus has moved into it (within a frame).
        done: async (env) => (await isOpen(env)) && (await hasFocus(env)),
      },
      close: {
        pointer: async (env) => env.part("close-trigger").click(),
        touch: async (env) => env.part("close-trigger").tap(),
        keyboard: async (env) => env.part("close-trigger").press("Enter"),
        done: async (env) => !(await isOpen(env)),
      },
      pressEscape: {
        keyboard: async (env) => env.keyboard("Escape"),
        done: async (env) => !(await isOpen(env)),
      },
      pressOutside: {
        // The backdrop (a dismiss surface) near its corner, never its centre, where the
        // content sits; outside every layer when there is no backdrop.
        pointer: async (env) => {
          const backdrop = env.part("backdrop")
          if (await backdrop.exists()) await backdrop.pressAtPosition({ corner: true })
          else await env.pointerOutside()
        },
        none: { keyboard: "an outside press is a pointer interaction" },
        done: async (env) => !(await isOpen(env)),
      },
      tab: {
        keyboard: async (env) => env.keyboard("Tab"),
        done: hasFocus,
      },
      shiftTab: {
        keyboard: async (env) => env.keyboard("Tab", { shift: true }),
        done: hasFocus,
      },
      waitForUnmount: {
        keyboard: async (env) => env.part("content").waitForDetach(),
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
