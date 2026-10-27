// Floating Panel's contract (spec "Floating Panel Contract"): keys on the DragTrigger (the
// keyboard twin of every pointer drag), the stage and close triggers as a user presses them.

import { contract } from "../../contract/contract"
import type { Env, Key } from "../../contract/env"
import { floatingPanelMachine } from "./floating-panel.machine"

type P =
  | "root"
  | "trigger"
  | "positioner"
  | "content"
  | "header"
  | "drag-trigger"
  | "drag-hint"
  | "title"
  | "description"
  | "control"
  | "stage-trigger"
  | "close-trigger"
  | "body"
  | "resize-trigger"
type E = Env<P>

const cssPx = async (env: E, name: string) =>
  Number.parseFloat(
    new RegExp(`--rind-floating-panel-${name}:\\s*([^;]+)`).exec(
      (await env.part("positioner").attr("style")) ?? "",
    )?.[1] ?? "0",
  )
const stage = async (env: E) => (await env.part("content").attr("data-stage")) ?? "default"
// The Content is unmounted while closed: closed, not an error.
const isOpen = async (env: E) =>
  (await env.part("content").exists()) && (await env.part("content").attr("data-state")) === "open"

/** Presses `key` `times` times on the DragTrigger (`alt`: resize). */
async function steps(env: E, dx: number, dy: number, alt: boolean) {
  const t = env.part("drag-trigger")
  await t.focus()
  const press = async (key: Key, n: number) => {
    for (let i = 0; i < n; i++) await t.press(key, { alt })
  }
  // Steps of 10 px (the default `step`).
  await press(dx < 0 ? "ArrowLeft" : "ArrowRight", Math.round(Math.abs(dx) / 10))
  await press(dy < 0 ? "ArrowUp" : "ArrowDown", Math.round(Math.abs(dy) / 10))
}

/** The stage trigger that switches to `target`. */
async function stageButton(env: E, target: "minimized" | "maximized" | "default") {
  for (const b of await env.part("stage-trigger").all()) {
    if ((await b.attr("data-stage-target")) === target) return b
  }
  throw new Error(`no stage trigger switches to "${target}"`)
}

export const floatingPanelContract = contract("floating-panel", {
  machine: floatingPanelMachine,
  anatomy: [
    "root",
    "trigger",
    "positioner",
    "content",
    "header",
    "drag-trigger",
    "drag-hint",
    "title",
    "description",
    "control",
    "stage-trigger",
    "close-trigger",
    "body",
    "resize-trigger",
  ],
  locate: (anchor?: { readonly title: string | RegExp }) =>
    // Without a title: the Root, mounted while closed too (open, then close, on one driver).
    anchor ? { role: "dialog", name: anchor.title } : { part: "root" },
  actions: {
    open: {
      pointer: (env: E) => env.part("trigger").click(),
      touch: (env: E) => env.part("trigger").tap(),
      keyboard: async (env: E) => {
        await env.part("trigger").focus()
        await env.part("trigger").press("Enter")
      },
      done: isOpen,
    },
    close: {
      pointer: (env: E) => env.part("close-trigger").click(),
      touch: (env: E) => env.part("close-trigger").tap(),
      keyboard: async (env: E) => {
        await env.part("close-trigger").focus()
        await env.part("close-trigger").press("Enter")
      },
      done: async (env: E) => !(await isOpen(env)),
    },
    moveBy: {
      keyboard: async (env: E, dx: number, dy: number) => steps(env, dx, dy, false),
      none: {
        pointer: "a pointer drag needs layout (browser tests)",
        touch: "a pointer drag needs layout",
      },
      done: async () => true,
    },
    resizeBy: {
      keyboard: async (env: E, dx: number, dy: number) => steps(env, dx, dy, true),
      none: {
        pointer: "a pointer drag needs layout (browser tests)",
        touch: "a pointer drag needs layout",
      },
      done: async () => true,
    },
    minimize: {
      pointer: async (env: E) => (await stageButton(env, "minimized")).click(),
      touch: async (env: E) => (await stageButton(env, "minimized")).tap(),
      none: { keyboard: "the same button by keyboard: use pointer or virtual" },
      done: async (env: E) => (await stage(env)) === "minimized",
    },
    maximize: {
      pointer: async (env: E) => (await stageButton(env, "maximized")).click(),
      touch: async (env: E) => (await stageButton(env, "maximized")).tap(),
      keyboard: async (env: E) => {
        await env.part("drag-trigger").focus()
        await env.part("drag-trigger").press("Enter")
      },
      done: async (env: E) => (await stage(env)) === "maximized",
    },
    restore: {
      pointer: async (env: E) => (await stageButton(env, "default")).click(),
      touch: async (env: E) => (await stageButton(env, "default")).tap(),
      none: { keyboard: "the same button by keyboard: use pointer or virtual" },
      done: async (env: E) => (await stage(env)) === "default",
    },
  },
  queries: {
    isOpen,
    position: async (env: E) => ({ x: await cssPx(env, "x"), y: await cssPx(env, "y") }),
    size: async (env: E) => ({
      width: await cssPx(env, "width"),
      height: await cssPx(env, "height"),
    }),
    stage,
    isDragging: async (env: E) =>
      (await env.part("content").attr("data-dragging")) !== null ||
      (await env.part("content").attr("data-resizing")) !== null,
  },
  states: {
    idle: { isDragging: false },
    moving: { isDragging: true },
    resizing: { isDragging: true },
  },
  events: {
    "MOVE.STEP": "moveBy",
    "RESIZE.STEP": "resizeBy",
    "STAGE.TOGGLE_MAXIMIZED": "maximize",
  },
  traits: [],
})
