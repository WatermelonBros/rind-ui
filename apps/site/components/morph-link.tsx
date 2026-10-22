"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import type { ComponentProps, ReactNode } from "react"
import { wave } from "./wave"

/** Resolves once `done()` holds, or after `ms` (a deadline: the transition never hangs). */
function until(done: () => boolean, ms = 3000): Promise<void> {
  const end = performance.now() + ms
  return new Promise((resolve) => {
    const tick = () => (done() || performance.now() > end ? resolve() : requestAnimationFrame(tick))
    tick()
  })
}

/**
 * A link that moves between pages with a view transition. By default its text becomes the next
 * page's title: it morphs into the docs page's <h1> (both carry `view-transition-name:
 * page-title` during it). With `wave`, the next page spreads from where it was clicked instead,
 * the way a change of phase does (wave.ts). A plain navigation where view transitions are
 * missing, under reduced motion, with a modifier key, or to a place on the same page.
 */
export function MorphLink({
  href,
  children,
  wave: spread = false,
  ...rest
}: Omit<ComponentProps<typeof Link>, "href" | "onClick" | "prefetch"> & {
  readonly href: string
  readonly children: ReactNode
  readonly wave?: boolean
}) {
  const router = useRouter()
  return (
    <Link
      {...rest}
      prefetch={false}
      href={href}
      onClick={(e) => {
        if (
          e.defaultPrevented ||
          e.button !== 0 ||
          e.metaKey ||
          e.ctrlKey ||
          e.shiftKey ||
          e.altKey
        )
          return
        if (!document.startViewTransition || matchMedia("(prefers-reduced-motion: reduce)").matches)
          return
        const to = new URL(href, location.href)
        if (to.pathname === location.pathname) return
        e.preventDefault()
        const el = e.currentTarget
        if (!spread) el.style.viewTransitionName = "page-title"
        const { clientX: x, clientY: y } = e
        const vt = document.startViewTransition(async () => {
          el.style.viewTransitionName = ""
          router.push(href)
          // the new page is in once it is routed (and, for a morph, once its title is rendered)
          // within the browser's own deadline for the update (a page slow to arrive just
          // cuts in without the transition, never an error)
          await until(
            () =>
              location.pathname === to.pathname &&
              (spread || document.querySelector("[data-page-title]") !== null),
            2000,
          )
        })
        vt.ready.then(
          () => spread && wave(x, y, document.documentElement.dataset["phase"] === "juicy"),
          () => {},
        )
        vt.finished.catch(() => {})
      }}
    >
      {children}
    </Link>
  )
}
