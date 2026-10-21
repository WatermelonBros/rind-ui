// Long press, opted into per part: `createPress({ longPress: longPress({ … }) })` (500 ms
// through the scheduler, trailing PRESS and touch context menu suppressed). Kept out of
// press.ts so the many pressables that never long-press do not ship it. This module also adds
// what a long-pressable part renders: a localised hint, referenced by aria-describedby, so the
// gesture is discoverable to AT.

import type { Scheduler, TimerHandle } from "../env/capabilities"
import type { PressPointerEvent } from "./press"

/** Marks a part during a touch long press (the callout is suppressed meanwhile). */
const CALLOUT_ATTR = "data-rind-long-pressing"

export interface LongPressOptions {
  /** Hold time before LONG_PRESS (default 500 ms). */
  readonly threshold?: number
  /**
   * Moving farther than this (px) from the press's start cancels it (default: only leaving
   * the part does). A second pointer going down always cancels it (a pinch is not a long press).
   */
  readonly moveTolerance?: number
}

/** What `createPress` hands a long press when a primary pointer goes down. */
export interface LongPressStart {
  readonly target: Element
  readonly event: PressPointerEvent
  readonly pointerType: "mouse" | "pen" | "touch"
  readonly scheduler: Scheduler
  /** Adds a capture listener removed when the press ends. */
  readonly listen: <K extends keyof DocumentEventMap>(
    target: Document | Element,
    type: K,
    listener: (e: DocumentEventMap[K]) => void,
  ) => void
  /** Called when the threshold is reached; the press decides whether it still counts. */
  readonly fire: () => void
}

/** One press's long-press gesture. */
export interface LongPressGesture {
  /** Stops the timer (the pointer left, moved too far, or a second one went down). */
  cancel(): void
  /** The press ended: stops the timer and restores the touch callout. */
  end(): void
}

export interface LongPress {
  start(input: LongPressStart): LongPressGesture
}

/** Opts a pressable into long press. */
/* @__NO_SIDE_EFFECTS__ */
export function longPress(options: LongPressOptions = {}): LongPress {
  return {
    start({ target, event: e, pointerType, scheduler, listen, fire }) {
      let restoreCallout: (() => void) | null = null
      if (pointerType === "touch") {
        // A long press is the gesture: the platform's callout (iOS link preview, image menu)
        // must not answer it first.
        // Through the CSSOM (allowed by a strict style-src), restored when the press ends.
        const style = (target as HTMLElement).style
        const previous = style?.getPropertyValue("-webkit-touch-callout") ?? ""
        target.setAttribute(CALLOUT_ATTR, "")
        style?.setProperty("-webkit-touch-callout", "none")
        restoreCallout = () => {
          target.removeAttribute(CALLOUT_ATTR)
          if (previous) style?.setProperty("-webkit-touch-callout", previous)
          else style?.removeProperty("-webkit-touch-callout")
        }
      }
      let timer: TimerHandle | null = null
      const cancel = () => {
        if (timer !== null) scheduler.clearTimeout(timer)
        timer = null
      }
      const doc = target.ownerDocument
      const start = { x: e.clientX, y: e.clientY }
      const tolerance = options.moveTolerance
      if (tolerance !== undefined) {
        listen(doc, "pointermove", (pe) => {
          if (pe.pointerId !== e.pointerId || timer === null) return
          if (Math.hypot(pe.clientX - start.x, pe.clientY - start.y) > tolerance) cancel()
        })
      }
      listen(doc, "pointerdown", (pe) => {
        if (pe.pointerId !== e.pointerId) cancel()
      })
      timer = scheduler.setTimeout(() => {
        timer = null
        fire()
      }, options.threshold ?? 500)
      return {
        cancel,
        end() {
          cancel()
          restoreCallout?.()
          restoreCallout = null
        },
      }
    },
  }
}

/** English default; components expose it in their `messages`. */
export const longPressMessages = {
  longPressHint: "Long press for more options",
} as const

/** Adds the hint's id to the part's existing description ids. */
export function describedByHint(hintId: string, describedBy?: string): string {
  return describedBy ? `${describedBy} ${hintId}` : hintId
}
