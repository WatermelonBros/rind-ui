// The region's stack (design §2): collapsed or expanded. Hover (mouse or pen) and focus in
// the region pause every toast and expand the stack; pointer focus pauses without expanding
// (a click inside does not pin it open); the hotkey expands. It collapses when none holds,
// never mid-swipe; with `expand` it stays expanded.

import type { Modality } from "../../contract/env"
import { setup, type } from "../../machine/setup"

export type ToasterEvent =
  | { readonly type: "HOVER.START"; readonly modality: Modality }
  | { readonly type: "HOVER.END"; readonly modality: Modality }
  | { readonly type: "FOCUS.ENTER"; readonly modality: Modality }
  | { readonly type: "FOCUS.LEAVE"; readonly modality: Modality }
  | { readonly type: "HOTKEY" }
  | { readonly type: "SWIPING"; readonly active: boolean }
  /** The `visible` prop changed (onProps). */
  | { readonly type: "VISIBLE.SYNC" }

export interface ToasterProps {
  /** Always expanded (the store's `expand` option). */
  readonly expand?: boolean | undefined
  /** The store's region-level reasons (`toaster.regionReason`). */
  readonly onReason?: ((reason: "hover" | "focus", on: boolean) => void) | undefined
  /**
   * The region is rendered (it has toasts). When it stops rendering, its hover and focus end:
   * it left under the pointer (no pointerleave) or with the focus (no blur), and a reason
   * left on would pause and expand every later toast (zag#3464).
   */
  readonly visible?: boolean | undefined
}

export interface ToasterContext {
  readonly hovered: boolean
  readonly focused: boolean
  /** Focus entered by keyboard or the hotkey (it expands; pointer focus does not). */
  readonly keyboardFocus: boolean
  readonly swiping: boolean
}

export const toasterMachine = /* @__PURE__ */ setup({
  types: type<{
    props: ToasterProps
    events: ToasterEvent
    env: Record<string, never>
    context: ToasterContext
  }>(),
  guards: {
    pinned: ({ props }) => props.expand === true,
    gone: ({ props }) => props.visible === false,
    /** Expands: a mouse or pen hover (never touch), keyboard focus, the hotkey. */
    expands: ({ event }) =>
      event.type === "HOTKEY" ||
      (event.type === "HOVER.START" && event.modality !== "touch") ||
      (event.type === "FOCUS.ENTER" && event.modality !== "pointer" && event.modality !== "touch"),
    /** Nothing holds it open once this event applies. */
    released: ({ context, event }) => {
      const hovered = event.type === "HOVER.END" ? false : context.hovered
      const focused = event.type === "FOCUS.LEAVE" ? false : context.focused
      const swiping = event.type === "SWIPING" ? event.active : context.swiping
      return !hovered && !(focused && context.keyboardFocus) && !swiping
    },
  },
  actions: {
    hover: ({ event, props, set }) => {
      if (event.type !== "HOVER.START" || event.modality === "touch") return
      set("hovered", true)
      props.onReason?.("hover", true)
    },
    unhover: ({ context, props, set }) => {
      if (!context.hovered) return
      set("hovered", false)
      props.onReason?.("hover", false)
    },
    focus: ({ event, props, set }) => {
      set("focused", true)
      set(
        "keyboardFocus",
        event.type === "HOTKEY" ||
          (event.type === "FOCUS.ENTER" &&
            event.modality !== "pointer" &&
            event.modality !== "touch"),
      )
      props.onReason?.("focus", true)
    },
    blur: ({ props, set }) => {
      set("focused", false)
      set("keyboardFocus", false)
      props.onReason?.("focus", false)
    },
    setSwiping: ({ event, set }) => {
      if (event.type === "SWIPING") set("swiping", event.active)
    },
    /** Hover, focus and swipe all end with the region. */
    release: ({ context, props, set }) => {
      if (context.hovered) props.onReason?.("hover", false)
      if (context.focused) props.onReason?.("focus", false)
      set("hovered", false)
      set("focused", false)
      set("keyboardFocus", false)
      set("swiping", false)
    },
  },
}).machine({
  id: "toaster",
  initial: "collapsed",
  context: () => ({ hovered: false, focused: false, keyboardFocus: false, swiping: false }),
  onProps: { visible: "VISIBLE.SYNC" },
  on: {
    "HOVER.START": { actions: ["hover"] },
    "FOCUS.ENTER": { actions: ["focus"] },
  },
  states: {
    collapsed: {
      on: {
        "HOVER.START": [
          { guard: "expands", target: "expanded", actions: ["hover"] },
          { actions: ["hover"] },
        ],
        "FOCUS.ENTER": [
          { guard: "expands", target: "expanded", actions: ["focus"] },
          { actions: ["focus"] },
        ],
        HOTKEY: { target: "expanded", actions: ["focus"] },
        "VISIBLE.SYNC": { guard: "gone", actions: ["release"] },
        "HOVER.END": { actions: ["unhover"] },
        "FOCUS.LEAVE": { actions: ["blur"] },
        SWIPING: { actions: ["setSwiping"] },
      },
    },
    expanded: {
      on: {
        HOTKEY: { actions: ["focus"] },
        "VISIBLE.SYNC": { guard: "gone", target: "collapsed", actions: ["release"] },
        "HOVER.END": [
          { guard: { or: ["pinned", { not: "released" }] }, actions: ["unhover"] },
          { target: "collapsed", actions: ["unhover"] },
        ],
        "FOCUS.LEAVE": [
          { guard: { or: ["pinned", { not: "released" }] }, actions: ["blur"] },
          { target: "collapsed", actions: ["blur"] },
        ],
        SWIPING: [
          { guard: { or: ["pinned", { not: "released" }] }, actions: ["setSwiping"] },
          { target: "collapsed", actions: ["setSwiping"] },
        ],
      },
    },
  },
})

export type ToasterMachine = typeof toasterMachine
