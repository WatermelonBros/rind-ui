// Splitter parts (design §4): every aria-* and data-* attribute, the panels' flex styles
// (pure functions of the sizes, so server and client render the same strings, RRP#692) and
// the key mapping. Pixel constraints are resolved here, at the boundary: the machine only
// sees percentages.

import { focusAttrs } from "../../a11y/focus"
import type { KeyDescription } from "../../a11y/keys"
import { CRITICAL, dataFlag, type PartProps, scopeAttrs } from "../../connect/props"
import type { Modality } from "../../contract/env"
import type { DragAxis } from "../../dom/pointer-drag"
import { partId } from "../../ids"
import type { SplitterEvent } from "./splitter.machine"
import { formatSize, handleBounds, isCollapsed, type SplitterConstraints } from "./splitter.math"

// Replaced by bundlers; read only in development warnings.
declare const process: { env: { NODE_ENV?: string } }

export type SplitterPart = "root" | "panel" | "handle"
/** The panel axis: `horizontal` lays panels side by side, `vertical` stacks them. */
export type SplitterOrientation = "horizontal" | "vertical"

/** A size: a number is a percent of the panels' space; `"200px"` is pixels; `"20%"` percent. */
export type SplitterSize = number | `${number}px` | `${number}%`

/** One panel's constraints as the consumer declares them on the Root. */
export interface SplitterPanel {
  /** Smallest size (default 0). */
  readonly min?: SplitterSize | undefined
  /** Largest size (default 100 %). */
  readonly max?: SplitterSize | undefined
  /** Dragged or stepped below `min`, the panel collapses to `collapsedSize` (default false). */
  readonly collapsible?: boolean | undefined
  /** The size of the collapsed panel (default 0). */
  readonly collapsedSize?: SplitterSize | undefined
}

/** `size` as a percent of `space` px; pixels need a measured space (RRP#536: never ÷ 0). */
function toPercent(size: SplitterSize | undefined, space: number | null): number | undefined {
  if (size === undefined) return undefined
  if (typeof size === "number") return Number.isFinite(size) ? size : undefined
  const n = Number.parseFloat(size)
  if (!Number.isFinite(n)) return undefined
  if (size.endsWith("%")) return n
  return space !== null && space > 0 ? (n / space) * 100 : undefined
}

/** The constraints in percent of `space` (the panels' space in px, `null` before layout). */
export function resolveConstraints(
  panels: readonly SplitterPanel[],
  space: number | null,
): SplitterConstraints[] {
  return panels.map((p) => ({
    min: toPercent(p.min, space),
    max: toPercent(p.max, space),
    collapsible: p.collapsible === true ? true : undefined,
    collapsedSize: toPercent(p.collapsedSize, space),
  }))
}

export interface SplitterAxis {
  readonly orientation: SplitterOrientation
  readonly dir: "ltr" | "rtl"
}

/** The pointer-drag axis: the reading direction mirrors only a horizontal Splitter. */
export const splitterDragAxis = (a: SplitterAxis): DragAxis => ({
  axis: a.orientation,
  dir: a.orientation === "horizontal" ? a.dir : "ltr",
})

/**
 * The percent delta between two pointer-drag fractions. Vertical fractions grow upward, so a
 * downward move (which grows the top panel) is a negative fraction step. `scale`: the Root's
 * size over the panels' space (the handles take the rest).
 */
export const splitterDelta = (
  from: number,
  to: number,
  orientation: SplitterOrientation,
  scale: number,
) => (to - from) * 100 * scale * (orientation === "vertical" ? -1 : 1)

/**
 * A handle's machine event for a key, or `null` (not ours). Only the handle's own axis moves
 * it: ArrowRight / ArrowDown move the boundary right / down; in RTL the primary panel is on
 * the right, so ArrowLeft grows it. Escape is handled only while dragging.
 */
export function splitterKeyEvent(
  k: KeyDescription,
  handle: number,
  a: SplitterAxis & { readonly dragging: boolean },
): SplitterEvent | null {
  // Alt / Ctrl / Meta + arrow belong to the browser and OS (history Back, word moves).
  if (k.composing || k.alt || k.ctrl || k.meta) return null
  const forward = a.dir === "rtl" ? -1 : 1
  switch (k.key) {
    case "Escape":
      return a.dragging ? { type: "DRAG.CANCEL" } : null
    case "ArrowRight":
    case "ArrowLeft":
      if (a.orientation !== "horizontal") return null
      return {
        type: "STEP",
        handle,
        direction: (k.key === "ArrowRight" ? forward : -forward) as 1 | -1,
      }
    case "ArrowDown":
    case "ArrowUp":
      if (a.orientation !== "vertical") return null
      return { type: "STEP", handle, direction: k.key === "ArrowDown" ? 1 : -1 }
    case "Home":
      return { type: "TO_EDGE", handle, edge: "min" }
    case "End":
      return { type: "TO_EDGE", handle, edge: "max" }
    case "Enter":
      return k.repeat ? null : { type: "TOGGLE", handle }
    default:
      return null
  }
}

export interface SplitterConnectInput extends SplitterAxis {
  readonly instance: string
  readonly sizes: readonly number[]
  /** Resolved to percent. */
  readonly panels: readonly SplitterConstraints[]
  readonly disabled: boolean
  readonly handleDisabled: readonly boolean[]
  readonly focused: number | null
  readonly modality: Modality
  /** The dragged handle, while a drag is active. */
  readonly draggingHandle: number | null
}

export interface HandleOwn {
  /** The Handle's own `disabled` (known on the server before the Root hears of it). */
  readonly disabled?: boolean | undefined
}

/** The generated id of panel `index` (the handles' `aria-controls`). */
export const splitterPanelId = (instance: string, index: number) =>
  partId("splitter", instance, `panel-${index}`)

export function splitterConnect(input: SplitterConnectInput) {
  const { sizes, panels, orientation } = input
  const vertical = orientation === "vertical"
  const dragging = input.draggingHandle !== null
  const shared = {
    "data-orientation": orientation,
    "data-disabled": dataFlag(input.disabled),
    "data-dragging": dataFlag(dragging),
  }
  const part = (name: SplitterPart) => scopeAttrs("splitter", name, input.instance)
  const handleOff = (i: number, own: HandleOwn) =>
    input.disabled || input.handleDisabled[i] === true || own.disabled === true

  return {
    root: (): PartProps => ({
      ...part("root"),
      ...shared,
      dir: input.dir,
      style: {
        display: "flex",
        "flex-direction": vertical ? "column" : "row",
        ...(dragging ? { "user-select": "none", "-webkit-user-select": "none" } : {}),
      },
    }),
    panel: (index: number): PartProps => {
      const size = sizes[index] ?? 0
      const c = panels[index]
      return {
        ...part("panel"),
        ...shared,
        id: splitterPanelId(input.instance, index),
        "data-index": String(index),
        "data-size": formatSize(size),
        "data-state":
          c?.collapsible === true ? (isCollapsed(c, size) ? "collapsed" : "expanded") : undefined,
        style: {
          // Sizes as flex-grow on a zero basis: the handles never break the total.
          flex: `${formatSize(size)} 1 0px`,
          [vertical ? "min-height" : "min-width"]: "0",
        },
      }
    },
    handle: (index: number, own: HandleOwn = {}): PartProps => {
      const off = handleOff(index, own)
      const [lo, hi] = handleBounds(sizes, panels, index)
      return {
        ...part("handle"),
        ...shared,
        "data-index": String(index),
        "data-disabled": dataFlag(off),
        "data-dragging": dataFlag(input.draggingHandle === index),
        ...focusAttrs(input.focused === index, input.modality),
        role: "separator",
        tabindex: off ? undefined : 0,
        // The line between side-by-side panels is vertical.
        "aria-orientation": vertical ? "horizontal" : "vertical",
        "aria-valuenow": Math.round(sizes[index] ?? 0),
        "aria-valuemin": Math.round(lo),
        "aria-valuemax": Math.round(hi),
        "aria-controls": splitterPanelId(input.instance, index),
        "aria-disabled": off ? "true" : undefined,
        style: {
          flex: "0 0 auto",
          position: "relative",
          "touch-action": "none",
          "user-select": "none",
          "-webkit-user-select": "none",
        },
        [CRITICAL]: ["role", "aria-valuenow", "aria-orientation"],
      }
    },
  }
}

export type SplitterApi = ReturnType<typeof splitterConnect>

/** Development: a handle has no content, so it needs a name (spec "Handle Semantics"). */
export function warnUnnamedHandle(index: number, named: boolean): void {
  if (process.env.NODE_ENV === "production" || named) return
  console.warn(
    `[rind-ui] splitter: Handle ${index} has no name; give it aria-label or aria-labelledby (usually the name of the panel before it)`,
  )
}
