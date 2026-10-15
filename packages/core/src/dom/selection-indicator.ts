// selection-indicator: the selected item's box relative to its container, for a sliding
// highlight (Tabs, Segmented Control). Layout offsets (offsetLeft/Top chains): immune to
// transforms on ancestors (a scaling dialog: base-ui#3425), corrected for the scroll of
// elements between the item and the container but not the container's own, independent
// of the viewport scroll (react-spectrum#9931); sizes never rounded up (base-ui#2235). The
// box reaches the element as state (INDICATOR.MEASURE), never as an imperative style.

export interface IndicatorBox {
  readonly left: number
  readonly right: number
  readonly top: number
  readonly bottom: number
  readonly width: number
  readonly height: number
}

/** Why the indicator moved: a selection change animates, a layout change does not. */
export type IndicatorCause = "selection" | "layout"

/** Two decimals, rounded down: never larger than the item. */
const down = (n: number) => Math.floor(n * 100) / 100

const absolute = (el: HTMLElement) => {
  let left = 0
  let top = 0
  for (let n: HTMLElement | null = el; n; n = n.offsetParent as HTMLElement | null) {
    left += n.offsetLeft
    top += n.offsetTop
  }
  return { left, top }
}

/** The border-box size, unscaled, from computed style (fractional, transform-immune). */
function size(el: HTMLElement) {
  const cs = el.ownerDocument.defaultView?.getComputedStyle(el)
  if (!cs) return { width: el.offsetWidth, height: el.offsetHeight }
  const n = (v: string) => Number.parseFloat(v) || 0
  const extra = (a: string, b: string, c: string, d: string) => n(a) + n(b) + n(c) + n(d)
  const width =
    cs.boxSizing === "border-box"
      ? n(cs.width)
      : n(cs.width) +
        extra(cs.paddingLeft, cs.paddingRight, cs.borderLeftWidth, cs.borderRightWidth)
  const height =
    cs.boxSizing === "border-box"
      ? n(cs.height)
      : n(cs.height) +
        extra(cs.paddingTop, cs.paddingBottom, cs.borderTopWidth, cs.borderBottomWidth)
  // `auto` (no layout, jsdom) reads as 0: fall back to the integer layout size.
  return {
    width: width || el.offsetWidth,
    height: height || el.offsetHeight,
  }
}

/** The item's box in the container's coordinates. */
export function measureIndicator(container: HTMLElement, item: HTMLElement): IndicatorBox {
  const a = absolute(item)
  const c = absolute(container)
  let left = a.left - c.left
  let top = a.top - c.top
  // Scrolled elements between the item and the container move it (not the container's own).
  for (let n = item.parentElement; n && n !== container; n = n.parentElement) {
    left -= n.scrollLeft
    top -= n.scrollTop
  }
  const { width, height } = size(item)
  return {
    left: down(left),
    top: down(top),
    width: down(width),
    height: down(height),
    right: down(container.scrollWidth - left - width),
    bottom: down(container.scrollHeight - top - height),
  }
}

export interface SelectionIndicatorOptions {
  readonly container: () => HTMLElement | null
  /** The selected item's element (null when nothing is selected). */
  readonly item: () => HTMLElement | null
  /** The items observed for size changes (a sibling's resize moves the selected one). */
  readonly items: () => readonly HTMLElement[]
  readonly onMeasure: (box: IndicatorBox | null, cause: IndicatorCause) => void
}

/**
 * Measures now (`measure`) and on every container, item or window resize (cause
 * "layout"); `dispose` stops observing. The first measurement is a layout one: it never
 * animates (base-ui#998).
 */
export function selectionIndicator(o: SelectionIndicatorOptions) {
  const measure = (cause: IndicatorCause) => {
    const container = o.container()
    const item = o.item()
    // No layout (display: none, or jsdom): no measurement, so the indicator stays hidden.
    const laidOut = item !== null && item.getClientRects().length > 0
    o.onMeasure(container && item && laidOut ? measureIndicator(container, item) : null, cause)
  }
  const container = o.container()
  const win = container?.ownerDocument.defaultView
  const ro =
    win && typeof win.ResizeObserver === "function"
      ? new win.ResizeObserver(() => measure("layout"))
      : null
  const observe = () => {
    ro?.disconnect()
    const c = o.container()
    if (c) ro?.observe(c)
    for (const el of o.items()) ro?.observe(el)
  }
  const onResize = () => measure("layout")
  observe()
  win?.addEventListener("resize", onResize)
  return {
    measure,
    /** Items registered or unregistered: observe the new set and re-measure. */
    refresh: () => {
      observe()
      measure("layout")
    },
    dispose: () => {
      ro?.disconnect()
      win?.removeEventListener("resize", onResize)
    },
  }
}

/** A measurement as a machine keeps it: the box and why it moved. */
export interface MeasuredIndicator {
  readonly box: IndicatorBox
  readonly cause: IndicatorCause
}

/**
 * The context value after an INDICATOR.MEASURE, or `undefined` when nothing changed (an
 * unchanged box: measuring after every commit must settle).
 */
export function nextIndicator(
  prev: MeasuredIndicator | null,
  box: IndicatorBox | null,
  cause: IndicatorCause,
): MeasuredIndicator | null | undefined {
  if (box === null) return prev === null ? undefined : null
  if (
    prev !== null &&
    prev.box.left === box.left &&
    prev.box.top === box.top &&
    prev.box.width === box.width &&
    prev.box.height === box.height &&
    prev.box.right === box.right &&
    prev.box.bottom === box.bottom
  ) {
    return undefined
  }
  return { box, cause }
}
