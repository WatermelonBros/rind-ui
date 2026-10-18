// cell-drag: a press that drags across the cells of a grid (the range Calendar first). Mouse
// and pen drag from the press; a touch only once held `delay` without moving (before that it
// is a tap or a scroll: react-spectrum#5975), and then the page does not scroll. Moves report
// the cell under the pointer by key, only when the pointer really moved: a layout shift under a
// still pointer is not a drag (react-spectrum#4007). Tracking reuses pointer-drag's lifecycle.

import { isContextMenuClick } from "../a11y/keys"
import type { ModalityEnv, PlatformInfo, SchedulerEnv, TimerHandle } from "../env/capabilities"
import { trackPointer } from "./pointer-drag"

type DragPointer = "mouse" | "pen" | "touch"

/** What a cell drag reports: `end` carries the last cell moved onto (null: none). */
export type CellDragMessage<K> =
  | { readonly type: "start"; readonly key: K; readonly pointerType: DragPointer }
  | { readonly type: "move"; readonly key: K }
  | { readonly type: "end"; readonly key: K | null; readonly pointerType: DragPointer }
  | { readonly type: "cancel" }

export interface CellDragOptions<K> {
  readonly env: SchedulerEnv & ModalityEnv & PlatformInfo
  /** The draggable cell's key at an element, or null (the last cell is kept). */
  readonly keyAt: (el: Element | null) => K | null
  /** Read at press time: whether a press on this key starts a drag. */
  readonly canStart: (key: K) => boolean
  /** Touch: how long (ms) a touch is held still before it drags (read at press time). */
  readonly delay: () => number
  readonly send: (m: CellDragMessage<K>) => void
  /** Keys equal (default `===`). */
  readonly equal?: (a: K, b: K) => boolean
}

/** Touch movement (CSS px) before the delay that makes it a scroll or a tap, not a drag. */
const SLOP = 10

/** The pointer event a cell drag starts from (React synthetic events fit too). */
export interface CellDragPointerEvent {
  readonly pointerId: number
  readonly pointerType: string
  readonly button: number
  readonly clientX: number
  readonly clientY: number
  readonly target: EventTarget | null
  readonly ctrlKey: boolean
  readonly metaKey: boolean
  readonly shiftKey: boolean
  readonly altKey: boolean
}

export interface CellDrag {
  /** The surface's `pointerdown` (it contains every cell). */
  pointerDown(surface: Element, e: CellDragPointerEvent): void
  /** True for the activation of a press that dragged: the drag has already handled it. */
  consumes(press: { readonly pointerType: string }): boolean
  /** While dragging, a touch does not scroll the page: a non-passive `touchmove` on `surface`. */
  attach(surface: Element): () => void
  dispose(): void
}

export function createCellDrag<K>(o: CellDragOptions<K>): CellDrag {
  const equal = o.equal ?? ((a: K, b: K) => a === b)
  let stop: (() => void) | null = null
  let dragging = false
  /** The current gesture started a drag (its trailing PRESS is not a click). */
  let dragged = false
  const end = () => {
    stop?.()
    stop = null
    dragging = false
  }
  const at = (doc: Document, p: { clientX: number; clientY: number; target: EventTarget | null }) =>
    o.keyAt(
      // No layout (jsdom): the event's own target.
      doc.elementFromPoint?.(p.clientX, p.clientY) ?? (p.target as Element | null),
    )

  function begin(surface: Element, e: CellDragPointerEvent, key: K) {
    dragging = true
    dragged = true
    // Sound: pointerDown only begins for these three types.
    const pointerType = e.pointerType as DragPointer
    o.send({ type: "start", key, pointerType })
    const doc = surface.ownerDocument
    let x = e.clientX
    let y = e.clientY
    let current = key
    let last: K | null = null
    stop = trackPointer<{ readonly type: "move"; readonly key: K }>(
      surface,
      e.pointerId,
      (m) => {
        if (m.type === "move") {
          last = m.key
          o.send(m)
          return
        }
        stop = null
        dragging = false
        o.send(m.type === "up" ? { type: "end", key: last, pointerType } : m)
      },
      (p) => {
        // Zero-delta moves come when content moves under a still pointer.
        if (p.clientX === x && p.clientY === y) return null
        x = p.clientX
        y = p.clientY
        const k = at(doc, p)
        if (k === null || equal(k, current)) return null
        current = k
        return { type: "move", key: k }
      },
      false,
    )
  }

  return {
    pointerDown(surface, e) {
      // One gesture at a time: a second finger never restarts it.
      if (stop !== null) return
      dragged = false
      if (e.button !== 0) return
      if (e.pointerType !== "mouse" && e.pointerType !== "pen" && e.pointerType !== "touch") return
      // An assistive technology's pointer activates through its click; Control+click on macOS
      // asks for a context menu.
      if (o.env.modality.modality() === "virtual" || isContextMenuClick(e, o.env.platform)) return
      const key = o.keyAt(e.target as Element | null)
      if (key === null || !o.canStart(key)) return
      if (e.pointerType !== "touch") {
        begin(surface, e, key)
        return
      }
      // Touch: a drag only after the delay without movement; a scroll or a release first
      // leaves the gesture to the browser and the press (a tap).
      const doc = surface.ownerDocument
      let timer: TimerHandle | null = null
      const off = () => {
        if (timer !== null) o.env.scheduler.clearTimeout(timer)
        timer = null
        doc.removeEventListener("pointermove", onMove, true)
        doc.removeEventListener("pointerup", onEnd, true)
        doc.removeEventListener("pointercancel", onEnd, true)
        if (stop === off) stop = null
      }
      function onMove(ev: PointerEvent) {
        if (ev.pointerId !== e.pointerId) return
        if (Math.hypot(ev.clientX - e.clientX, ev.clientY - e.clientY) > SLOP) off()
      }
      function onEnd(ev: PointerEvent) {
        if (ev.pointerId === e.pointerId) off()
      }
      doc.addEventListener("pointermove", onMove, true)
      doc.addEventListener("pointerup", onEnd, true)
      doc.addEventListener("pointercancel", onEnd, true)
      stop = off
      timer = o.env.scheduler.setTimeout(() => {
        timer = null
        off()
        // The cell may have become unselectable meanwhile (a parent's change).
        if (o.canStart(key)) begin(surface, e, key)
      }, o.delay())
    },
    consumes: (press) =>
      dragged && press.pointerType !== "virtual" && press.pointerType !== "keyboard",
    attach(surface) {
      const onTouchMove = (ev: Event) => {
        if (dragging && ev.cancelable) ev.preventDefault()
      }
      surface.addEventListener("touchmove", onTouchMove, { passive: false })
      return () => surface.removeEventListener("touchmove", onTouchMove)
    },
    dispose: end,
  }
}
