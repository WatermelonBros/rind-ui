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

  const apply = useCallback((next: Phase) => {
    const root = document.documentElement
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
