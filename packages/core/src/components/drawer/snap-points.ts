// Drawer snap points (openspec add-drawer, design §1): pure functions, so the guards the
// machine uses are tested in Node. Nothing here reads a clock; velocities arrive measured.

import type { SwipeDirection, SwipeRelease } from "../../dom/swipe"

/** A fraction of the viewport (0 to 1), CSS pixels (a number above 1) or a `px` / `rem` string. */
export type SnapPoint = number | `${number}px` | `${number}rem`

export interface SnapSizes {
  /** The content's size on the drawer's axis (px). */
  readonly content: number
  /** The viewport's extent on the drawer's axis (px). */
  readonly viewport: number
  readonly rootFontSize: number
}

export interface ResolvedSnapPoint {
  readonly point: SnapPoint
  /** Visible size (px). */
  readonly size: number
  /** How far the drawer is translated from fully open (px): content size minus `size`. */
  readonly offset: number
}

/** Points closer than this count once (px). */
export const SNAP_DEDUPE = 1
/** How far ahead the release velocity is projected (ms). */
export const SNAP_PROJECTION = 300
/** Sequential mode moves a point only past this drag distance (px) or the velocity threshold. */
export const SNAP_SEQUENTIAL_DISTANCE = 10

function toPx(point: SnapPoint, sizes: SnapSizes): number {
  if (typeof point === "number") return point <= 1 ? point * sizes.viewport : point
  const value = Number.parseFloat(point)
  return point.endsWith("rem") ? value * sizes.rootFontSize : value
}

/** Ordered by size, clamped to the content and viewport, deduplicated within 1 px. */
export function resolveSnapPoints(
  points: readonly SnapPoint[],
  sizes: SnapSizes,
): ResolvedSnapPoint[] {
  const max = Math.min(sizes.content, sizes.viewport)
  const kept: ResolvedSnapPoint[] = []
  for (const point of points) {
    const raw = toPx(point, sizes)
    const size = Math.min(Math.max(Number.isFinite(raw) ? raw : 0, 0), max)
    // Given order decides which of two near-equal points survives.
    if (kept.some((k) => Math.abs(k.size - size) < SNAP_DEDUPE)) continue
    kept.push({ point, size, offset: sizes.content - size })
  }
  return kept.sort((a, b) => a.size - b.size)
}

export interface SwipeSettings {
  /** The direction that dismisses (toward the drawer's edge). */
  readonly edge: SwipeDirection
  readonly closeOnSwipe: boolean
  /** Fraction of the size. */
  readonly swipeThreshold: number
  /** px/ms */
  readonly swipeVelocityThreshold: number
}

export interface SnapState {
  readonly resolved: readonly ResolvedSnapPoint[]
  readonly current: SnapPoint
}

const OPPOSITE: Record<SwipeDirection, SwipeDirection> = {
  up: "down",
  down: "up",
  left: "right",
  right: "left",
}

// An unknown current point (stale controlled value) is treated as fully open.
function currentIndex(snap: SnapState): number {
  const i = snap.resolved.findIndex((r) => r.point === snap.current)
  return i === -1 ? snap.resolved.length - 1 : i
}

/** Signed change of visible size the release asks for: negative toward the edge. */
function sizeDelta(release: SwipeRelease, edge: SwipeDirection, offset: number): number {
  if (release.direction === edge) return -offset
  if (release.direction === OPPOSITE[edge]) return offset
  return 0
}

/**
 * Whether a release closes the drawer. Without snap points: offset or velocity past the
 * thresholds. With them: the projected size must fall under the smallest point by the same
 * `swipeThreshold` fraction (a nudge down from the lowest point settles, it does not close).
 */
export function swipeDismisses(
  release: SwipeRelease,
  opts: SwipeSettings,
  snap?: SnapState,
): boolean {
  if (!opts.closeOnSwipe || release.direction === null || release.direction !== opts.edge) {
    return false
  }
  const smallest = snap?.resolved[0]
  if (!snap || !smallest) {
    return (
      release.offset >= opts.swipeThreshold * release.size ||
      release.velocity >= opts.swipeVelocityThreshold
    )
  }
  const current = snap.resolved[currentIndex(snap)] ?? smallest
  const projected = current.size - release.offset - release.velocity * SNAP_PROJECTION
  // Below the smallest point (spec "Swipe To Dismiss"): a release that would settle there
  // or above stays open.
  return projected < smallest.size
}

/** The point a release that does not close settles on. */
export function settleTarget(
  release: SwipeRelease,
  opts: {
    readonly edge: SwipeDirection
    readonly sequential: boolean
    readonly swipeVelocityThreshold: number
  },
  snap: SnapState,
): ResolvedSnapPoint | undefined {
  const index = currentIndex(snap)
  const current = snap.resolved[index]
  if (!current) return undefined
  const sign = Math.sign(sizeDelta(release, opts.edge, 1))
  if (sign === 0) return current

  if (opts.sequential) {
    const moved =
      release.offset > SNAP_SEQUENTIAL_DISTANCE || release.velocity >= opts.swipeVelocityThreshold
    return moved ? (snap.resolved[index + sign] ?? current) : current
  }

  const projected = current.size + sign * (release.offset + release.velocity * SNAP_PROJECTION)
  let best = current
  for (const r of snap.resolved) {
    if (Math.abs(r.size - projected) < Math.abs(best.size - projected)) best = r
  }
  return best
}

/** The handle press: the next larger point, wrapping from the largest to the smallest. */
export function cycle(
  resolved: readonly ResolvedSnapPoint[],
  current: SnapPoint,
): ResolvedSnapPoint | undefined {
  if (resolved.length === 0) return undefined
  const i = resolved.findIndex((r) => r.point === current)
  return resolved[(i + 1) % resolved.length]
}
