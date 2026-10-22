"use client"

import { type ReactNode, useState } from "react"
import { flushSync } from "react-dom"
import { wave } from "./wave"

/**
 * The 404 page says it is headless, and starts that way: the browser's own look, nothing of
 * the site's (globals.css: body:has([data-headless])). A button gives it its skin, spreading
 * from the press like a change of phase, and takes it off again.
 */
export function HeadlessPage({
  className,
  children,
}: {
  className?: string | undefined
  children: ReactNode
}) {
  const [bare, setBare] = useState(true)
  return (
    <main className={className} data-headless={bare ? "" : undefined}>
      {children}
      <button
        type="button"
        data-skin-button=""
        onClick={(e) => {
          const next = !bare
          const doc = document as Document & {
            startViewTransition?: (update: () => void) => { ready: Promise<void> }
          }
          if (!doc.startViewTransition || matchMedia("(prefers-reduced-motion: reduce)").matches)
            return setBare(next)
          const { clientX: x, clientY: y } = e
          doc
            .startViewTransition(() => flushSync(() => setBare(next)))
            .ready.then(() => wave(x, y, document.documentElement.dataset["phase"] === "juicy"))
        }}
      >
        {bare ? "Give this page a skin" : "Take the skin off"}
      </button>
    </main>
  )
}
