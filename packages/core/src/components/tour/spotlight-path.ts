// Tour spotlight geometry (design §4): pure, so every geometry rule is a node test. The
// backdrop is one `clip-path: path(evenodd, …)`: the viewport rectangle plus one rounded
// rectangle per cutout. Overlapping cutouts are merged first — under the even-odd rule two
// overlapping holes would cancel and re-dim their intersection (a card placed over its target).

export interface Rect {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
}

export interface Size {
  readonly width: number
  readonly height: number
}

export interface Cutout extends Rect {
  readonly radius: number
}

export interface CutoutOptions {
  /** The target's viewport rectangle (absent for a centred step: no cutout). */
  readonly target?: Rect | undefined
  /** The card's viewport rectangle, cut out too when `content` is set. */
  readonly content?: Rect | undefined
  readonly viewport: Size
  readonly padding: { readonly x: number; readonly y: number }
  readonly radius: number
  /** The card's own cutout, or `false` for none (the default). */
  readonly contentCutout?: { readonly padding: number; readonly radius: number } | false
}

const round = (n: number) => Math.round(n * 100) / 100

/** Padded, clamped to the viewport, radius clamped; `null` when nothing is left. */
function cutout(r: Rect, px: number, py: number, radius: number, viewport: Size): Cutout | null {
  const x0 = Math.max(0, r.x - px)
  const y0 = Math.max(0, r.y - py)
  const x1 = Math.min(viewport.width, r.x + r.width + px)
  const y1 = Math.min(viewport.height, r.y + r.height + py)
  const width = x1 - x0
  const height = y1 - y0
  if (!(width > 0 && height > 0)) return null
  return { x: x0, y: y0, width, height, radius: clampRadius(radius, width, height) }
}

const clampRadius = (radius: number, width: number, height: number) =>
  Math.max(0, Math.min(radius, width / 2, height / 2))

const intersects = (a: Rect, b: Rect) =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height

/** Replaces every group of intersecting cutouts by their bounding rectangle. */
function merge(cutouts: readonly Cutout[]): Cutout[] {
  const out = [...cutouts]
  for (let changed = true; changed; ) {
    changed = false
    for (let i = 0; i < out.length && !changed; i++) {
      for (let j = i + 1; j < out.length && !changed; j++) {
        const a = out[i] as Cutout
        const b = out[j] as Cutout
        if (!intersects(a, b)) continue
        const x = Math.min(a.x, b.x)
        const y = Math.min(a.y, b.y)
        const width = Math.max(a.x + a.width, b.x + b.width) - x
        const height = Math.max(a.y + a.height, b.y + b.height) - y
        const radius = clampRadius(Math.max(a.radius, b.radius), width, height)
        out.splice(j, 1)
        out.splice(i, 1, { x, y, width, height, radius })
        changed = true
      }
    }
  }
  return out
}

/** The cutouts of one step: the padded target, optionally the padded card, merged. */
export function cutoutsFor(o: CutoutOptions): Cutout[] {
  const list: Cutout[] = []
  if (o.target) {
    const c = cutout(o.target, o.padding.x, o.padding.y, o.radius, o.viewport)
    if (c) list.push(c)
    // The card is cut out only next to a target (a centred step dims everything).
    if (o.content && o.contentCutout) {
      const p = o.contentCutout.padding
      const cc = cutout(o.content, p, p, o.contentCutout.radius, o.viewport)
      if (cc) list.push(cc)
    }
  }
  return merge(list)
}

function roundedRect({ x, y, width: w, height: h, radius: r }: Cutout): string {
  const n = round
  if (r === 0) return `M${n(x)} ${n(y)}H${n(x + w)}V${n(y + h)}H${n(x)}Z`
  return [
    `M${n(x + r)} ${n(y)}`,
    `H${n(x + w - r)}`,
    `A${n(r)} ${n(r)} 0 0 1 ${n(x + w)} ${n(y + r)}`,
    `V${n(y + h - r)}`,
    `A${n(r)} ${n(r)} 0 0 1 ${n(x + w - r)} ${n(y + h)}`,
    `H${n(x + r)}`,
    `A${n(r)} ${n(r)} 0 0 1 ${n(x)} ${n(y + h - r)}`,
    `V${n(y + r)}`,
    `A${n(r)} ${n(r)} 0 0 1 ${n(x + r)} ${n(y)}`,
    "Z",
  ].join("")
}

/** The even-odd path: the viewport, then one subpath per cutout. */
export function spotlightPath(viewport: Size, cutouts: readonly Cutout[]): string {
  const w = round(viewport.width)
  const h = round(viewport.height)
  return [`M0 0H${w}V${h}H0Z`, ...cutouts.map(roundedRect)].join("")
}
