// rect-bounds (add-floating-panel design §3): pure clamp rules for a rectangle moved and resized
// inside a boundary. Coordinates are the boundary's content box; nothing here measures.

export interface Point {
  readonly x: number
  readonly y: number
}
export interface Size {
  readonly width: number
  readonly height: number
}
export interface Rect extends Point, Size {}

/** A resize handle: the edges and corners it moves. */
export type ResizeAxis = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw"

export interface RectLimits {
  readonly boundary: Size
  readonly minSize: Size
  readonly maxSize?: Size | undefined
  /** Pixels of the rect kept inside the boundary on each axis. */
  readonly minVisible: number
}

const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), Math.max(lo, hi))

/** The size within min and max (max defaults to the boundary). */
export function clampSize(size: Size, l: RectLimits): Size {
  const max = l.maxSize ?? l.boundary
  return {
    width: clamp(size.width, l.minSize.width, Math.min(max.width, l.boundary.width) || size.width),
    height: clamp(
      size.height,
      l.minSize.height,
      Math.min(max.height, l.boundary.height) || size.height,
    ),
  }
}

/** The position keeping `minVisible` px inside on each axis, and the top edge never above 0. */
export function clampPosition(p: Point, size: Size, l: RectLimits): Point {
  const keepX = Math.min(l.minVisible, size.width)
  const keepY = Math.min(l.minVisible, size.height)
  return {
    x: clamp(p.x, keepX - size.width, l.boundary.width - keepX),
    y: clamp(p.y, 0, l.boundary.height - keepY),
  }
}

export function clampRect(r: Rect, l: RectLimits): Rect {
  const size = clampSize(r, l)
  return { ...clampPosition(r, size, l), ...size }
}

/** The rect after a resize drag of (dx, dy) on `axis`: the opposite edges stay put. */
export function resizeRect(r: Rect, axis: ResizeAxis, dx: number, dy: number, l: RectLimits): Rect {
  // No boundary measured yet (server, no layout): only the min and max sizes apply.
  const bounded = l.boundary.width > 0 && l.boundary.height > 0
  const max = l.maxSize ?? (bounded ? l.boundary : { width: Infinity, height: Infinity })
  let { x, y, width, height } = r
  if (axis.includes("e")) width = clamp(width + dx, l.minSize.width, max.width)
  if (axis.includes("s")) height = clamp(height + dy, l.minSize.height, max.height)
  if (axis.includes("w")) {
    const w = clamp(width - dx, l.minSize.width, max.width)
    x += width - w
    width = w
  }
  if (axis.includes("n")) {
    const h = clamp(height - dy, l.minSize.height, max.height)
    const ny = Math.max(0, y + height - h)
    height = y + height - ny
    y = ny
  }
  return bounded ? clampRect({ x, y, width, height }, l) : { x, y, width, height }
}
