"use client"

import { useRouter } from "next/navigation"
import { useEffect } from "react"
import { wave } from "./wave"

/**
 * Every move between the site's pages opens the next one with the phase's wave, from where the
 * link was pressed (wave.ts). One listener for every link, so no link has to opt in. It waits
 * for the next page to be mounted (its <main> replaced) within the browser's deadline; a page
 * slow to arrive just cuts in. Links that morph their text into the next title (morph-link.tsx,
 * `data-morph`) keep their own transition. Plain navigation without view transitions, under
 * reduced motion, with a modifier key, for a new tab, another site or a place on this page.
 */
export function RouteWave() {
  const router = useRouter()
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey)
        return
      const a = e.target instanceof Element ? e.target.closest("a[href]") : null
      if (!(a instanceof HTMLAnchorElement) || a.hasAttribute("data-morph")) return
      if (a.target && a.target !== "_self") return
      if (a.hasAttribute("download")) return
      const to = new URL(a.href)
      if (to.origin !== location.origin || to.pathname === location.pathname) return
      if (!document.startViewTransition || matchMedia("(prefers-reduced-motion: reduce)").matches)
        return
      // the link's own handler (next/link) sees this and stands down
      e.preventDefault()
      const before = document.querySelector("main")
      const { clientX: x, clientY: y } = e
      const vt = document.startViewTransition(async () => {
        router.push(to.pathname + to.search + to.hash)
        const end = performance.now() + 2000
        await new Promise<void>((resolve) => {
          const tick = () => {
            const main = document.querySelector("main")
            const arrived = location.pathname === to.pathname && main !== null && main !== before
            if (arrived || performance.now() > end) resolve()
            else requestAnimationFrame(tick)
          }
          tick()
        })
      })
      vt.ready.then(
        () => wave(x, y, document.documentElement.dataset["phase"] === "juicy"),
        () => {},
      )
      vt.finished.catch(() => {})
    }
    // capture: before next/link's own click handler runs
    document.addEventListener("click", onClick, true)
    return () => document.removeEventListener("click", onClick, true)
  }, [router])
  return null
}
