// Scroll Area parts (design §3, spec "Scroll Area Data Attributes"). Visibility is computed
// here from the activity state and the measured facts, never stored. Geometry (thumb size and
// offset, overflow distances, corner size) is written by `core/dom/scroll-metrics.ts`, so no
// part re-renders per scroll frame and the server render carries none of it.

import { focusAttrs } from "../../a11y/focus"
import { dataFlag, type PartProps, scopeAttrs } from "../../connect/props"
import type { Modality } from "../../contract/env"
import { scrollAreaIds } from "../../dom/scroll-metrics"
import {
  type ScrollAreaContext,
  type ScrollAreaEvent,
  type ScrollAreaType,
  type ScrollAxis,
  scrollAreaTabStopRule,
} from "./scroll-area.machine"

declare const process: { env: { NODE_ENV?: string } }

export type ScrollAreaState = "idle" | "engaged" | "lingering" | "dragging"
export type ScrollAreaPart = "root" | "viewport" | "content" | "scrollbar" | "thumb" | "corner"

export interface ScrollAreaConnectInput {
  readonly instance: string
  readonly state: ScrollAreaState
  readonly context: ScrollAreaContext
  readonly type: ScrollAreaType
  /** The live modality while the Viewport has focus (for `data-focus-visible`). */
  readonly modality: Modality
}

type Send = (e: ScrollAreaEvent) => void
const axisOf = (orientation: "vertical" | "horizontal"): ScrollAxis =>
  orientation === "horizontal" ? "x" : "y"

/** Is the scrollbar of `axis` visible (spec "Visibility Types")? */
export function scrollbarVisible(s: ScrollAreaConnectInput, axis: ScrollAxis): boolean {
  const c = s.context
  if (s.type === "always") return true
  if (!c.measured || !c.overflow[axis]) return false
  if (s.type === "auto") return true
  if (s.type === "hover") return s.state !== "idle"
  return (
    s.state === "lingering" ||
    s.state === "dragging" ||
    c.scrolling !== null ||
    c.onScrollbar !== null
  )
}

const pointerKind = (t: string) =>
  (t === "mouse" || t === "pen" ? t : "touch") as "mouse" | "pen" | "touch"

export function scrollAreaConnect(s: ScrollAreaConnectInput) {
  const { instance, context: c } = s
  const ids = scrollAreaIds(instance)
  const overflowAttrs = {
    "data-overflow-x": dataFlag(c.measured && c.overflow.x),
    "data-overflow-y": dataFlag(c.measured && c.overflow.y),
  }
  const edgeAttrs = {
    ...overflowAttrs,
    "data-overflow-x-start": dataFlag(c.measured && c.edges.xStart),
    "data-overflow-x-end": dataFlag(c.measured && c.edges.xEnd),
    "data-overflow-y-start": dataFlag(c.measured && c.edges.yStart),
    "data-overflow-y-end": dataFlag(c.measured && c.edges.yEnd),
  }
  const dragging = (axis: ScrollAxis) => dataFlag(s.state === "dragging" && c.dragAxis === axis)
  return {
    root: (send: Send): PartProps => ({
      ...scopeAttrs("scroll-area", "root", instance),
      id: ids.root,
      style: { position: "relative" },
      "data-hovering": dataFlag(c.hovered),
      "data-scrolling": dataFlag(c.scrolling !== null),
      ...edgeAttrs,
      onPointerEnter: (e: { pointerType: string }) =>
        send({ type: "POINTER.ENTER", pointerType: pointerKind(e.pointerType) }),
      onPointerLeave: (e: { pointerType: string }) =>
        send({ type: "POINTER.LEAVE", pointerType: pointerKind(e.pointerType) }),
      onFocusIn: () => send({ type: "FOCUS.IN" }),
      onFocusOut: (e: { currentTarget: Node | null; relatedTarget: EventTarget | null }) => {
        const to = e.relatedTarget as Node | null
        if (!to || !e.currentTarget?.contains(to)) send({ type: "FOCUS.OUT" })
      },
    }),
    viewport: (send: Send, named: boolean): PartProps => ({
      ...scopeAttrs("scroll-area", "viewport", instance),
      id: ids.viewport,
      role: named ? "region" : undefined,
      tabindex: c.tabStop ? 0 : undefined,
      // What the tab-stop rule says, whatever tabindex a wrapper set (the contract's invariant).
      "data-tab-stop": dataFlag(scrollAreaTabStopRule(c)),
      ...edgeAttrs,
      ...focusAttrs(c.viewportFocused, s.modality),
      onFocus: (e: { target: EventTarget | null; currentTarget: EventTarget | null }) => {
        if (e.target === e.currentTarget) send({ type: "VIEWPORT.FOCUS" })
      },
      onBlur: (e: { target: EventTarget | null; currentTarget: EventTarget | null }) => {
        if (e.target === e.currentTarget) send({ type: "VIEWPORT.BLUR" })
      },
    }),
    content: (): PartProps => ({
      ...scopeAttrs("scroll-area", "content", instance),
      id: ids.content,
      ...overflowAttrs,
    }),
    scrollbar: (send: Send, orientation: "vertical" | "horizontal"): PartProps => {
      const axis = axisOf(orientation)
      const vertical = axis === "y"
      return {
        ...scopeAttrs("scroll-area", "scrollbar", instance),
        id: ids.scrollbar(axis),
        "aria-hidden": "true",
        "data-orientation": orientation,
        "data-state": scrollbarVisible(s, axis) ? "visible" : "hidden",
        "data-scrolling": dataFlag(c.scrolling === axis || c.scrolling === "both"),
        "data-dragging": dragging(axis),
        "data-hovering": dataFlag(c.onScrollbar === axis),
        // Logical insets: the vertical bar at the inline end, the horizontal one at the
        // bottom, both stopping short of the Corner.
        style: vertical
          ? {
              position: "absolute",
              top: "0",
              "inset-inline-end": "0",
              bottom: "var(--rind-scroll-area-corner-height, 0px)",
              "user-select": "none",
              "-webkit-user-select": "none",
            }
          : {
              position: "absolute",
              bottom: "0",
              "inset-inline-start": "0",
              "inset-inline-end": "var(--rind-scroll-area-corner-width, 0px)",
              "user-select": "none",
              "-webkit-user-select": "none",
            },
        // As a native scrollbar: pressing it never moves focus.
        onMouseDown: (e: { preventDefault(): void }) => e.preventDefault(),
        onPointerEnter: (e: { pointerType: string }) => {
          if (e.pointerType !== "touch") send({ type: "SCROLLBAR.ENTER", axis })
        },
        onPointerLeave: (e: { pointerType: string }) => {
          if (e.pointerType !== "touch") send({ type: "SCROLLBAR.LEAVE", axis })
        },
      }
    },
    thumb: (orientation: "vertical" | "horizontal"): PartProps => {
      const axis = axisOf(orientation)
      return {
        ...scopeAttrs("scroll-area", "thumb", instance),
        id: ids.thumb(axis),
        "aria-hidden": "true",
        "data-orientation": orientation,
        "data-dragging": dragging(axis),
        // Not painted before the first measure (mui/base-ui#4103); the drag owns touches.
        style: {
          "touch-action": "none",
          ...(c.measured ? {} : { visibility: "hidden" }),
        },
        onMouseDown: (e: { preventDefault(): void }) => e.preventDefault(),
      }
    },
    corner: (): PartProps => ({
      ...scopeAttrs("scroll-area", "corner", instance),
      id: ids.corner,
      "aria-hidden": "true",
      "data-state": scrollbarVisible(s, "x") && scrollbarVisible(s, "y") ? "visible" : "hidden",
      style: {
        position: "absolute",
        bottom: "0",
        "inset-inline-end": "0",
        width: "var(--rind-scroll-area-corner-width, 0px)",
        height: "var(--rind-scroll-area-corner-height, 0px)",
      },
    }),
  }
}

/** Development: a Viewport in the Tab order without a name (spec "Viewport Name And Role"). */
export function warnUnnamedTabStop(tabStop: boolean, named: boolean): void {
  if (process.env.NODE_ENV === "production" || !tabStop || named) return
  console.warn(
    "[rind-ui] scroll-area: the Viewport is a tab stop (its content has nothing focusable) but has no name; give it aria-label or aria-labelledby so screen-reader users know what they scroll",
  )
}
