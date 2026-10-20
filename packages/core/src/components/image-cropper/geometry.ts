// Image Cropper geometry (add-image-cropper design §1), pure. The crop is a rectangle in
// viewport pixels; the image is placed by one affine transform (fit, zoom, flip, rotation,
// pan offset). The same matrix drives the preview (CSS) and the export (canvas), and its
// inverse maps the crop back to natural pixels. Coverage is exact for any angle: every crop
// corner must map inside the image, which is a set of linear constraints on the offset (or
// on the crop's translation), solved as a convex polygon (Zag clamps a bounding box instead,
// which leaves empty corners under free rotation).

export interface Point {
  readonly x: number
  readonly y: number
}
export interface Size {
  readonly width: number
  readonly height: number
}
export interface Rect extends Point, Size {}
export interface Flip {
  readonly horizontal: boolean
  readonly vertical: boolean
}

/** x' = a·x + c·y + e, y' = b·x + d·y + f (the canvas / CSS `matrix()` order). */
export interface Matrix {
  readonly a: number
  readonly b: number
  readonly c: number
  readonly d: number
  readonly e: number
  readonly f: number
}

export interface CropPlacement {
  readonly natural: Size
  readonly viewport: Size
  readonly zoom: number
  /** Degrees, any angle. */
  readonly rotation: number
  readonly flip: Flip
  /** Pan of the image centre from the viewport centre, viewport px. */
  readonly offset: Point
}

const EPS = 0.5

/** The natural image fitted inside the viewport at zoom 1 (its "contain" scale). */
export function fitScale(natural: Size, viewport: Size): number {
  if (natural.width <= 0 || natural.height <= 0) return 1
  return Math.min(viewport.width / natural.width, viewport.height / natural.height)
}

/** The image box: the fitted image at zoom 1, centred in the viewport (the preview's layout box). */
export function imageBox(natural: Size, viewport: Size): Rect {
  const s = fitScale(natural, viewport)
  const width = natural.width * s
  const height = natural.height * s
  return { x: (viewport.width - width) / 2, y: (viewport.height - height) / 2, width, height }
}

/** Natural → viewport. */
export function imageMatrix(p: CropPlacement): Matrix {
  const k = fitScale(p.natural, p.viewport) * p.zoom
  const fx = p.flip.horizontal ? -1 : 1
  const fy = p.flip.vertical ? -1 : 1
  const t = (p.rotation * Math.PI) / 180
  const cos = Math.cos(t)
  const sin = Math.sin(t)
  const a = k * fx * cos
  const b = k * fx * sin
  const c = -k * fy * sin
  const d = k * fy * cos
  const cx = p.viewport.width / 2 + p.offset.x
  const cy = p.viewport.height / 2 + p.offset.y
  const hw = p.natural.width / 2
  const hh = p.natural.height / 2
  return { a, b, c, d, e: cx - a * hw - c * hh, f: cy - b * hw - d * hh }
}

/**
 * The preview's CSS transform for an image laid out at `imageBox` with
 * `transform-origin: center` (the same matrix, expressed on the box).
 */
export function imageTransformCss(p: CropPlacement): string {
  const fx = p.flip.horizontal ? -1 : 1
  const fy = p.flip.vertical ? -1 : 1
  return `translate(${p.offset.x}px, ${p.offset.y}px) rotate(${p.rotation}deg) scale(${p.zoom * fx}, ${p.zoom * fy})`
}

export function apply(m: Matrix, p: Point): Point {
  return { x: m.a * p.x + m.c * p.y + m.e, y: m.b * p.x + m.d * p.y + m.f }
}

export function invert(m: Matrix): Matrix {
  const det = m.a * m.d - m.b * m.c
  return {
    a: m.d / det,
    b: -m.b / det,
    c: -m.c / det,
    d: m.a / det,
    e: (m.c * m.f - m.d * m.e) / det,
    f: (m.b * m.e - m.a * m.f) / det,
  }
}

const corners = (r: Rect): [Point, Point, Point, Point] => [
  { x: r.x, y: r.y },
  { x: r.x + r.width, y: r.y },
  { x: r.x + r.width, y: r.y + r.height },
  { x: r.x, y: r.y + r.height },
]

/** The crop in natural pixels: the four corners (a quad under rotation) and their bounds. */
export interface CropData {
  readonly corners: readonly [Point, Point, Point, Point]
  readonly rect: Rect
}

export function cropData(p: CropPlacement, crop: Rect): CropData {
  const inv = invert(imageMatrix(p))
  const q = corners(crop).map((c) => apply(inv, c)) as [Point, Point, Point, Point]
  const xs = q.map((c) => c.x)
  const ys = q.map((c) => c.y)
  const x = Math.min(...xs)
  const y = Math.min(...ys)
  return { corners: q, rect: { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y } }
}

/** Every crop corner maps inside the natural image (within half a pixel). */
export function covers(p: CropPlacement, crop: Rect): boolean {
  const { width: W, height: H } = p.natural
  return cropData(p, crop).corners.every(
    (c) => c.x >= -EPS && c.x <= W + EPS && c.y >= -EPS && c.y <= H + EPS,
  )
}

// ── Convex polygons of feasible translations ────────────────────────────────────────────

/** n·v ≤ k */
interface HalfPlane {
  readonly nx: number
  readonly ny: number
  readonly k: number
}

/**
 * Coverage as half-planes on a translation `v` that moves the crop corners by `sign · v`
 * relative to the image: `sign` -1 for the image's offset, +1 for the crop's position.
 */
function coverage(p: CropPlacement, crop: Rect, sign: 1 | -1): HalfPlane[] {
  const m = imageMatrix({ ...p, offset: { x: 0, y: 0 } })
  const inv = invert(m)
  const { width: W, height: H } = p.natural
  const out: HalfPlane[] = []
  for (const q of corners(crop)) {
    // natural = inv(q + sign·v) = inv(q) + sign·L⁻¹v
    const base = apply(inv, q)
    const lx = { nx: inv.a * sign, ny: inv.c * sign }
    const ly = { nx: inv.b * sign, ny: inv.d * sign }
    out.push({ ...lx, k: W - base.x }, { nx: -lx.nx, ny: -lx.ny, k: base.x })
    out.push({ ...ly, k: H - base.y }, { nx: -ly.nx, ny: -ly.ny, k: base.y })
  }
  return out
}

/** Clips a large square by every half-plane (Sutherland–Hodgman); empty when infeasible. */
function polygon(planes: readonly HalfPlane[], around: Point, span: number): Point[] {
  let poly: Point[] = [
    { x: around.x - span, y: around.y - span },
    { x: around.x + span, y: around.y - span },
    { x: around.x + span, y: around.y + span },
    { x: around.x - span, y: around.y + span },
  ]
  for (const h of planes) {
    const inside = (p: Point) => h.nx * p.x + h.ny * p.y <= h.k + 1e-9
    const next: Point[] = []
    for (let i = 0; i < poly.length; i++) {
      const cur = poly[i] as Point
      const prev = poly[(i + poly.length - 1) % poly.length] as Point
      const ci = inside(cur)
      const pi = inside(prev)
      if (ci !== pi) {
        const dc = h.nx * cur.x + h.ny * cur.y - h.k
        const dp = h.nx * prev.x + h.ny * prev.y - h.k
        const t = dp / (dp - dc)
        next.push({ x: prev.x + (cur.x - prev.x) * t, y: prev.y + (cur.y - prev.y) * t })
      }
      if (ci) next.push(cur)
    }
    poly = next
    if (poly.length === 0) return poly
  }
  return poly
}

/** The point of a convex polygon nearest to `p`. */
function nearest(poly: readonly Point[], p: Point): Point {
  const inside = poly.every((a, i) => {
    const b = poly[(i + 1) % poly.length] as Point
    return (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x) >= -1e-9
  })
  if (inside || poly.length === 1) return poly.length === 1 && !inside ? (poly[0] as Point) : p
  let best = poly[0] as Point
  let bestD = Number.POSITIVE_INFINITY
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i] as Point
    const b = poly[(i + 1) % poly.length] as Point
    const dx = b.x - a.x
    const dy = b.y - a.y
    const len = dx * dx + dy * dy
    const t = len === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len))
    const q = { x: a.x + dx * t, y: a.y + dy * t }
    const d = (q.x - p.x) ** 2 + (q.y - p.y) ** 2
    if (d < bestD) {
      bestD = d
      best = q
    }
  }
  return best
}

const span = (p: CropPlacement) => 4 * (p.viewport.width + p.viewport.height) * Math.max(1, p.zoom)

/** Offsets that cover `crop` at this zoom and rotation (empty polygon: none). */
function offsetPolygon(p: CropPlacement, crop: Rect): Point[] {
  // The polygon is counter-clockwise for the inside test when built from a CCW square.
  return polygon(coverage(p, crop, -1), { x: 0, y: 0 }, span(p))
}

/** The smallest zoom in [from, max] at which some offset covers `crop`; `max` if none does. */
export function minCoverZoom(p: CropPlacement, crop: Rect, max: number): number {
  const feasible = (z: number) => offsetPolygon({ ...p, zoom: z }, crop).length > 0
  if (feasible(p.zoom)) return p.zoom
  if (!feasible(max)) return max
  let lo = p.zoom
  let hi = max
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2
    if (feasible(mid)) hi = mid
    else lo = mid
  }
  return hi
}

/**
 * The placement nearest to `p` that covers `crop`: zoom raised to the smallest covering
 * value (up to `maxZoom`), then the offset moved to the nearest covering one.
 */
export function constrainPlacement(p: CropPlacement, crop: Rect, maxZoom: number): CropPlacement {
  const zoom = Math.max(p.zoom, minCoverZoom(p, crop, Math.max(maxZoom, p.zoom)))
  const at = { ...p, zoom }
  const poly = offsetPolygon(at, crop)
  if (poly.length === 0) return at
  return { ...at, offset: nearest(poly, p.offset) }
}

/** The zoom at `zoom` keeping the image point under `anchor` (viewport px) in place. */
export function zoomAt(p: CropPlacement, zoom: number, anchor: Point): CropPlacement {
  const cx = p.viewport.width / 2 + p.offset.x
  const cy = p.viewport.height / 2 + p.offset.y
  const r = zoom / p.zoom
  return {
    ...p,
    zoom,
    offset: {
      x: anchor.x - (anchor.x - cx) * r - p.viewport.width / 2,
      y: anchor.y - (anchor.y - cy) * r - p.viewport.height / 2,
    },
  }
}

// ── Crops ───────────────────────────────────────────────────────────────────────────────

/** The largest centred rectangle with `aspect` (width / height) in 80 % of the image box. */
export function defaultCrop(natural: Size, viewport: Size, aspect?: number): Rect {
  const box = imageBox(natural, viewport)
  let width = box.width * 0.8
  let height = box.height * 0.8
  if (aspect && aspect > 0) {
    if (width / height > aspect) width = height * aspect
    else height = width / aspect
  }
  return {
    x: (viewport.width - width) / 2,
    y: (viewport.height - height) / 2,
    width,
    height,
  }
}

/** Moves `crop` by (dx, dy) as far as the viewport and the image's coverage allow. */
export function moveCrop(p: CropPlacement, crop: Rect, dx: number, dy: number): Rect {
  const vw = p.viewport.width
  const vh = p.viewport.height
  const bounds: HalfPlane[] = [
    { nx: -1, ny: 0, k: crop.x },
    { nx: 1, ny: 0, k: vw - crop.x - crop.width },
    { nx: 0, ny: -1, k: crop.y },
    { nx: 0, ny: 1, k: vh - crop.y - crop.height },
  ]
  const poly = polygon([...coverage(p, crop, 1), ...bounds], { x: 0, y: 0 }, span(p))
  if (poly.length === 0) return crop
  const v = nearest(poly, { x: dx, y: dy })
  return { ...crop, x: crop.x + v.x, y: crop.y + v.y }
}

export type HandlePosition = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw"

export interface ResizeLimits {
  readonly aspect?: number | undefined
  readonly minWidth: number
  readonly minHeight: number
  readonly maxWidth: number
  readonly maxHeight: number
}

/** The rectangle a handle drag of (dx, dy) asks for, before the image's coverage. */
function resized(
  crop: Rect,
  handle: HandlePosition,
  dx: number,
  dy: number,
  l: ResizeLimits,
  viewport: Size,
): Rect {
  const west = handle.includes("w")
  const east = handle.includes("e")
  const north = handle.includes("n")
  const south = handle.includes("s")
  let left = crop.x + (west ? dx : 0)
  let right = crop.x + crop.width + (east ? dx : 0)
  let top = crop.y + (north ? dy : 0)
  let bottom = crop.y + crop.height + (south ? dy : 0)
  // Viewport bounds on the moving edges.
  left = Math.max(0, left)
  top = Math.max(0, top)
  right = Math.min(viewport.width, right)
  bottom = Math.min(viewport.height, bottom)
  let width = Math.min(l.maxWidth, Math.max(l.minWidth, right - left))
  let height = Math.min(l.maxHeight, Math.max(l.minHeight, bottom - top))
  if (l.aspect && l.aspect > 0) {
    // The dragged axis leads; an edge handle drives the other axis from its centre.
    const horizontal = west || east
    const vertical = north || south
    if (horizontal && (!vertical || Math.abs(dx) >= Math.abs(dy))) height = width / l.aspect
    else width = height * l.aspect
  }
  // The opposite edges stay fixed; an edge handle keeps the other axis centred.
  const x = west ? crop.x + crop.width - width : east ? crop.x : crop.x + (crop.width - width) / 2
  const y = north
    ? crop.y + crop.height - height
    : south
      ? crop.y
      : crop.y + (crop.height - height) / 2
  return { x, y, width, height }
}

const insideViewport = (r: Rect, v: Size) =>
  r.x >= -EPS && r.y >= -EPS && r.x + r.width <= v.width + EPS && r.y + r.height <= v.height + EPS

/**
 * Resizes `crop` from `handle` by (dx, dy): the opposite edges stay fixed, the limits and
 * the aspect hold, and the result stays in the viewport and covered (the drag is shortened
 * to the furthest point that satisfies everything).
 */
export function resizeCrop(
  p: CropPlacement,
  crop: Rect,
  handle: HandlePosition,
  dx: number,
  dy: number,
  limits: ResizeLimits,
): Rect {
  const ok = (r: Rect) => insideViewport(r, p.viewport) && covers(p, r)
  const full = resized(crop, handle, dx, dy, limits, p.viewport)
  if (ok(full)) return full
  let lo = 0
  let hi = 1
  let best = crop
  for (let i = 0; i < 30; i++) {
    const mid = (lo + hi) / 2
    const r = resized(crop, handle, dx * mid, dy * mid, limits, p.viewport)
    if (ok(r)) {
      best = r
      lo = mid
    } else hi = mid
  }
  return best
}
