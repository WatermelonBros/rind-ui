// Where the travelling object is, between the page's docks (skin-scene.tsx). A dock is a place
// in the content the object stops at: the machine's control, the builder's preview, the test's
// control, the install's core, the agents' rendered reply, the wall's component, the outro's
// slot. It never parks anywhere else: between two docks it is in flight, and the flight is
// driven by the scroll, so stopping the scroll stops it where it is.
//
// Pure geometry, no DOM: what a dock measures is passed in, so the rules can be checked alone.

/** One dock as measured this frame (viewport pixels). */
export interface DockReading {
  /** the box the object fills there, or null when that dock is not on the page */
  readonly box: DOMRect | null
  /** pixels still to scroll before the object is there (≤ 0: it has arrived) */
  readonly rest: number
  /** pixels scrolled past the point where it sets off again (≤ 0: it is still there) */
  readonly gone: number
}

/** Where the object is: on dock `to` once `t` is 1, in flight from `from` before that. */
export interface DockPosition {
  readonly from: number
  readonly to: number
  /** 0 on `from`, 1 on `to` */
  readonly t: number
  /** pixels scrolled since it arrived on `to` (0 while in flight) */
  readonly past: number
}

/**
 * The flight under way: the last dock it has set off from, and how far towards the next. Both
 * distances move with the scroll at the same rate, so their share is the progress; a dock held
 * by a sticky scene stops its own distance, and the other carries the flight on. `room` is the
 * scroll left on the page: the last dock may sit too low to ever reach its arrival line, so the
 * flight ends at the page's foot instead. Null before the first dock is left.
 */
export function locate(docks: readonly DockReading[], room: number): DockPosition | null {
  for (let k = docks.length - 2; k >= 0; k--) {
    const from = docks[k]
    const to = docks[k + 1]
    if (!from?.box || !to?.box || from.gone <= 0) continue
    const rest = Math.min(to.rest, room)
    const t = rest <= 0 ? 1 : from.gone / (from.gone + rest)
    return { from: k, to: k + 1, t: Math.min(1, t), past: rest <= 0 ? -to.rest : 0 }
  }
  return null
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t
const ease = (t: number) => t * t * (3 - 2 * t)

/**
 * The object's box in flight on a desktop: along one arc from box to box, eased, lifted at its
 * middle so it reads as a throw rather than a slide, and never smaller than `least` pixels
 * across on the way (a small control at either end would make it a speck mid-air).
 */
export function arc(from: DOMRect, to: DOMRect, t: number, lift: number, least = 72): DOMRect {
  const e = ease(t)
  const w = lerp(from.width, to.width, e)
  const h = lerp(from.height, to.height, e)
  const grow = 1 + (Math.max(1, least / Math.max(w, h, 1)) - 1) * Math.sin(Math.PI * t)
  const cx = lerp(from.x + from.width / 2, to.x + to.width / 2, e)
  const cy = lerp(from.y + from.height / 2, to.y + to.height / 2, e) - Math.sin(Math.PI * t) * lift
  return new DOMRect(cx - (w * grow) / 2, cy - (h * grow) / 2, w * grow, h * grow)
}

/**
 * A phone's flight: there is no room beside the copy, so the object never crosses it. It
 * shrinks away into the dock it leaves and grows out of the one it reaches; in between it is not
 * drawn. Returns the box and the opacity.
 */
export function hop(from: DOMRect, to: DOMRect, t: number): { box: DOMRect; alpha: number } {
  const out = Math.min(1, t / 0.2)
  // exactly whole at the end (1 - 0.8 is not 0.2 in floating point)
  const back = t >= 1 ? 1 : Math.min(1, Math.max(0, (t - 0.8) / 0.2))
  const at = t < 0.5 ? from : to
  const k = t < 0.5 ? 1 - 0.6 * ease(out) : 0.4 + 0.6 * ease(back)
  const w = at.width * k
  const h = at.height * k
  const box = new DOMRect(at.x + (at.width - w) / 2, at.y + (at.height - h) / 2, w, h)
  return { box, alpha: t < 0.5 ? 1 - out : back }
}

/** A box of the object's own proportions (`aspect` = width / height) centred in `room`. */
export function fit(room: DOMRect, aspect: number, share = 0.82): DOMRect {
  let w = room.width * share
  let h = w / aspect
  if (h > room.height * share) {
    h = room.height * share
    w = h * aspect
  }
  return new DOMRect(room.x + (room.width - w) / 2, room.y + (room.height - h) / 2, w, h)
}
