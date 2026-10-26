"use client"

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react"
import { flushSync } from "react-dom"
import styles from "./phase.module.css"
import { SoundProvider } from "./sound"
import { wave } from "./wave"

export type Phase = "crisp" | "juicy"

interface PhaseContextValue {
  readonly phase: Phase
  readonly setPhase: (next: Phase) => void
}

const PhaseContext = createContext<PhaseContextValue | null>(null)

export function usePhase(): PhaseContextValue {
  const ctx = useContext(PhaseContext)
  if (!ctx) throw new Error("usePhase must be used inside <PhaseProvider>")
  return ctx
}

const BG: Record<Phase, string> = { crisp: "#d4ff3a", juicy: "#ffd9d2" }
const POUR_MS = 1400
// The curtain fully covers the page between 40% and 60% of its run; flip in the middle.
const FLIP_AT = POUR_MS / 2

interface Drop {
  readonly left: number
  readonly size: number
  readonly stretch: number
  readonly lag: number
}

const drops = (): Drop[] =>
  Array.from({ length: 20 }, (_, i) => {
    const size = 7 + Math.random() * 9
    return { left: i * 6.4 - 2, size, stretch: 1 + Math.random() * 0.8, lag: Math.random() * 6 }
  })

export function PhaseProvider({ children }: { children: ReactNode }) {
  const [phase, setPhaseState] = useState<Phase>("juicy")
  const [pour, setPour] = useState<{ next: Phase; drops: Drop[]; id: number } | null>(null)
  const busy = useRef(false)

  // The inline script in <head> may already have restored "crisp" before hydration.
  useEffect(() => {
    if (document.documentElement.dataset["phase"] === "crisp") setPhaseState("crisp")
  }, [])

  // where the change starts: the last press (the nav's switch, as a rule), else the top right
  const origin = useRef({ x: 0, y: 0, at: 0 })
  useEffect(() => {
    const press = (e: PointerEvent) => {
      origin.current = { x: e.clientX, y: e.clientY, at: e.timeStamp }
    }
    window.addEventListener("pointerdown", press, { passive: true })
    return () => window.removeEventListener("pointerdown", press)
  }, [])

  const apply = useCallback((next: Phase) => {
    const root = document.documentElement
    // the new phase is painted at once, under the curtain or the wave: surfaces easing into it
    // showed inside the wave as blocks of the old colour, and a muddy mix of the two
    root.classList.add("flipping")
    root.dataset["phase"] = next
    setPhaseState(next)
    try {
      localStorage.setItem("rind-phase", next)
    } catch {
      // storage can be unavailable (private mode); the phase just won't persist
    }
    // Two frames: the new styles are painted with transitions off, then transitions return.
    requestAnimationFrame(() => requestAnimationFrame(() => root.classList.remove("flipping")))
  }, [])

  const setPhase = useCallback(
    (next: Phase) => {
      if (busy.current || next === document.documentElement.dataset["phase"]) return
      if (matchMedia("(prefers-reduced-motion: reduce)").matches) return apply(next)
      const doc = document as Document & {
        startViewTransition?: (update: () => void) => {
          ready: Promise<void>
          finished: Promise<void>
        }
      }
      if (doc.startViewTransition) {
        // the new phase spreads from the press as a wave over the old page, which dims under it;
        // juicy arrives as a round wave that overshoots and settles, crisp as a hard-edged
        // diamond that snaps open
        busy.current = true
        // no scrolling while it runs: the live new page would slide under the old page's still
        // snapshot, and the two would show in blocks, out of step. Caught before the smooth
        // scroll sees it (smooth-scroll.tsx), whose glide from the last wheel stops here too.
        const hold = (e: Event) => {
          e.preventDefault()
          e.stopPropagation()
        }
        for (const t of ["wheel", "touchmove"])
          addEventListener(t, hold, { passive: false, capture: true })
        dispatchEvent(new Event("rind:scroll-sync"))
        const recent = performance.now() - origin.current.at < 1500
        const x = recent ? origin.current.x : innerWidth - 60
        const y = recent ? origin.current.y : 30
        const vt = doc.startViewTransition(() => flushSync(() => apply(next)))
        vt.ready.then(() => wave(x, y, next === "juicy", { dim: true }))
        vt.finished.finally(() => {
          busy.current = false
          for (const t of ["wheel", "touchmove"]) removeEventListener(t, hold, { capture: true })
          // the titles answer once the wave has passed: inside it their letters would be hidden
          // behind its front (home/letters.tsx)
          document.documentElement.dataset["letters"] = next
        })
        return
      }
      busy.current = true
      setPour({ next, drops: drops(), id: Date.now() })
      setTimeout(() => apply(next), FLIP_AT)
      setTimeout(() => {
        setPour(null)
        busy.current = false
        document.documentElement.dataset["letters"] = next
      }, POUR_MS + 50)
    },
    [apply],
  )

  return (
    <PhaseContext.Provider value={{ phase, setPhase }}>
      {/* wherever the site's chrome is (the 404 page too), its sound setting is */}
      <SoundProvider>{children}</SoundProvider>
      {pour && (
        <div className={styles.wipe} aria-hidden="true" key={pour.id}>
          <div className={styles.curtain} style={{ background: BG[pour.next] }}>
            {pour.drops.map((d) => (
              <span key={`lead-${d.left}`}>
                <i
                  style={{
                    left: `${d.left}vw`,
                    top: `calc(130vh - ${d.size * 0.55 - d.lag}vw)`,
                    width: `${d.size}vw`,
                    height: `${d.size * d.stretch}vw`,
                    background: BG[pour.next],
                  }}
                />
                <i
                  style={{
                    left: `${d.left}vw`,
                    top: `${-d.size * 0.45}vw`,
                    width: `${d.size}vw`,
                    height: `${d.size}vw`,
                    background: BG[pour.next],
                  }}
                />
              </span>
            ))}
          </div>
        </div>
      )}
    </PhaseContext.Provider>
  )
}
