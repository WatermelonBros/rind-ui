// Whether a scroll container's content overflows it (code-block "Scrollable Content"): only then
// is it a tab stop. Re-measured when the container or its content resizes, and on `remeasure()`
// (wrap and expand change the content's layout without always resizing the container).

/** Overflow on an axis the user can scroll (a clipped axis, `overflow: hidden`, does not count). */
export function overflows(el: HTMLElement): boolean {
  const style = el.ownerDocument.defaultView?.getComputedStyle(el)
  const scrolls = (v: string | undefined) => v !== "hidden" && v !== "clip" && v !== "visible"
  const x = el.scrollWidth > el.clientWidth && scrolls(style?.overflowX)
  const y = el.scrollHeight > el.clientHeight && scrolls(style?.overflowY)
  return x || y
}

export interface OverflowWatch {
  remeasure(): void
  stop(): void
}

/** Calls `onChange` with the first measurement and on every change after it. */
export function watchOverflow(
  el: HTMLElement,
  onChange: (overflow: boolean) => void,
): OverflowWatch {
  let last: boolean | undefined
  const measure = () => {
    const now = overflows(el)
    if (now === last) return
    last = now
    onChange(now)
  }
  const view = el.ownerDocument.defaultView
  const observer = view?.ResizeObserver ? new view.ResizeObserver(measure) : null
  observer?.observe(el)
  for (const child of Array.from(el.children)) observer?.observe(child)
  measure()
  return { remeasure: measure, stop: () => observer?.disconnect() }
}
