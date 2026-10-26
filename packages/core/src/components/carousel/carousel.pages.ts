// Carousel pages (add-carousel design §1): slides grouped into pages a move at a time.

export interface CarouselLayout {
  readonly slides: number
  /** Slides visible at once (default 1). */
  readonly perPage?: number | undefined
  /** Slides a page advances: `"page"` (default) or a number. */
  readonly perMove?: "page" | number | undefined
}

const perPage = (l: CarouselLayout) => Math.max(1, Math.floor(l.perPage ?? 1))
const perMove = (l: CarouselLayout) =>
  l.perMove === undefined || l.perMove === "page" ? perPage(l) : Math.max(1, Math.floor(l.perMove))

/** How many pages; at least 1. */
export function pageCount(l: CarouselLayout): number {
  const n = Math.max(0, Math.floor(l.slides))
  const pp = perPage(l)
  if (n <= pp) return 1
  if (l.perMove === undefined || l.perMove === "page") return Math.ceil(n / pp)
  return Math.ceil((n - pp) / perMove(l)) + 1
}

/** The first slide of `page`. */
export function firstSlideOf(l: CarouselLayout, page: number): number {
  const n = Math.max(0, Math.floor(l.slides))
  return Math.max(0, Math.min(page * perMove(l), n - perPage(l)))
}

/** The page a slide belongs to (the first page that shows it). */
export function pageOfSlide(l: CarouselLayout, slide: number): number {
  const pages = pageCount(l)
  for (let p = 0; p < pages; p++) {
    const first = firstSlideOf(l, p)
    if (slide >= first && slide < first + perPage(l)) return p
  }
  return pages - 1
}

/** Whether a slide is on `page`. */
export function slideOnPage(l: CarouselLayout, slide: number, page: number): boolean {
  const first = firstSlideOf(l, page)
  return slide >= first && slide < first + perPage(l)
}

export const clampPage = (page: number, pages: number) =>
  Math.max(0, Math.min(Math.round(Number.isFinite(page) ? page : 0), pages - 1))
