"use client"

import { useEffect } from "react"
import { usePhase } from "./phase"

// For whoever opens the console: the wordmark, and the page's one keyboard secret.
const ART = String.raw`
       _           _
  _ __(_)_ __   __| |
 | '__| | '_ \ / _' |
 | |  | | | | | (_| |
 |_|  |_|_| |_|\__,_|
`
let greeted = false

/** The console's hello, and `j` to switch crisp and juicy from anywhere but a text field. */
export function Secrets() {
  const { phase, setPhase } = usePhase()

  useEffect(() => {
    if (greeted) return
    greeted = true
    console.log(
      `%c${ART}%c\nHeadless components. The look is yours.\n\nPress j to switch crisp and juicy.\nThe source: https://github.com/WatermelonBros/rind-ui`,
      "color:#ff3d8b;font:700 12px monospace",
      "color:inherit;font:12px monospace",
    )
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "j" || e.metaKey || e.ctrlKey || e.altKey || e.repeat) return
      const t = e.target
      if (t instanceof HTMLElement && (t.isContentEditable || t.closest("input, textarea, select")))
        return
      setPhase(phase === "juicy" ? "crisp" : "juicy")
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [phase, setPhase])

  return null
}
