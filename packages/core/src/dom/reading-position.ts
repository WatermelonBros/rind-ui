// Reading position (add-table-of-contents design §1): which section is being read, by a
// reading line, and which sections are in view. One listener per scroll root, one
// measurement per frame, headings measured by their boxes (linear: no section walking,
// Starlight #3940). Headings that are missing or not rendered are skipped (Fumadocs #3429).

/** A section of the document: its heading's id, text and depth (0 for the shallowest). */
export interface TocHeading {
  readonly id: string
  readonly label: string
  readonly depth: number
}

export interface ReadingPosition {
  /** The section being read, or null when no heading is rendered. */
  readonly current: string | null
  /** Every section intersecting the scroll root, in document order. */
  readonly visible: readonly string[]
}

export interface ReadingOptions {
  /** The scrolling element (default: the window). */
  readonly scrollRoot?: HTMLElement | null | undefined
  /** Pixels hidden at the top of the root (a sticky header), default 0. */
  readonly offset?: number | undefined
  /** Where the reading line sits, as a fraction of the root below the offset (default 1/3). */
  readonly ratio?: number | undefined
}

const level = (el: Element) => {
  const tag = /^h([1-6])$/i.exec(el.tagName)?.[1]
  return Number(tag ?? el.getAttribute("aria-level") ?? 2)
}

/** The headings with an id inside `root`, in document order. */
export function collectHeadings(root: ParentNode, selector = "h2, h3"): TocHeading[] {
  const els = [...root.querySelectorAll<HTMLElement>(selector)].filter((el) => el.id !== "")
  const min = Math.min(...els.map(level))
  return els.map((el) => ({
    id: el.id,
    label: (el.textContent ?? "").replace(/\s+/g, " ").trim(),
    depth: level(el) - min,
  }))
}

/** Within 2 px of the end of a scroll range that exists: a tolerance (zoom rounds). */
function atEnd(doc: Document, root: HTMLElement | null): boolean {
  const el = root ?? doc.scrollingElement ?? doc.documentElement
  const range = el.scrollHeight - el.clientHeight
  return range > 0 && range - el.scrollTop <= 2
}

/** Measures the reading position now. */
export function measureReading(
  doc: Document,
  ids: readonly string[],
  options: ReadingOptions = {},
): ReadingPosition {
  const root = options.scrollRoot ?? null
  const win = doc.defaultView
  const box = root
    ? root.getBoundingClientRect()
    : { top: 0, bottom: win?.innerHeight ?? doc.documentElement.clientHeight }
  const offset = options.offset ?? 0
  const top = box.top + offset
  const line = top + (options.ratio ?? 1 / 3) * (box.bottom - top)
  const tops: { readonly id: string; readonly top: number }[] = []
  for (const id of ids) {
    const el = doc.getElementById(id)
    // Not rendered (display: none, a closed panel): it cannot be read.
    if (el && el.getClientRects().length > 0) {
      tops.push({ id, top: el.getBoundingClientRect().top })
    }
  }
  let current = tops[0]?.id ?? null
  for (const h of tops) if (h.top <= line) current = h.id
  // At the end the line can never reach the last short sections (Starlight #1954): the last
  // heading in view is the one being read.
  if (atEnd(doc, root)) {
    for (const h of tops) if (h.top >= top - 1 && h.top < box.bottom) current = h.id
  }
  const visible = tops
    .filter((h, i) => h.top < box.bottom && (tops[i + 1]?.top ?? Number.POSITIVE_INFINITY) > top)
    .map((h) => h.id)
  return { current, visible }
}

export interface ReadingWatch extends ReadingOptions {
  /** The section ids, read on every measurement (the list can change). */
  readonly ids: () => readonly string[]
  /** Every frame that scrolled or resized, and once at start. */
  readonly onPosition: (position: ReadingPosition) => void
  /** A scroll the user started (wheel, touch, a scrolling key): a click's scroll is over. */
  readonly onUserScroll?: (() => void) | undefined
}

const SCROLL_KEYS = new Set(["ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End", " "])

/** Follows the reading position; returns the cleanup. */
export function readingPosition(doc: Document, watch: ReadingWatch): () => void {
  const win = doc.defaultView
  if (!win) return () => {}
  const target: EventTarget = watch.scrollRoot ?? win
  let frame = 0
  const measure = () => {
    frame = 0
    watch.onPosition(measureReading(doc, watch.ids(), watch))
  }
  const schedule = () => {
    if (!frame) frame = win.requestAnimationFrame(measure)
  }
  const user = () => watch.onUserScroll?.()
  const key = (e: Event) => {
    if (SCROLL_KEYS.has((e as KeyboardEvent).key)) user()
  }
  measure()
  target.addEventListener("scroll", schedule, { passive: true })
  win.addEventListener("resize", schedule)
  target.addEventListener("wheel", user, { passive: true })
  target.addEventListener("touchstart", user, { passive: true })
  doc.addEventListener("keydown", key)
  return () => {
    if (frame) win.cancelAnimationFrame(frame)
    target.removeEventListener("scroll", schedule)
    win.removeEventListener("resize", schedule)
    target.removeEventListener("wheel", user)
    target.removeEventListener("touchstart", user)
    doc.removeEventListener("keydown", key)
  }
}
