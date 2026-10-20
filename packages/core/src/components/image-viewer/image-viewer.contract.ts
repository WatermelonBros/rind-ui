import { contract, type Invariant } from "../../contract/contract"
import type { Env } from "../../contract/env"
import { imageViewerMachine } from "./image-viewer.machine"

type P = "root" | "viewport" | "image" | "zoom-in" | "zoom-out" | "reset" | "zoom-text"
type E = Env<P>

const zoomOf = async (env: E) => Number((await env.part("viewport").attr("data-zoom")) ?? "1")

/** Image Viewer invariants: never a live region (the zoom is announced once per burst). */
const invariants: readonly Invariant<P>[] = [
  {
    name: "image-viewer-not-live",
    check: async ({ env }) =>
      (await env.part("viewport").attr("aria-live")) === null
        ? undefined
        : "the viewport is a live region",
  },
]

/** Image Viewer's contract (spec "Contract"): located by the viewport's name. */
export const imageViewerContract = contract("image-viewer", {
  machine: imageViewerMachine,
  anatomy: ["root", "viewport", "image", "zoom-in", "zoom-out", "reset", "zoom-text"],
  locate: (anchor?: { readonly name: string | RegExp }) =>
    anchor ? { role: "group", name: anchor.name } : { part: "viewport" },
  actions: {
    /** Lets the image load and the viewport measure (a frame). */
    settleLayout: {
      pointer: async (env) => env.advance(16),
      keyboard: async (env) => env.advance(16),
      done: async (): Promise<boolean> => true,
    },
    zoomIn: {
      pointer: async (env) => env.part("zoom-in").click(),
      keyboard: async (env) => {
        await env.part("viewport").focus()
        await env.part("viewport").press("+")
      },
      done: async (): Promise<boolean> => true,
    },
    zoomOut: {
      pointer: async (env) => env.part("zoom-out").click(),
      keyboard: async (env) => {
        await env.part("viewport").focus()
        await env.part("viewport").press("-")
      },
      done: async (): Promise<boolean> => true,
    },
    reset: {
      pointer: async (env) => env.part("reset").click(),
      keyboard: async (env) => {
        await env.part("viewport").focus()
        await env.part("viewport").press("0")
      },
      done: async (): Promise<boolean> => true,
    },
    /**
     * Moves the view `dx` / `dy` steps right / down (negative: left / up): arrow presses, or a
     * drag of the image the other way (40 px a step).
     */
    pan: {
      pointer: async (env, dx: number, dy: number) =>
        env.part("viewport").drag({ x: -dx * 40, y: -dy * 40 }),
      keyboard: async (env, dx: number, dy: number) => {
        await env.part("viewport").focus()
        for (let i = 0; i < Math.abs(dx); i++) {
          await env.part("viewport").press(dx > 0 ? "ArrowRight" : "ArrowLeft")
        }
        for (let i = 0; i < Math.abs(dy); i++) {
          await env.part("viewport").press(dy > 0 ? "ArrowDown" : "ArrowUp")
        }
      },
      done: async (): Promise<boolean> => true,
    },
  },
  queries: {
    zoom: zoomOf,
    /** The pan offset (px) from the Root's variables. */
    offset: async (env: E) => {
      const style = (await env.part("root").attr("style")) ?? ""
      const read = (name: string) =>
        Number(new RegExp(`${name}:\\s*(-?[\\d.]+)px`).exec(style)?.[1] ?? "0")
      return { x: read("--rind-image-offset-x"), y: read("--rind-image-offset-y") }
    },
    canZoomIn: async (env: E) => (await env.part("zoom-in").attr("aria-disabled")) !== "true",
    canZoomOut: async (env: E) => (await env.part("zoom-out").attr("aria-disabled")) !== "true",
  },
  states: { loading: {}, idle: {}, panning: {}, settling: {} },
  events: {
    "ZOOM.STEP": {
      action: "zoomIn",
      event: () => ({ direction: 1, source: "button" }),
    },
    RESET: { action: "reset", event: () => ({ source: "button" }) },
    "PAN.KEY": { skip: "panning needs a zoom first: the DOM tests" },
    "IMAGE.LOADED": { action: "settleLayout", event: () => ({ width: 800, height: 400 }) },
    "VIEWPORT.MEASURED": { action: "settleLayout", event: () => ({ width: 400, height: 200 }) },
    "ZOOM.BY": { skip: "ctrl-wheel and trackpad pinch: the DOM tests" },
    TOGGLE: { skip: "double click: the DOM tests" },
    "DRAG.START": { skip: "a drag is start, moves and end in one gesture: the DOM tests" },
    "DRAG.MOVE": { skip: "part of a drag: the DOM tests" },
    "DRAG.END": { skip: "part of a drag: the DOM tests" },
    "PINCH.START": { skip: "two-finger touch: the browser tests" },
    "PINCH.MOVE": { skip: "two-finger touch: the browser tests" },
    "PINCH.END": { skip: "two-finger touch: the browser tests" },
    SYNCED: { skip: "the parent's zoom: the controlled DOM tests" },
    "$props:zoom": { skip: "the parent's zoom: the controlled DOM tests" },
  },
  traits: [],
  invariants,
})
