import { contract } from "../../contract/contract"
import type { Env } from "../../contract/env"
import { positioningQueries } from "../../contract/positioning"
import { createStepVisit } from "../../dom/step-effect"
import { type TourContext, tourMachine } from "./tour.machine"

type P =
  | "trigger"
  | "backdrop"
  | "spotlight"
  | "positioner"
  | "content"
  | "arrow"
  | "title"
  | "description"
  | "progress-text"
  | "action-trigger"
  | "close-trigger"
type E = Env<P>

const isOpen = async (env: E) => (await env.part("trigger").attr("aria-expanded")) === "true"
const content = async (env: E) =>
  (await env.part("content").exists()) ? env.part("content") : null
/** `idle`, `preparing`, `shown` or `waiting`: the backdrop holds it while no card is shown. */
const phase = async (env: E) => {
  const c = await content(env)
  if (c && (await c.attr("data-state")) === "open") return (await c.attr("data-phase")) ?? "idle"
  if (await env.part("backdrop").exists()) {
    return (await env.part("backdrop").attr("data-phase")) ?? "idle"
  }
  return (await isOpen(env)) ? "preparing" : "idle"
}
const hasFocus = async (env: E) =>
  !!(await content(env)) && (await env.part("content").attr("data-focus-within")) !== null
const closed = async (env: E) => !(await isOpen(env))
/** The action trigger running `kind` (`withAttr` searches descendants, so filter here). */
const action = async (env: E, kind: string) => {
  for (const p of await env.part("action-trigger").all()) {
    if ((await p.attr("data-action")) === kind) return p
  }
  throw new Error(`tour: no action trigger with data-action="${kind}"`)
}
const stepAttr = async (env: E, name: string) => {
  const c = await content(env)
  return c ? c.attr(name) : null
}

type Direction = "next" | "prev"
/** The physical arrow key that means `direction` (swapped right-to-left). */
const arrowFor = async (env: E, direction: Direction) => {
  const rtl = (await env.part("positioner").attr("dir")) === "rtl"
  return (direction === "next") !== rtl ? "ArrowRight" : "ArrowLeft"
}

function tourContractWith(_modal: boolean) {
  return contract("tour", {
    machine: tourMachine,
    anatomy: [
      "trigger",
      "backdrop",
      "spotlight",
      "positioner",
      "content",
      "arrow",
      "title",
      "description",
      "progress-text",
      "action-trigger",
      "close-trigger",
    ],
    // Located through its trigger: an idle tour has no content to find.
    locate: ({ name }: { readonly name: string | RegExp }) => ({ role: "button" as const, name }),
    queries: {
      ...positioningQueries,
      isOpen,
      phase,
      stepId: async (env: E) => stepAttr(env, "data-step"),
      stepIndex: async (env: E) => Number((await stepAttr(env, "data-step-index")) ?? -1),
      totalSteps: async (env: E) => Number((await stepAttr(env, "data-step-count")) ?? 0),
      title: async (env: E) => ((await content(env)) ? env.part("content").accessibleName() : null),
      description: async (env: E) =>
        (await content(env)) ? env.part("content").accessibleDescription() : null,
      progressText: async (env: E) =>
        (await env.part("progress-text").exists()) ? env.part("progress-text").text() : null,
      isModal: async (env: E) => (await stepAttr(env, "aria-modal")) === "true",
      hasFocus,
      isTopmost: async (env: E) =>
        !!(await content(env)) && (await env.part("content").attr("data-has-nested")) === null,
      /** The spotlight's box (null for a centred step or while preparing). */
      spotlightRect: async (env: E) =>
        (await env.part("spotlight").exists()) &&
        (await env.part("spotlight").attr("hidden")) === null
          ? env.part("spotlight").box()
          : null,
      /** The last close reason, while the card exits. */
      closeReason: async (env: E) => stepAttr(env, "data-close-reason"),
    },
    actions: {
      start: {
        pointer: async (env: E) => env.part("trigger").click(),
        touch: async (env: E) => env.part("trigger").tap(),
        keyboard: async (env: E) => env.part("trigger").press("Enter"),
        // A step shown and placed, focus in the card (never the other way round).
        done: async (env: E) =>
          (await isOpen(env)) &&
          (await phase(env)) === "shown" &&
          (await positioningQueries.isPlaced(env)) &&
          (await hasFocus(env)),
      },
      next: {
        pointer: async (env: E) => (await action(env, "next")).click(),
        touch: async (env: E) => (await action(env, "next")).tap(),
        keyboard: async (env: E) => (await action(env, "next")).press("Enter"),
        done: async () => true,
      },
      prev: {
        pointer: async (env: E) => (await action(env, "prev")).click(),
        touch: async (env: E) => (await action(env, "prev")).tap(),
        keyboard: async (env: E) => (await action(env, "prev")).press("Enter"),
        done: async () => true,
      },
      skip: {
        pointer: async (env: E) => (await action(env, "skip")).click(),
        touch: async (env: E) => (await action(env, "skip")).tap(),
        keyboard: async (env: E) => (await action(env, "skip")).press("Enter"),
        done: closed,
      },
      /** The close trigger: ends the tour with `dismiss`. */
      dismiss: {
        pointer: async (env: E) => env.part("close-trigger").click(),
        touch: async (env: E) => env.part("close-trigger").tap(),
        keyboard: async (env: E) => env.part("close-trigger").press("Enter"),
        done: closed,
      },
      pressEscape: {
        keyboard: async (env: E) => env.keyboard("Escape"),
        done: closed,
      },
      /** A no-op unless `closeOnOutsidePress`. */
      pressOutside: {
        pointer: async (env: E) => env.pointerOutside(),
        none: { keyboard: "an outside press is a pointer interaction" },
        done: async () => true,
      },
      pressArrow: {
        keyboard: async (env: E, direction: Direction) =>
          env.part("content").press(await arrowFor(env, direction)),
        done: async () => true,
      },
      tab: { keyboard: async (env: E) => env.keyboard("Tab"), done: async () => true },
      shiftTab: {
        keyboard: async (env: E) => env.keyboard("Tab", { shift: true }),
        done: async () => true,
      },
      /** The prepared step became shown (or waited on): the visit effect's STEP.READY. */
      waitForReady: {
        // Observation only, in the path's own modality (nothing is pressed).
        pointer: async () => {},
        touch: async () => {},
        keyboard: async () => {},
        done: async (env: E) => ["shown", "waiting"].includes(await phase(env)),
      },
      waitForStep: {
        // Observation only: the step's preparation or effect moves the tour.
        keyboard: async (_env: E, _id: string) => {},
        done: async (env: E, id: string) => (await stepAttr(env, "data-step")) === id,
      },
      waitForUnmount: {
        keyboard: async (env: E) => env.part("content").waitForDetach(),
        done: async () => true,
      },
    },
    states: {
      idle: { isOpen: false },
      // A step whose target and effect are ready at once is shown within the same event:
      // the page may already be past `preparing` when the oracle is still in it.
      preparing: { isOpen: true },
      active: { isOpen: true, phase: "shown", isPlaced: true },
      waiting: { isOpen: true, phase: "waiting" },
    },
    dataState: {
      idle: { trigger: "closed" },
      preparing: { trigger: "open" },
      active: { trigger: "open", backdrop: "open", positioner: "open", content: "open" },
      waiting: { trigger: "open", backdrop: "open" },
    },
    events: {
      START: {
        from: {
          idle: "start",
          preparing: { skip: "start() while open goes to the step: covered by the machine tests" },
          active: { skip: "start() while open goes to the step: covered by the machine tests" },
          waiting: { skip: "start() while open goes to the step: covered by the machine tests" },
        },
      },
      "STEP.NEXT": "next",
      "STEP.PREV": "prev",
      skip: "skip",
      dismiss: "dismiss",
      "escape-key": "pressEscape",
      "outside-press": {
        skip: "closeOnOutsidePress is off by default: covered by the machine tests",
      },
      "outside-focus": { skip: "closeOnOutsideFocus is off by default: machine tests" },
      api: { skip: "stop() and parent-dismissed: covered by the machine tests" },
      "STEP.GOTO": { skip: "goto() and custom actions: covered by the machine tests" },
      "STEP.RESUME": { skip: "a restarted service (Strict Mode): covered by the machine tests" },
      "STEP.READY": {
        action: "waitForReady",
        // The oracle never runs effects: it receives the visit the page's effect made.
        event: (view) => ({
          visit: createStepVisit(String((view.context as TourContext).pendingId)),
        }),
      },
      "STEP.MISSING": { skip: "timer driven: covered by the machine tests (fake time)" },
      "STEP.UPDATE": { skip: "a step effect's update(): covered by the machine tests" },
      "STEPS.SET": { skip: "prop driven: covered by the machine tests" },
      "STEP.SYNCED": { skip: "a controlled stepId: covered by the machine tests" },
      "TARGET.LOST": { skip: "DOM driven: covered by the browser tests" },
      "POSITION.PLACED": { skip: "emitted by positioning (fakePositioning in the node tests)" },
      "POSITION.REPOSITION": { skip: "an API call (reposition()): covered by the DOM tests" },
      "SPOTLIGHT.SETTLED": {
        skip: "the spotlight's transition end or a scroll: covered by the browser tests",
      },
      "$sync:open": { props: (target) => ({ open: target !== "idle" }) },
      "$props:steps": { skip: "a new steps array: covered by the machine tests" },
      "$props:stepId": { skip: "a controlled stepId: covered by the machine tests" },
    },
    // No `modal` trait even for a modal tour: a modal anchored step keeps its target exposed
    // and operable (spec: Modality), which the generic "everything outside is inert" check
    // forbids. Inert, scroll lock and Tab wrap of modal steps are covered by the DOM tests.
    traits: ["layer", "restores-focus", "presence", "anchored"],
    // `hasFocus` observes where focus is: focusing a part of the card moves it by definition.
    // A sync step is shown while the oracle is still `preparing`: the same parts there.
    commitsOnFocus: (["preparing", "active"] as const).flatMap((state) =>
      (["trigger", "action-trigger", "close-trigger", "content"] as const).map((part) => ({
        part,
        state,
      })),
    ),
    semantics: { trigger: "trigger", content: "content", label: "title" },
  })
}

/** A tour whose anchored steps are non-modal (the default). */
export const tourContract = tourContractWith(false)
/** A tour with `modal`: adds the `modal` trait. */
export const modalTourContract = tourContractWith(true)
