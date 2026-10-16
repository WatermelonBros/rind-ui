// The Scroll Area's contract (design §4). Every query reads attributes the component writes
// (scroll position through the overflow-edge attributes), so it works the same in jsdom, browser
// mode and Playwright. Scrolling itself is the browser's: keyboard actions press real keys.

import { contract, type Invariant } from "../../contract/contract"
import type { Env } from "../../contract/env"
import type { ScrollAxis } from "./scroll-area.machine"
import { scrollAreaMachine } from "./scroll-area.machine"

type P = "root" | "viewport" | "content" | "scrollbar" | "thumb" | "corner"
type E = Env<P>

const orientation = (axis: ScrollAxis) => (axis === "x" ? "horizontal" : "vertical")
/** The Scrollbar or Thumb of `axis` (several parts share a name; orientation tells them apart). */
async function ofAxis(env: E, part: "scrollbar" | "thumb", axis: ScrollAxis) {
  for (const p of await env.part(part).all()) {
    if ((await p.attr("data-orientation")) === orientation(axis)) return p
  }
  return null
}
const has = async (env: E, part: P, name: `data-${string}`) =>
  (await env.part(part).attr(name)) !== null

const hasOverflow = async (env: E, axis: ScrollAxis) => has(env, "root", `data-overflow-${axis}`)
const atStart = async (env: E, axis: ScrollAxis) =>
  !(await has(env, "root", `data-overflow-${axis}-start`))
const atEnd = async (env: E, axis: ScrollAxis) =>
  !(await has(env, "root", `data-overflow-${axis}-end`))
const isDragging = async (env: E, axis: ScrollAxis) =>
  ((await (await ofAxis(env, "thumb", axis))?.attr("data-dragging")) ?? null) !== null
const isScrollbarVisible = async (env: E, axis: ScrollAxis) =>
  (await (await ofAxis(env, "scrollbar", axis))?.attr("data-state")) === "visible"
const isTabStop = async (env: E) => (await env.part("viewport").attr("tabindex")) === "0"

/** Polls a fact the page settles a frame later (measurement is rAF-coalesced). */
const settled = (env: E, read: () => Promise<boolean>) => env.until(read, (v) => v).then((v) => v)

type ScrollTo = "start" | "end" | "page-forward" | "page-back"

async function scrollWithKeys(env: E, axis: ScrollAxis, to: ScrollTo) {
  const vp = env.part("viewport")
  if (!(await vp.isFocused())) await vp.focus()
  if (axis === "y") {
    const key = { start: "Home", end: "End", "page-forward": "PageDown", "page-back": "PageUp" }[
      to
    ] as "Home" | "End" | "PageDown" | "PageUp"
    return vp.press(key)
  }
  // Horizontal: arrows until the edge (drivers mirror them under RTL: `directional`).
  const key = to === "start" || to === "page-back" ? "ArrowLeft" : "ArrowRight"
  for (let i = 0; i < 400; i++) {
    if (to === "start" && (await atStart(env, axis))) return
    if (to === "end" && (await atEnd(env, axis))) return
    await vp.press(key)
    if (to.startsWith("page") && i >= 9) return
  }
}

/** Where a fraction of the track is, as fractions of the Scrollbar's box. */
const along = (axis: ScrollAxis, f: number) => (axis === "y" ? { x: 0.5, y: f } : { x: f, y: 0.5 })

async function drag(env: E, axis: ScrollAxis, fraction: number, kind: "mouse" | "touch") {
  const t = await ofAxis(env, "thumb", axis)
  const b = await ofAxis(env, "scrollbar", axis)
  if (!t || !b || !(await t.box())) {
    throw new Error("scroll-area: dragThumb needs a laid-out Scrollbar and Thumb (a real browser)")
  }
  await t.pointer("down", { at: { x: 0.5, y: 0.5 }, pointerType: kind })
  await b.pointer("move", { at: along(axis, fraction), pointerType: kind })
  await b.pointer("up", { at: along(axis, fraction), pointerType: kind })
}

async function press(env: E, axis: ScrollAxis, side: "back" | "forward") {
  const b = await ofAxis(env, "scrollbar", axis)
  if (!b) throw new Error(`scroll-area: no ${orientation(axis)} Scrollbar to press`)
  const at = along(axis, side === "forward" ? 0.97 : 0.03)
  await b.pointer("down", { at, pointerType: "mouse" })
  await b.pointer("up", { at, pointerType: "mouse" })
}

/** Spec "Viewport Tab Stop": the Viewport is a tab stop exactly when the rule says so. */
const tabStopRule: Invariant<P> = {
  name: "scroll-area-tab-stop",
  check: async ({ env }) => {
    const vp = env.part("viewport")
    if ((await vp.count()) === 0 || (await vp.isFocused())) return undefined
    const expected = (await vp.attr("data-tab-stop")) !== null
    const actual = (await vp.attr("tabindex")) === "0"
    if (expected && !actual) {
      return "the Viewport overflows, its content has nothing focusable, and it is not a tab stop (tabindex 0)"
    }
    if (!expected && actual) return "the Viewport is a tab stop although the rule says it is not"
    return undefined
  },
}

const hiddenPartsNotFocusable: Invariant<P> = {
  name: "scroll-area-scrollbars-hidden",
  check: async ({ env }) => {
    for (const part of ["scrollbar", "thumb", "corner"] as const) {
      for (const el of await env.part(part).all()) {
        if ((await el.attr("aria-hidden")) !== "true") return `a ${part} is not aria-hidden`
        if ((await el.attr("tabindex")) !== null) return `a ${part} is focusable`
      }
    }
    return undefined
  },
}

const oneDraggingAxis: Invariant<P> = {
  name: "scroll-area-one-dragging-axis",
  check: async ({ env }) =>
    (await isDragging(env, "x")) && (await isDragging(env, "y"))
      ? "both axes carry data-dragging"
      : undefined,
}

const viewportNotPresentational: Invariant<P> = {
  name: "scroll-area-viewport-role",
  check: async ({ env }) => {
    const role = await env.part("viewport").attr("role")
    return role === "presentation" || role === "none"
      ? `the Viewport has role="${role}"`
      : undefined
  },
}

export const scrollAreaInvariants = [
  tabStopRule,
  hiddenPartsNotFocusable,
  oneDraggingAxis,
  viewportNotPresentational,
] as const

export const scrollAreaContract = contract("scroll-area", {
  machine: scrollAreaMachine,
  anatomy: ["root", "viewport", "content", "scrollbar", "thumb", "corner"],
  // A named Viewport by its region name; an unnamed area by text in its Content.
  locate: (anchor: { readonly name: string | RegExp } | { readonly text: string | RegExp }) =>
    "name" in anchor ? { role: "region", name: anchor.name } : { text: anchor.text },
  queries: {
    hasOverflow,
    isScrollbarVisible,
    atStart,
    atEnd,
    isDragging,
    isTabStop,
  },
  actions: {
    focusViewport: {
      keyboard: async (env: E) => env.part("viewport").focusWithTab(),
      // A press focuses a focusable Viewport; assistive technology moves focus programmatically.
      pointer: async (env: E) =>
        env.modality === "virtual" ? env.part("viewport").focus() : env.part("viewport").click(),
      done: async (env: E) => env.part("viewport").isFocused(),
    },
    scroll: {
      keyboard: async (env: E, axis: ScrollAxis, to: ScrollTo) => scrollWithKeys(env, axis, to),
      pointer: async (env: E, axis: ScrollAxis, to: ScrollTo) => {
        if (to === "page-forward" || to === "page-back") {
          return press(env, axis, to === "page-forward" ? "forward" : "back")
        }
        return drag(
          env,
          axis,
          axis === "y" ? (to === "end" ? 1 : 0) : to === "end" ? 1 : 0,
          "mouse",
        )
      },
      done: async (env: E, axis: ScrollAxis, to: ScrollTo) =>
        to === "start"
          ? settled(env, () => atStart(env, axis))
          : to === "end"
            ? settled(env, () => atEnd(env, axis))
            : true,
    },
    dragThumb: {
      pointer: async (env: E, axis: ScrollAxis, fraction: number) =>
        drag(env, axis, fraction, "mouse"),
      touch: async (env: E, axis: ScrollAxis, fraction: number) =>
        drag(env, axis, fraction, "touch"),
      none: { keyboard: "a fractional position has no key; `scroll` covers keyboard" },
      done: async (env: E, axis: ScrollAxis) => !(await isDragging(env, axis)),
    },
    pressTrack: {
      pointer: async (env: E, axis: ScrollAxis, side: "back" | "forward") => press(env, axis, side),
      // The keyboard twin: a page toward the press.
      keyboard: async (env: E, axis: ScrollAxis, side: "back" | "forward") =>
        scrollWithKeys(env, axis, side === "forward" ? "page-forward" : "page-back"),
      done: async () => true,
    },
    hover: {
      pointer: async (env: E) => env.part("root").hover(),
      none: { keyboard: "hover has no keyboard twin; focusViewport shows the scrollbars" },
      done: async () => true,
    },
    unhover: {
      // The pointer leaves for the page outside every layer.
      pointer: async (env: E) => env.pointerOutside(),
      none: { keyboard: "hover has no keyboard twin" },
      done: async () => true,
    },
  },
  states: { idle: {}, engaged: {}, lingering: {}, dragging: {} },
  events: {
    "POINTER.ENTER": { action: "hover", event: () => ({ pointerType: "mouse" }) },
    "POINTER.LEAVE": { action: "unhover", event: () => ({ pointerType: "mouse" }) },
    "SCROLLBAR.ENTER": { skip: "hover over a scrollbar part, covered by dragThumb" },
    "SCROLLBAR.LEAVE": { skip: "as SCROLLBAR.ENTER" },
    "FOCUS.IN": "focusViewport",
    "FOCUS.OUT": { skip: "tab out: the driver tests" },
    "VIEWPORT.FOCUS": { skip: "the same focus as FOCUS.IN (focusViewport)" },
    "VIEWPORT.BLUR": { skip: "the tab-stop latch: browser tests" },
    SCROLL: { skip: "a user scroll needs layout: browser tests drive `scroll`" },
    "DRAG.START": { skip: "thumb drags need layout: browser tests drive `dragThumb`" },
    "DRAG.END": { skip: "as DRAG.START" },
    "DRAG.CANCEL": { skip: "pointer-drag cancel paths: the unit tests" },
    METRICS: { skip: "measurement, driven by layout" },
  },
  traits: ["directional"],
  invariants: scrollAreaInvariants,
})
