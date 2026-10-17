// The Drawer's contract (design §6): the dialog family's actions and queries, plus the swipe
// (the drag input, touch and pointer; its keyboard alternatives are close, pressEscape and
// pressHandle) and the handle.

import { contract, type Trait } from "../../contract/contract"
import type { Env } from "../../contract/env"
import type { SwipeDirection } from "../../dom/swipe"
import {
  dialogFamilyActions,
  dialogFamilyQueries,
  dialogIsOpen,
  dialogLocate,
} from "../dialog/dialog-family.contract"
import { drawerMachine } from "./drawer.machine"

type P =
  | "trigger"
  | "backdrop"
  | "positioner"
  | "content"
  | "title"
  | "description"
  | "close-trigger"
  | "handle"
type E = Env<P>

const VECTOR: Record<SwipeDirection, { x: number; y: number }> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
}

/** A swipe of `distance` px toward `direction` over 600 ms (a slow, deliberate drag). */
const swipeWith =
  (pointerType: "mouse" | "touch") =>
  async (env: E, direction: SwipeDirection, distance: number) => {
    const v = VECTOR[direction]
    await env
      .part("content")
      .drag({ x: v.x * distance, y: v.y * distance }, { pointerType, durationMs: 600, steps: 12 })
  }

const snapPoint = async (env: E) =>
  (await env.part("content").exists()) ? env.part("content").attr("data-snap-point") : null

/** The traits of a props class (non-modal drops `modal`). */
export function drawerTraits(props: { readonly modal?: boolean | undefined }): readonly Trait[] {
  return props.modal === false
    ? ["layer", "restores-focus", "presence"]
    : ["layer", "restores-focus", "presence", "modal"]
}

function drawerContractWith(modal: boolean) {
  return contract("drawer", {
    machine: drawerMachine,
    anatomy: [
      "trigger",
      "backdrop",
      "positioner",
      "content",
      "title",
      "description",
      "close-trigger",
      "handle",
    ],
    locate: dialogLocate,
    queries: {
      ...dialogFamilyQueries,
      snapPoint,
      /** The physical side (`data-side`). */
      side: async (env: E) =>
        (await env.part("content").exists()) ? env.part("content").attr("data-side") : null,
      isSwiping: async (env: E) => (await env.part("content").attr("data-swiping")) !== null,
    },
    actions: {
      ...dialogFamilyActions(modal),
      close: {
        pointer: async (env: E) => env.part("close-trigger").click(),
        touch: async (env: E) => env.part("close-trigger").tap(),
        keyboard: async (env: E) => env.part("close-trigger").press("Enter"),
        done: async (env: E) => !(await dialogIsOpen(env)),
      },
      /** A drag of the content toward `direction` (dismisses when far or fast enough). */
      swipe: {
        pointer: swipeWith("mouse"),
        touch: swipeWith("touch"),
        none: { keyboard: "keyboard alternatives are close, pressEscape and pressHandle" },
        done: async (env: E) => !(await dialogIsOpen(env)),
      },
      /** The handle: the next snap point (two or more points). */
      pressHandle: {
        pointer: async (env: E) => env.part("handle").click(),
        touch: async (env: E) => env.part("handle").tap(),
        keyboard: async (env: E) => env.part("handle").press("Enter"),
        done: async () => true,
      },
    },
    states: {
      open: modal ? { isOpen: true, hasFocus: true } : { isOpen: true },
      closed: { isOpen: false },
    },
    dataState: {
      open: { trigger: "open", backdrop: "open", positioner: "open", content: "open" },
      closed: { trigger: "closed" },
    },
    events: {
      TRIGGER_PRESS: {
        from: {
          closed: "open",
          open: {
            skip: "a modal drawer's trigger is inert while open (the DOM tests cover the non-modal toggle)",
          },
        },
      },
      CLOSE_TRIGGER_PRESS: "close",
      ESCAPE_KEY: "pressEscape",
      OUTSIDE_PRESS: modal
        ? "pressOutside"
        : { skip: "a non-modal drawer stays open on outside presses (DOM tests)" },
      SWIPE: {
        action: "swipe",
        // The mapping's args type misses the action's own arguments (text-field's gap).
        // The model fixtures are bottom drawers: down dismisses.
        args: (() => ["down", 400]) as never,
        event: () => ({ direction: "down", offset: 400, velocity: 0.7, size: 400 }),
      },
      HANDLE_PRESS: { skip: "needs two snap points and layout: the DOM and browser tests" },
      "SWIPE.START": { skip: "part of swipe" },
      "SWIPE.CANCEL": { skip: "the gesture's cancellation: swipe-gesture tests" },
      "SNAP_POINT.SET": { skip: "api only: machine tests" },
      "SIZE.CHANGE": { skip: "layout: the effect's measurement" },
      "NESTED.CHANGE": { skip: "layout: the drawer stack tests" },
      OPEN: { skip: "programmatic (actionsRef.open): covered by the machine tests" },
      CLOSE: { skip: "programmatic (actionsRef.close): covered by the machine tests" },
      PARENT_DISMISSED: { skip: "closing the parent layer: the nesting DOM tests" },
      OUTSIDE_FOCUS: { skip: "a drawer never closes on outside focus (dismiss option off)" },
      "$sync:open": { props: (target) => ({ open: target === "open" }) },
    },
    traits: modal
      ? ["layer", "restores-focus", "presence", "modal"]
      : ["layer", "restores-focus", "presence"],
    semantics: { trigger: "trigger", content: "content", label: "title" },
  })
}

/** A modal drawer (the default). */
export const drawerContract = drawerContractWith(true)
/** A non-modal drawer (`modal={false}`). */
export const nonModalDrawerContract = drawerContractWith(false)
