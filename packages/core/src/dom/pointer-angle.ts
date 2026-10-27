// pointer-angle (add-angle-slider design §3; the Color Wheel is its second user): the angle of
// a pointer around the centre of an element, clockwise from the top in degrees, and a
// press-then-track session on `trackPointer`. Not mirrored under RTL: a compass does not mirror.

import { trackPointer } from "./pointer-drag"

interface PointerLike {
  readonly clientX: number
  readonly clientY: number
}

/** Inside this fraction of the radius the direction is noise: no angle. */
const DEAD_ZONE = 0.1

/** The angle of `(dx, dy)` (screen axes, y down), clockwise from the top, in [0, 360). */
export function angleOf(dx: number, dy: number): number {
  const deg = (Math.atan2(dx, -dy) * 180) / Math.PI
  return (deg + 360) % 360
}

/** The pointer's angle around the surface's centre, or null (no layout, or at the centre). */
export function pointerAngle(surface: Element, p: PointerLike): number | null {
  const r = surface.getBoundingClientRect()
  if (r.width === 0 || r.height === 0) return null
  const dx = p.clientX - (r.left + r.width / 2)
  const dy = p.clientY - (r.top + r.height / 2)
  const radius = Math.min(r.width, r.height) / 2
  if (Math.hypot(dx, dy) < radius * DEAD_ZONE) return null
  return angleOf(dx, dy)
}

/**
 * The pointer's distance from the surface's centre over its outer radius (half the smaller
 * side): 0 at the centre, 1 on the edge, more outside; null without layout.
 */
export function pointerRadius(surface: Element, p: PointerLike): number | null {
  const r = surface.getBoundingClientRect()
  if (r.width === 0 || r.height === 0) return null
  const dx = p.clientX - (r.left + r.width / 2)
  const dy = p.clientY - (r.top + r.height / 2)
  return Math.hypot(dx, dy) / (Math.min(r.width, r.height) / 2)
}

/** Whether a press lands on a ring `thickness` px wide at the surface's edge (Color Wheel). */
export function onRing(surface: Element, p: PointerLike, thickness: number): boolean {
  const radius = pointerRadius(surface, p)
  if (radius === null) return false
  const r = surface.getBoundingClientRect()
  const outer = Math.min(r.width, r.height) / 2
  return radius <= 1 && radius >= 1 - thickness / outer
}

export type AngleMessage =
  | { readonly type: "move"; readonly angle: number }
  | { readonly type: "up" }
  | { readonly type: "cancel" }

/** What a machine's drag effect reaches the press through (injected; recorded in tests). */
export interface PointerAngleCapability {
  track(send: (m: AngleMessage) => void): () => void
}

/**
 * The part's `pointerdown` calls `press` (returns the angle for POINTER.DOWN; `anchor` is the
 * thumb's angle, so a drag from the thumb keeps its offset), the machine's effect calls `track`.
 */
export function pointerAngleSession() {
  let pending: { surface: Element; pointerId: number; offset: number } | null = null
  let tracking = false
  return {
    get active() {
      return tracking
    },
    press(
      surface: Element,
      e: PointerLike & { readonly pointerId: number },
      anchor?: number,
    ): number | null {
      const raw = pointerAngle(surface, e)
      const offset = raw !== null && anchor !== undefined ? raw - anchor : 0
      pending = { surface, pointerId: e.pointerId, offset }
      return raw === null ? null : (raw - offset + 360) % 360
    },
    track(send: (m: AngleMessage) => void): () => void {
      const p = pending
      pending = null
      if (!p || tracking) return () => {}
      tracking = true
      const stop = trackPointer<AngleMessage & { readonly type: "move" }>(
        p.surface,
        p.pointerId,
        (m) => {
          if (m.type !== "move") tracking = false
          send(m)
        },
        (ptr) => {
          const a = pointerAngle(p.surface, ptr)
          return a === null ? null : { type: "move", angle: (a - p.offset + 360) % 360 }
        },
      )
      return () => {
        tracking = false
        stop()
      }
    },
  } satisfies PointerAngleCapability & Record<string, unknown>
}

export type PointerAngleSession = ReturnType<typeof pointerAngleSession>
