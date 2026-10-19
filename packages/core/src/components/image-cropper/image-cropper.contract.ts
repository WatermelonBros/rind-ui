import { contract, type Invariant } from "../../contract/contract"
import type { Env, Key } from "../../contract/env"
import type { HandlePosition } from "./geometry"
import { imageCropperMachine } from "./image-cropper.machine"

type P = "root" | "viewport" | "image" | "selection" | "handle" | "grid"
type E = Env<P>

const num = async (env: E, attr: `data-${string}`) =>
  Number((await env.part("selection").attr(attr)) ?? 0)
const arrow = (dx: number, dy: number): Key =>
  dx > 0 ? "ArrowRight" : dx < 0 ? "ArrowLeft" : dy > 0 ? "ArrowDown" : "ArrowUp"

/** Presses the arrow for (dx, dy) once per pixel step (nudgeStep 1), `alt` to resize. */
async function arrows(env: E, dx: number, dy: number, alt: boolean) {
  const sel = env.part("selection")
  await sel.focus()
  for (let i = 0; i < Math.abs(dx); i++) await sel.press(arrow(dx, 0), alt ? { alt: true } : {})
  for (let i = 0; i < Math.abs(dy); i++) await sel.press(arrow(0, dy), alt ? { alt: true } : {})
}

/** Image Cropper invariants: the image always covers the crop; one tab stop; never live. */
const invariants: readonly Invariant<P>[] = [
  {
    name: "image-cropper-covered",
    check: async ({ env }) => {
      const ready = (await env.part("image").attr("data-ready")) !== null
      if (!ready) return undefined
      return (await env.part("selection").attr("data-covered")) !== null
        ? undefined
        : "the image does not cover the crop"
    },
  },
  {
    name: "image-cropper-not-live",
    check: async ({ env }) =>
      (await env.part("root").attr("aria-live")) === null ? undefined : "the root is a live region",
  },
]

/** Image Cropper's contract (spec "Contract"): located by the Root's name. */
export const imageCropperContract = contract("image-cropper", {
  machine: imageCropperMachine,
  anatomy: ["root", "viewport", "image", "selection", "handle", "grid"],
  locate: (anchor?: { readonly name: string | RegExp }) =>
    anchor ? { role: "group", name: anchor.name } : { part: "root" },
  actions: {
    /** Waits for the image and the viewport (the model's first steps). */
    settleLayout: {
      pointer: async (env) => env.advance(16),
      keyboard: async (env) => env.advance(16),
      done: async (): Promise<boolean> => true,
    },
    nudge: {
      keyboard: async (env, dx: number, dy: number) => arrows(env, dx, dy, false),
      done: async (): Promise<boolean> => true,
    },
    resize: {
      keyboard: async (env, dx: number, dy: number) => arrows(env, dx, dy, true),
      done: async (): Promise<boolean> => true,
    },
    zoomIn: {
      keyboard: async (env) => {
        await env.part("selection").focus()
        await env.part("selection").press("+")
      },
      done: async (): Promise<boolean> => true,
    },
    zoomOut: {
      keyboard: async (env) => {
        await env.part("selection").focus()
        await env.part("selection").press("-")
      },
      done: async (): Promise<boolean> => true,
    },
    dragSelection: {
      pointer: async (env, dx: number, dy: number) => env.part("selection").drag({ x: dx, y: dy }),
      none: { keyboard: "the arrows are `nudge`" },
      done: async (): Promise<boolean> => true,
    },
    dragHandle: {
      pointer: async (env, position: HandlePosition, dx: number, dy: number) =>
        env.part("root").withAttr("data-position", position).drag({ x: dx, y: dy }),
      none: { keyboard: "Alt with the arrows is `resize`" },
      done: async (): Promise<boolean> => true,
    },
  },
  queries: {
    crop: async (env: E) => ({
      x: await num(env, "data-x"),
      y: await num(env, "data-y"),
      width: await num(env, "data-width"),
      height: await num(env, "data-height"),
    }),
    zoom: async (env: E) => {
      const style = (await env.part("root").attr("style")) ?? ""
      return Number(/--rind-image-zoom:\s*([\d.]+)/.exec(style)?.[1] ?? 1)
    },
    valueText: async (env: E) => (await env.part("selection").attr("aria-valuetext")) ?? "",
    covered: async (env: E) => (await env.part("selection").attr("data-covered")) !== null,
  },
  states: {
    // Loading lasts until the first layout, which any wait may complete: not checked.
    loading: {},
    idle: { covered: true },
    dragging: { covered: true },
    settling: { covered: true },
  },
  events: {
    "IMAGE.LOADED": { action: "settleLayout", event: () => ({ width: 400, height: 300 }) },
    "VIEWPORT.MEASURED": { action: "settleLayout", event: () => ({ width: 400, height: 300 }) },
    "KEY.NUDGE": {
      action: "nudge",
      // `as never`: the mapping's args are typed across every action; nudge takes (dx, dy).
      args: (() => [1, 0]) as never,
      event: () => ({ dx: 1, dy: 0, resize: false }),
    },
    "ZOOM.STEP": { action: "zoomIn", event: () => ({ direction: 1 }) },
    "DRAG.START": { skip: "a drag is start, moves and end in one gesture: the DOM tests" },
    "DRAG.MOVE": { skip: "part of a drag: the DOM tests" },
    "DRAG.END": { skip: "part of a drag: the DOM tests" },
    "PINCH.START": { skip: "two-finger touch: the browser tests" },
    "PINCH.MOVE": { skip: "two-finger touch: the browser tests" },
    "PINCH.END": { skip: "two-finger touch: the browser tests" },
    RESET: { skip: "an API call: the DOM tests" },
    SYNCED: { skip: "the parent's values: the controlled DOM tests" },
    FIT: { skip: "internal: after a layout prop changed" },
    "$props:crop": { skip: "the parent's crop: the controlled DOM tests" },
    "$props:zoom": { skip: "the parent's zoom: the controlled DOM tests" },
    "$props:rotation": { skip: "the parent's rotation: the controlled DOM tests" },
    "$props:flip": { skip: "the parent's flip: the controlled DOM tests" },
    "$props:aspectRatio": { skip: "a layout prop: the machine tests" },
    "$props:cropShape": { skip: "a layout prop: the machine tests" },
    "$props:fixedCropArea": { skip: "a layout prop: the machine tests" },
  },
  traits: [],
  invariants,
})
