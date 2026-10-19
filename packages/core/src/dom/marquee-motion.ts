// marquee-motion (add-marquee design §4): what CSS cannot do for a Marquee. It measures, keeps
// the animation's progress when its timing changes, and seeks so a focused element is in view.
// It works on whatever animations the copies run (`getAnimations()`), the theme's or the
// consumer's own keyframes alike. `scrollLeft` / `scrollTop` are never written.

import type { Scheduler } from "../env/capabilities"
import { TABBABLE } from "./tabbable-content"

export type MarqueeAxis = "x" | "y"

const sizeOn = (r: DOMRect, axis: MarqueeAxis) => (axis === "x" ? r.width : r.height)

/**
 * Reports the sizes at once, then on change through one ResizeObserver on the viewport and the
 * first copy, coalesced to one report per frame. `content` is one copy with its trailing gap (its padding).
 */
export function observeMarquee(
  viewport: HTMLElement,
  firstCopy: HTMLElement,
  axis: MarqueeAxis,
  scheduler: Scheduler,
  onSize: (size: { viewport: number; content: number }) => void,
): () => void {
  let last = ""
  let frame: ReturnType<Scheduler["requestAnimationFrame"]> | null = null
  const report = () => {
    frame = null
    const size = {
      viewport: sizeOn(viewport.getBoundingClientRect(), axis),
      content: sizeOn(firstCopy.getBoundingClientRect(), axis),
    }
    const key = `${size.viewport}:${size.content}`
    if (key === last) return
    last = key
    onSize(size)
  }
  const schedule = () => {
    if (frame === null) frame = scheduler.requestAnimationFrame(report)
  }
  // The first report at once (the effect runs after layout); later ones once per frame.
  report()
  const win = viewport.ownerDocument.defaultView
  const ro = typeof win?.ResizeObserver === "function" ? new win.ResizeObserver(schedule) : null
  ro?.observe(viewport)
  ro?.observe(firstCopy)
  return () => {
    ro?.disconnect()
    if (frame !== null) scheduler.cancelAnimationFrame(frame)
  }
}

const running = (copies: readonly Element[]) =>
  copies.flatMap((c) => (typeof c.getAnimations === "function" ? c.getAnimations() : []))

const timeOf = (a: Animation) => (typeof a.currentTime === "number" ? a.currentTime : null)

/** A duration change keeps the progress, not the elapsed time (`from`, `to`: any same unit). */
export function retime(copies: readonly Element[], from: number, to: number): void {
  if (!(from > 0) || !(to > 0) || from === to) return
  for (const a of running(copies)) {
    const t = timeOf(a)
    if (t !== null) a.currentTime = (t * to) / from
  }
}

/** A `reverse` change keeps the position: time `t` becomes `d − (t mod d)` (`d` in ms). */
export function mirror(copies: readonly Element[], durationMs: number): void {
  if (!(durationMs > 0)) return
  for (const a of running(copies)) {
    const t = timeOf(a)
    if (t !== null) a.currentTime = durationMs - (t % durationMs)
  }
}

/**
 * Seeks so `target`'s logical start sits at the viewport's start, when its box is not inside
 * the viewport's (WCAG 2.4.11). The time is the target's offset in its copy over the copy's
 * size, mirrored when reversed.
 */
export function reveal(
  target: Element,
  viewport: Element,
  copies: readonly Element[],
  options: {
    readonly axis: MarqueeAxis
    readonly dir: "ltr" | "rtl"
    readonly reversed: boolean
    readonly durationMs: number
  },
): void {
  const box = target.getBoundingClientRect()
  const view = viewport.getBoundingClientRect()
  const inside =
    options.axis === "x"
      ? box.left >= view.left && box.right <= view.right
      : box.top >= view.top && box.bottom <= view.bottom
  if (inside || !(options.durationMs > 0)) return
  const copy = copies.find((c) => c.contains(target))
  if (!copy) return
  const c = copy.getBoundingClientRect()
  // Positions follow the copy (it moves with the animation), so the offset is stable.
  const offset =
    options.axis === "y"
      ? box.top - c.top
      : options.dir === "rtl"
        ? c.right - box.right
        : box.left - c.left
  const size = sizeOn(c, options.axis)
  if (!(size > 0)) return
  const f = Math.min(Math.max(offset / size, 0), 1)
  const t = (options.reversed ? 1 - f : f) * options.durationMs
  for (const a of running(copies)) a.currentTime = t
}

const makeUntabbable = (copy: Element) => {
  for (const el of Array.from(copy.querySelectorAll<HTMLElement>(TABBABLE))) {
    const t = el.getAttribute("tabindex")
    if (t === null || Number(t) >= 0) el.setAttribute("tabindex", "-1")
  }
}

/**
 * No element inside a hidden copy is tabbable, including ones rendered later. The copy is not
 * made `inert`, so a pointer can still activate a link in it.
 */
export function untabbable(copy: Element): () => void {
  makeUntabbable(copy)
  const win = copy.ownerDocument.defaultView
  if (!win || typeof win.MutationObserver !== "function") return () => {}
  const mo = new win.MutationObserver(() => makeUntabbable(copy))
  mo.observe(copy, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ["tabindex", "href", "contenteditable"],
  })
  return () => mo.disconnect()
}
