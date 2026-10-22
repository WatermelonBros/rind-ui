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

const BG: Record<Phase, string> = { crisp: "#d4ff3a", juicy: "#e9e2ff" }
const POUR_MS = 1400
// The curtain fully covers the page between 40% and 60% of its run; flip in the middle.
const FLIP_AT = POUR_MS / 2
// how long surfaces ease into a new phase after a morph (html.morphing in globals.css)
const MORPH_MS = 900

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

  const apply = useCallback((next: Phase, morph = false) => {
    const root = document.documentElement
    // a morph lets every surface ease into the new phase (globals.css: html.morphing); a flip
    // paints the new phase at once, under the curtain
    root.classList.add(morph ? "morphing" : "flipping")
    root.dataset["phase"] = next
    setPhaseState(next)
    try {
      localStorage.setItem("rind-phase", next)
    } catch {
      // storage can be unavailable (private mode); the phase just won't persist
    }
    if (morph) setTimeout(() => root.classList.remove("morphing"), MORPH_MS)
    // Two frames: the new styles are painted with transitions off, then transitions return.
    else requestAnimationFrame(() => requestAnimationFrame(() => root.classList.remove("flipping")))
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
        // the new phase spreads from the press as a wave: inside it the page is already the new
        // one, live, its corners, borders and shadows still easing into shape (the 3D object
        // swells or hardens with it); juicy arrives as a round wave that overshoots and settles,
        // crisp as a hard-edged diamond that snaps open
        busy.current = true
        const recent = performance.now() - origin.current.at < 1500
        const x = recent ? origin.current.x : innerWidth - 60
        const y = recent ? origin.current.y : 30
        const far = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y))
        const vt = doc.startViewTransition(() => flushSync(() => apply(next, true)))
        vt.ready.then(() => {
          const juicy = next === "juicy"
          document.documentElement.animate(
            {
              clipPath: juicy
                ? [`circle(0px at ${x}px ${y}px)`, `circle(${far}px at ${x}px ${y}px)`]
                : [
                    `polygon(${x}px ${y}px, ${x}px ${y}px, ${x}px ${y}px, ${x}px ${y}px)`,
                    `polygon(${x}px ${y - far * 1.5}px, ${x + far * 1.5}px ${y}px, ${x}px ${y + far * 1.5}px, ${x - far * 1.5}px ${y}px)`,
                  ],
            },
            {
              duration: juicy ? 1100 : 700,
              easing: juicy
                ? "linear(0, 0.22 8%, 0.62 20%, 0.94 32%, 1.06 42%, 1.08 50%, 1.03 62%, 0.99 76%, 1)"
                : "cubic-bezier(0.85, 0, 0.15, 1)",
              pseudoElement: "::view-transition-new(root)",
            },
          )
        })
        vt.finished.finally(() => {
          busy.current = false
        })
        return
      }
      busy.current = true
      setPour({ next, drops: drops(), id: Date.now() })
      setTimeout(() => apply(next), FLIP_AT)
      setTimeout(() => {
        setPour(null)
        busy.current = false
      }, POUR_MS + 50)
    },
    [apply],
  )

  return (
    <PhaseContext.Provider value={{ phase, setPhase }}>
      {children}
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
