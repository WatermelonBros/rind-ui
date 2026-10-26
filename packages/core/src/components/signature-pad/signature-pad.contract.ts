import { contract, type Invariant } from "../../contract/contract"
import type { Env } from "../../contract/env"
import { signaturePadMachine } from "./signature-pad.machine"

type P =
  | "root"
  | "label"
  | "control"
  | "segment"
  | "guide"
  | "status"
  | "clear-trigger"
  | "undo-trigger"
  | "hidden-input"
  | "stroke"
type E = Env<P>

/** A point of a driven stroke, as fractions of the Control's box (0 to 1). */
export interface SignaturePadAt {
  readonly x: number
  readonly y: number
}

const DEFAULT_STROKE: readonly SignaturePadAt[] = [
  { x: 0.2, y: 0.6 },
  { x: 0.35, y: 0.4 },
  { x: 0.5, y: 0.65 },
  { x: 0.7, y: 0.35 },
]

type PointerType = "mouse" | "pen" | "touch"

async function stroke(
  env: E,
  points: readonly SignaturePadAt[],
  pointerType: PointerType,
  end: "up" | "cancel",
) {
  const control = env.part("control")
  const [first, ...rest] = points
  if (!first) return
  await control.pointer("down", { at: first, pointerType })
  for (const at of rest) await control.pointer("move", { at, pointerType })
  await control.pointer(end, { at: points[points.length - 1] ?? first, pointerType })
}

const empty = async (env: E) => (await env.part("root").attr("data-empty")) !== null

const DRAW_ONLY =
  "drawing is a pointer path (WCAG 2.1.1 exception); the docs pair it with a typed alternative"

const press = (part: "clear-trigger" | "undo-trigger") => ({
  pointer: (env: E) => env.part(part).click(),
  touch: (env: E) => env.part(part).tap(),
  keyboard: async (env: E) => {
    await env.part(part).focus()
    await env.part(part).press("Enter")
  },
  done: async () => true,
})

/**
 * Signature Pad invariants (spec "Signature Pad Contract"): the triggers are never hidden,
 * and the Status matches emptiness (the Status text is per locale, so its presence and the
 * empty flag are what is compared: the Status says something either way).
 */
const invariants: readonly Invariant<P>[] = [
  {
    name: "signature-pad-triggers-never-hidden",
    check: async ({ env }) => {
      for (const part of ["clear-trigger", "undo-trigger"] as const) {
        for (const el of await env.part(part).all()) {
          if ((await el.attr("hidden")) !== null) return `the ${part} is hidden`
        }
      }
      return undefined
    },
  },
  {
    name: "signature-pad-triggers-disabled-when-empty",
    check: async ({ env }) => {
      const isEmpty = await empty(env)
      for (const part of ["clear-trigger", "undo-trigger"] as const) {
        for (const el of await env.part(part).all()) {
          const disabled = (await el.attr("aria-disabled")) === "true"
          if (isEmpty && !disabled) return `the ${part} is enabled on an empty pad`
        }
      }
      return undefined
    },
  },
]

/**
 * Signature Pad's contract (spec "Signature Pad Contract"): located by the Label's text, or as
 * the only pad in the target. Drawing needs layout (a real browser); `clear` and `undo` run
 * anywhere.
 */
export const signaturePadContract = contract("signature-pad", {
  machine: signaturePadMachine,
  anatomy: [
    "root",
    "label",
    "control",
    "segment",
    "guide",
    "status",
    "clear-trigger",
    "undo-trigger",
    "hidden-input",
    "stroke",
  ],
  locate: (anchor?: { readonly label: string | RegExp }) =>
    anchor ? { text: anchor.label } : { part: "root" },
  actions: {
    /** One stroke through `points` (fractions of the Control's box). */
    draw: {
      pointer: (env: E, points: readonly SignaturePadAt[] = DEFAULT_STROKE) =>
        stroke(env, points, "mouse", "up"),
      touch: (env: E, points: readonly SignaturePadAt[] = DEFAULT_STROKE) =>
        stroke(env, points, "touch", "up"),
      none: { keyboard: DRAW_ONLY },
      done: async () => true,
    },
    /** A dot. */
    tap: {
      pointer: (env: E, at: SignaturePadAt = { x: 0.5, y: 0.5 }) =>
        stroke(env, [at], "mouse", "up"),
      touch: (env: E, at: SignaturePadAt = { x: 0.5, y: 0.5 }) => stroke(env, [at], "touch", "up"),
      none: { keyboard: DRAW_ONLY },
      done: async () => true,
    },
    /** A second finger goes down and moves while the first draws: only the first is ink. */
    drawWithTwoPointers: {
      touch: async (env: E) => {
        const control = env.part("control")
        await control.pointer("down", { at: { x: 0.2, y: 0.5 }, pointerType: "touch" })
        await control.pointer("down", {
          at: { x: 0.8, y: 0.2 },
          pointerType: "touch",
          pointerId: 3,
        })
        await control.pointer("move", { at: { x: 0.4, y: 0.5 }, pointerType: "touch" })
        await control.pointer("move", {
          at: { x: 0.8, y: 0.8 },
          pointerType: "touch",
          pointerId: 3,
        })
        await control.pointer("move", { at: { x: 0.6, y: 0.4 }, pointerType: "touch" })
        await control.pointer("up", { at: { x: 0.8, y: 0.8 }, pointerType: "touch", pointerId: 3 })
        await control.pointer("up", { at: { x: 0.6, y: 0.4 }, pointerType: "touch" })
      },
      none: { keyboard: DRAW_ONLY },
      done: async () => true,
    },
    /** A stroke the browser cancels midway (a system gesture): what was drawn is kept. */
    cancelStroke: {
      pointer: (env: E) => stroke(env, DEFAULT_STROKE, "mouse", "cancel"),
      touch: (env: E) => stroke(env, DEFAULT_STROKE, "touch", "cancel"),
      none: { keyboard: DRAW_ONLY },
      done: async () => true,
    },
    clear: press("clear-trigger"),
    undo: press("undo-trigger"),
  },
  queries: {
    isEmpty: empty,
    /** The strokes rendered in the Segment (the one being drawn included). */
    strokeCount: async (env: E) => (await env.part("stroke").all()).length,
    formValue: async (env: E) => env.part("hidden-input").value(),
    /** The Control's accessible name. */
    name: async (env: E) => env.part("control").accessibleName(),
    statusText: async (env: E) => env.part("status").text(),
    clearDisabled: async (env: E) =>
      (await env.part("clear-trigger").attr("aria-disabled")) === "true",
    undoDisabled: async (env: E) =>
      (await env.part("undo-trigger").attr("aria-disabled")) === "true",
  },
  states: {
    idle: { isEmpty: true },
    drawing: {},
  },
  events: {
    "POINTER.DOWN": "draw",
    CLEAR: "clear",
    UNDO: "undo",
  },
  traits: [],
  invariants,
})
