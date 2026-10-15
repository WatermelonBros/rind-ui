// autosize-textarea: a textarea that takes its content's height. Native `field-sizing:
// content` where supported (no measuring at all); otherwise a measured fallback that never
// touches the value, the selection, the undo stack or the events.

import type { PlatformInfo, SchedulerEnv } from "../env/capabilities"
import { quirkActive } from "./quirks"

export interface Autosize {
  /** Re-measures after a value commit (controlled, programmatic, reset). No-op natively. */
  measure(): void
  dispose(): void
}

/** Whether the browser sizes fields to their content itself. */
export const supportsFieldSizing = (win: Window & typeof globalThis = globalThis as never) =>
  typeof win.CSS?.supports === "function" && win.CSS.supports("field-sizing", "content")

export function autosize(
  textarea: HTMLTextAreaElement,
  env: SchedulerEnv & PlatformInfo,
): Autosize {
  const win = (textarea.ownerDocument.defaultView ?? globalThis) as Window & typeof globalThis
  const style = textarea.style
  style.resize = "none"
  // `rows` is the minimum: an empty textarea keeps it (never collapses to one line).
  const rows = textarea.rows || 2
  if (supportsFieldSizing(win)) {
    style.setProperty("field-sizing", "content")
    // `rows` lines of content plus the box's own padding and border when they are part of
    // its size (border-box): the empty textarea keeps the height `rows` gives it natively.
    const cs = win.getComputedStyle(textarea)
    const chrome =
      cs.boxSizing === "border-box"
        ? Number.parseFloat(cs.paddingTop) +
          Number.parseFloat(cs.paddingBottom) +
          Number.parseFloat(cs.borderTopWidth) +
          Number.parseFloat(cs.borderBottomWidth)
        : 0
    style.minBlockSize = `calc(${rows}lh + ${chrome}px)`
    return { measure: () => {}, dispose: () => {} }
  }
  let frame: ReturnType<SchedulerEnv["scheduler"]["requestAnimationFrame"]> | null = null
  let live = true
  const write = () => {
    frame = null
    if (!live || !textarea.isConnected) return
    const cs = win.getComputedStyle(textarea)
    // Fractional borders and padding (zag#2312): parseFloat, never parseInt.
    const borders = Number.parseFloat(cs.borderTopWidth) + Number.parseFloat(cs.borderBottomWidth)
    const padding = Number.parseFloat(cs.paddingTop) + Number.parseFloat(cs.paddingBottom)
    const line = Number.parseFloat(cs.lineHeight) || Number.parseFloat(cs.fontSize) * 1.2
    const min = rows * line + padding + borders
    const max = Number.parseFloat(cs.maxHeight) || Number.POSITIVE_INFINITY
    style.height = "auto"
    const content = textarea.scrollHeight + borders
    const height = Math.min(Math.max(content, min), max)
    style.height = `${height}px`
    // Firefox keeps its overflow (firefox-textarea-overflow); elsewhere scroll only past the maximum.
    if (!quirkActive("firefox-textarea-overflow", env)) {
      style.overflowY = content > max ? "auto" : "hidden"
    }
  }
  // Written in the next frame: a resize observation never causes another in the same frame
  // (zag#2281, "ResizeObserver loop").
  const schedule = () => {
    if (frame === null && live) frame = env.scheduler.requestAnimationFrame(write)
  }
  let width = textarea.clientWidth
  const ro =
    typeof win.ResizeObserver === "function"
      ? new win.ResizeObserver(() => {
          if (textarea.clientWidth === width) return
          width = textarea.clientWidth
          schedule()
        })
      : null
  ro?.observe(textarea)
  const fonts = textarea.ownerDocument.fonts
  fonts?.addEventListener?.("loadingdone", schedule)
  const onInput = () => schedule()
  textarea.addEventListener("input", onInput)
  schedule()
  return {
    measure: schedule,
    dispose() {
      live = false
      if (frame !== null) env.scheduler.cancelAnimationFrame(frame)
      frame = null
      ro?.disconnect()
      fonts?.removeEventListener?.("loadingdone", schedule)
      textarea.removeEventListener("input", onInput)
    },
  }
}
