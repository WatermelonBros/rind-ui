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
  /** Where in the viewport (0 top, 1 bottom) the first landing's centre ends the trip: earlier
   *  than the middle when the next hand-off leaves from the same scene. */
  readonly endAt?: number
}

const DESKTOP = "(min-width: 761px) and (prefers-reduced-motion: no-preference)"
const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2)
const clamp = (t: number) => Math.min(1, Math.max(0, t))
// a start that can be used (a link, a button) stays put; anything else is drawn away while its
// copy travels, by opacity only, so it stays in the accessibility tree
const spent = (el: Element) => !el.matches("a, button, input, select, textarea, [tabindex]")
const show = (els: readonly Element[], on: boolean) => {
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
    const gone = vh - scene.getBoundingClientRect().bottom
    const r = first.getBoundingClientRect()
    const rest = r.top + r.height / 2 - vh * (o.endAt ?? 0.5)
    const t = gone <= 0 ? 0 : rest <= 0 ? 1 : clamp(gone / (gone + rest))
    if (t > 0 !== left) {
      left = t > 0
      o.leaving?.(left)
      // every start goes at once, so no copy ever passes over a start still waiting its turn
      show(from, !left)
    }
    const n = from.length
    // one after another: each starts a little after the one before and lands on its own beat
    const gap = n > 1 ? 0.22 : 0
    const own = (i: number) => clamp((t - i * gap) / (1 - (n - 1) * gap))
    if (t > 0 && t < 1) {
      if (!layer) {
        layer = document.createElement("div")
        layer.setAttribute("aria-hidden", "true")
        layer.style.cssText = "position:fixed;inset:0;z-index:45;pointer-events:none"
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
      travellers.forEach((node, i) => {
        const a = from[i]?.getBoundingClientRect()
        const b = to[i % to.length]?.getBoundingClientRect()
        const ti = own(i)
        if (!a || !b || ti <= 0 || ti >= 1) {
          node.style.opacity = "0"
          return
        }
        o.update?.(node, ti, i)
        const ax = a.left + a.width / 2
        const ay = a.top + a.height / 2
        const bx = b.left + b.width / 2
        const by = b.top + b.height / 2
        let x: number
        let y: number
        if (lane === undefined) {
          x = ax + (bx - ax) * ease(clamp((ti - 0.35) / 0.65))
          y = ay + (by - ay) * ease(clamp(ti * 1.4))
        } else {
          // out to the margin, down it, then in along the landing's line
          const out = ease(clamp(ti / 0.2))
          const down = ease(clamp((ti - 0.15) / 0.65))
          const into = ease(clamp((ti - 0.8) / 0.2))
          x = ax + (lane - ax) * out + (bx - lane) * into
          y = ay + (by - ay) * down
        }
        // it leaves at its start's size, travels at its own and lands at the landing's
        const w = node.offsetWidth || 1
        const h = node.offsetHeight || 1
        const grow = ease(clamp(ti / 0.25))
        const shrink = ease(clamp((ti - 0.75) / 0.25))
        const s = (a.height / h) * (1 - grow) + grow * (1 - shrink) + (b.height / h) * shrink
        // whole on screen, however wide the traveller is next to its lane
        const half = (w * s) / 2
        x = Math.min(window.innerWidth - half - 16, Math.max(half + 16, x))
        node.style.transform = `translate(${x - half}px, ${y - (h * s) / 2}px) scale(${s})`
        // it lifts off its start and melts into its landing, never a copy lying on either
        node.style.opacity = String(Math.min(1, ti / 0.12, (1 - ti) / 0.1))
      })
    } else if (t <= 0) clear()
    else {
      layer?.remove()
      layer = null
      travellers = []
    }
    // each landing is caught as the first traveller bound for it arrives
    to.forEach((target, j) => {
      const on = from.some((_, i) => i % to.length === j && own(i) >= 1)
      if (on === (caught[j] ?? false)) return
      caught[j] = on
      o.landed?.(target, on)
    })
  }

  const schedule = () => {
    if (!frame) frame = requestAnimationFrame(paint)
  }
  window.addEventListener("scroll", schedule, { passive: true })
  window.addEventListener("resize", schedule)
  media.addEventListener("change", schedule)
  schedule()
  return () => {
    cancelAnimationFrame(frame)
    window.removeEventListener("scroll", schedule)
    window.removeEventListener("resize", schedule)
    media.removeEventListener("change", schedule)
    clear()
  }
}
