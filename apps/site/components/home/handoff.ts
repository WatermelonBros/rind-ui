import { zoom } from "../zoom"

// A hand-off between two scenes of the landing: as one scene lets go, a few of its elements
// travel, tied to the scroll, and land on elements of the next one, so the page reads as one
// story instead of rooms. Desktop only, with motion allowed: on a phone or under reduced motion
// nothing travels and the scenes stay as they are. The travellers are decorative copies on a
// fixed layer (aria-hidden); the real elements never move, so nothing changes for assistive tech
// or for layout. Scrolling back rewinds it.

export interface HandoffOptions {
  /** The scene that lets go: the trip starts as its bottom edge rises past the viewport's. */
  readonly scene: () => Element | null
  /** Where they start, read every frame (sticky scenes move them). */
  readonly from: () => readonly Element[]
  /** Where they land: traveller i lands on to[i % to.length]. The trip ends as the first one's
   *  centre reaches the viewport's middle. */
  readonly to: () => readonly Element[]
  /** The traveller for a start element, and what it shows for t (0 to 1) along the trip. */
  readonly make: (from: Element, i: number) => HTMLElement
  readonly update?: (traveller: HTMLElement, t: number, i: number) => void
  /** Each landing element, as a traveller lands on it (true) or rewinds from it (false). */
  readonly landed?: (to: Element, on: boolean) => void
  /** The scene being left, as the trip starts (true) or rewinds to before it (false): it can
   *  clear what the travellers leave behind. */
  readonly leaving?: (on: boolean) => void
  /** A margin to travel in (x in viewport pixels): out to it first, down it, and into the
   *  landing only at the end, along the landing's own line, so the trip never crosses copy. */
  readonly lane?: () => number
  /** Instead of lane moves: one smooth swing out through the right of the page and back in to
   *  its landing, crossing no copy on the way. */
  readonly curve?: boolean
  /** The starts stay as they are while their copies travel (a result that must stay readable,
   *  the tests' PASS), instead of being drawn away. */
  readonly keep?: boolean
  /** With a lane: a clear strip under the landing's own paragraph (y in viewport pixels). The
   *  traveller crosses along it and rises into its landing from below, so it never crosses the
   *  paragraph's copy: for a landing in running text whose last line ends short of it. */
  readonly under?: () => number
  /** Where in the viewport (0 top, 1 bottom) the first landing's centre ends the trip: earlier
   *  than the middle when the next hand-off leaves from the same scene. */
  readonly endAt?: number
  /** Where in the viewport the scene's bottom edge starts the trip (1, the viewport's bottom,
   *  by default): later, when the hand-off before leaves from the same place. */
  readonly startAt?: number
  /** The page has come to rest and the travellers fade out where they are: what gave way to
   *  one still on its way comes back (the next scroll paints them again). */
  readonly rest?: () => void
  /** With several travellers: how far into the trip each sets off after the one before (0.22
   *  by default); smaller, and the last lands sooner after the first. */
  readonly gap?: number
}

import { cue, panOf } from "../sound"

const DESKTOP = "(min-width: 761px) and (prefers-reduced-motion: no-preference)"
const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2)
const clamp = (t: number) => Math.min(1, Math.max(0, t))
// a traveller is on its landing by this share of its trip and holds still there for the rest,
// fading into it: one still moving as it fades read as landing beside its target
const ARRIVE = 0.86
// a start that can be used (a link, a button) stays put; anything else is drawn away while its
// copy travels, by opacity only, so it stays in the accessibility tree
const spent = (el: Element) => !el.matches("a, button, input, select, textarea, [tabindex]")
const show = (els: readonly Element[], on: boolean, keep = false) => {
  if (keep) return
  for (const el of els) if (spent(el)) (el as HTMLElement).style.opacity = on ? "" : "0"
}

export function handoff(o: HandoffOptions): () => void {
  const media = matchMedia(DESKTOP)
  let layer: HTMLDivElement | null = null
  let travellers: HTMLElement[] = []
  let frame = 0
  let left = false
  const caught: boolean[] = []

  const clear = () => {
    layer?.remove()
    layer = null
    travellers = []
    show(o.from(), true)
  }

  const paint = () => {
    frame = 0
    const scene = o.scene()
    const from = o.from()
    const to = o.to()
    const first = to[0]
    if (!media.matches || !scene || !from.length || !first) return clear()
    const vh = window.innerHeight
    // both distances move with the scroll at the same rate, so their share is the progress
    const gone = vh * (o.startAt ?? 1) - scene.getBoundingClientRect().bottom
    const r = first.getBoundingClientRect()
    const rest = r.top + r.height / 2 - vh * (o.endAt ?? 0.5)
    const t = gone <= 0 ? 0 : rest <= 0 ? 1 : clamp(gone / (gone + rest))
    if (t > 0 !== left) {
      left = t > 0
      o.leaving?.(left)
      // every start goes at once, so no copy ever passes over a start still waiting its turn
      show(from, !left, o.keep)
    }
    const n = from.length
    // one after another: each starts a little after the one before and lands on its own beat
    const gap = n > 1 ? (o.gap ?? 0.22) : 0
    const own = (i: number) => clamp((t - i * gap) / (1 - (n - 1) * gap))
    if (t > 0 && t < 1) {
      if (!layer) {
        layer = document.createElement("div")
        layer.setAttribute("aria-hidden", "true")
        layer.style.cssText = "position:fixed;inset:0;z-index:45;pointer-events:none"
        // unzoomed inside (zoom.ts), so the rects it is placed from are its own pixels
        layer.style.zoom = String(1 / zoom())
        travellers = from.map((el, i) => {
          const node = o.make(el, i)
          node.style.position = "absolute"
          node.style.left = "0"
          node.style.top = "0"
          node.style.transformOrigin = "0 0"
          node.style.willChange = "transform, opacity"
          layer?.appendChild(node)
          return node
        })
        document.body.appendChild(layer)
      }
      const lane = o.lane?.()
      const under = o.under?.()
      travellers.forEach((node, i) => {
        const a = from[i]?.getBoundingClientRect()
        const b = to[i % to.length]?.getBoundingClientRect()
        const ti = own(i)
        if (!a || !b || ti <= 0 || ti >= 1) {
          node.style.opacity = "0"
          return
        }
        o.update?.(node, ti, i)
        const p = clamp(ti / ARRIVE)
        const ax = a.left + a.width / 2
        const ay = a.top + a.height / 2
        const bx = b.left + b.width / 2
        const by = b.top + b.height / 2
        let x: number
        let y: number
        if (o.curve) {
          // one smooth swing out through the right of the page and back in to the landing (a
          // cubic curve), so it never crosses the copy between them (the next scene's title)
          const side = window.innerWidth * 0.86
          const c1x = side
          const c1y = ay + (by - ay) * 0.15
          const c2x = side
          const c2y = by - (by - ay) * 0.1
          const u = ease(p)
          const v = 1 - u
          x = v * v * v * ax + 3 * v * v * u * c1x + 3 * v * u * u * c2x + u * u * u * bx
          y = v * v * v * ay + 3 * v * v * u * c1y + 3 * v * u * u * c2y + u * u * u * by
        } else if (lane === undefined) {
          x = ax + (bx - ax) * ease(clamp((p - 0.35) / 0.65))
          y = ay + (by - ay) * ease(clamp(p * 1.4))
        } else if (under !== undefined) {
          // out to the margin, down it to the strip under the paragraph, along it, then up
          const out = ease(clamp(p / 0.2))
          const down = ease(clamp((p - 0.15) / 0.45))
          const across = ease(clamp((p - 0.6) / 0.2))
          const up = ease(clamp((p - 0.8) / 0.2))
          x = ax + (lane - ax) * out + (bx - lane) * across
          y = ay + (under - ay) * down + (by - under) * up
        } else {
          // out to the margin, down it, then in along the landing's line
          const out = ease(clamp(p / 0.2))
          const down = ease(clamp((p - 0.15) / 0.65))
          const into = ease(clamp((p - 0.8) / 0.2))
          x = ax + (lane - ax) * out + (bx - lane) * into
          y = ay + (by - ay) * down
        }
        // it leaves at its start's size, travels at its own and lands at the landing's
        const w = node.offsetWidth || 1
        const h = node.offsetHeight || 1
        const grow = ease(clamp(p / 0.25))
        const shrink = ease(clamp((p - 0.75) / 0.25))
        const s = (a.height / h) * (1 - grow) + grow * (1 - shrink) + (b.height / h) * shrink
        // whole on screen, however wide the traveller is next to its lane
        const half = (w * s) / 2
        // (only on the way: where it lands is where it lands)
        if (p < 1) x = Math.min(window.innerWidth - half - 32, Math.max(half + 32, x))
        node.style.transform = `translate(${x - half}px, ${y - (h * s) / 2}px) scale(${s})`
        // it lifts off its start and melts into its landing in a breath: a scroll paused while
        // it was half faded left a ghost of it lying over the copy
        // A copy leaving a start that stays (the PASS) shows only once it is clear of it: at
        // rest at the very start it lay over the start's own type
        const lift = o.keep ? clamp((ti - 0.06) / 0.08) : ti / 0.05
        node.style.opacity = String(clamp(Math.min(lift, (ARRIVE + 0.03 - ti) / 0.03)))
      })
    } else if (t <= 0) clear()
    else {
      layer?.remove()
      layer = null
      travellers = []
    }
    // each landing is caught as the first traveller bound for it arrives, and the traveller
    // melts into it
    to.forEach((target, j) => {
      const on = from.some((_, i) => i % to.length === j && own(i) >= ARRIVE)
      if (on === (caught[j] ?? false)) return
      caught[j] = on
      o.landed?.(target, on)
      // each arrival rings, a step higher along the run
      if (on) cue("ding", { pan: panOf(target), value: j / Math.max(1, to.length - 1) })
    })
  }

  const schedule = () => {
    if (!frame) frame = requestAnimationFrame(paint)
  }
  // the page at rest never shows a traveller frozen mid-flight over the copy: a moment after the
  // scroll stops the layer fades out, and comes back the instant it moves again (those that
  // arrived have already melted into their landings)
  let rest = 0
  const onScroll = () => {
    schedule()
    if (layer) {
      layer.style.transition = "none"
      layer.style.opacity = "1"
    }
    clearTimeout(rest)
    rest = window.setTimeout(() => {
      if (!layer) return
      layer.style.transition = "opacity 0.3s"
      layer.style.opacity = "0"
      o.rest?.()
    }, 260)
  }
  window.addEventListener("scroll", onScroll, { passive: true })
  window.addEventListener("resize", schedule)
  media.addEventListener("change", schedule)
  schedule()
  return () => {
    cancelAnimationFrame(frame)
    clearTimeout(rest)
    window.removeEventListener("scroll", onScroll)
    window.removeEventListener("resize", schedule)
    media.removeEventListener("change", schedule)
    clear()
  }
}
