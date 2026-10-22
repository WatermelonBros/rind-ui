"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import type { ComponentProps, ReactNode } from "react"

/** Resolves once `done()` holds, or after `ms` (a deadline: the transition never hangs). */
function until(done: () => boolean, ms = 3000): Promise<void> {
  const end = performance.now() + ms
  return new Promise((resolve) => {
    const tick = () => (done() || performance.now() > end ? resolve() : requestAnimationFrame(tick))
    tick()
  })
}

/**
 * A link whose text becomes the next page's title: it morphs into the docs page's <h1> (both carry `view-transition-name:
 * page-title` during it); `data-morph` keeps the site-wide wave (route-wave.tsx) off it. A
 * plain navigation where view transitions are missing, under reduced motion, with a modifier
 * key, or to a place on the same page.
 */
export function MorphLink({
  href,
  children,
  ...rest
}: Omit<ComponentProps<typeof Link>, "href" | "onClick" | "prefetch"> & {
  readonly href: string
  readonly children: ReactNode
}) {
  const router = useRouter()
  return (
    <Link
      {...rest}
      prefetch={false}
      data-morph=""
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
        el.style.viewTransitionName = "page-title"
        const vt = document.startViewTransition(async () => {
          el.style.viewTransitionName = ""
          router.push(href)
          // the new page is in once it is routed and its title is rendered
          // within the browser's own deadline for the update (a page slow to arrive just
          // cuts in without the transition, never an error)
          await until(
            () =>
              location.pathname === to.pathname &&
              document.querySelector("[data-page-title]") !== null,
            2000,
          )
        })
        vt.ready.catch(() => {})
        vt.finished.catch(() => {})
      }}
    >
      {children}
    </Link>
  )
}
