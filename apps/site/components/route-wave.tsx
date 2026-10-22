"use client"

import { useRouter } from "next/navigation"
import { useEffect } from "react"
import { wave } from "./wave"

/**
 * Every move between the site's pages opens the next one with the phase's wave, from where the
 * link was pressed (wave.ts). One listener for every link, so no link has to opt in. A link's
 * page is fetched as the pointer reaches it (or on touch), so the move itself is quick; the
 * transition waits for the next page to commit (its URL), within the browser's deadline. Links that morph their text into the next title (morph-link.tsx,
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
      const { clientX: x, clientY: y } = e
      // the next page's title rides with its page under the wave, not on a layer of its own
      // above the page being left (globals.css: html[data-wave])
      const root = document.documentElement
      root.setAttribute("data-wave", "")
      const vt = document.startViewTransition(async () => {
        router.push(to.pathname + to.search + to.hash)
        const end = performance.now() + 2000
        await new Promise<void>((resolve) => {
          const tick = () => {
            // the URL changes as the next page commits
            const arrived = location.pathname === to.pathname
            // a timer, not a frame: the browser holds rendering (and frames) during the update
            if (arrived || performance.now() > end) resolve()
            else setTimeout(tick, 16)
          }
          tick()
        })
      })
      vt.ready.then(
        () => wave(x, y, document.documentElement.dataset["phase"] === "juicy", { dim: true }),
        () => {},
      )
      vt.finished.catch(() => {}).finally(() => root.removeAttribute("data-wave"))
    }
    // intent: the page behind a link is fetched when the pointer reaches it, not for every link
    // in view (the site's links all set prefetch={false}: in view, the landing fetched the docs'
    // code and a docs page's sidebar 1.3 MB of other pages)
    const fetched = new Set<string>()
    const onIntent = (e: Event) => {
      const a = e.target instanceof Element ? e.target.closest("a[href]") : null
      if (!(a instanceof HTMLAnchorElement)) return
      const to = new URL(a.href)
      if (to.origin !== location.origin || fetched.has(to.pathname)) return
      fetched.add(to.pathname)
      router.prefetch(to.pathname)
    }
    // capture: before next/link's own click handler runs
    document.addEventListener("click", onClick, true)
    document.addEventListener("pointerover", onIntent, { passive: true })
    document.addEventListener("touchstart", onIntent, { passive: true })
    document.addEventListener("focusin", onIntent)
    return () => {
      document.removeEventListener("click", onClick, true)
      document.removeEventListener("pointerover", onIntent)
      document.removeEventListener("touchstart", onIntent)
      document.removeEventListener("focusin", onIntent)
    }
  }, [router])
  return null
}
