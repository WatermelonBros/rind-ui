"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import type { ReactNode } from "react"

/** Resolves once `done()` holds, or after `ms` (a deadline: the transition never hangs). */
function until(done: () => boolean, ms = 3000): Promise<void> {
  const end = performance.now() + ms
  return new Promise((resolve) => {
    const tick = () => (done() || performance.now() > end ? resolve() : requestAnimationFrame(tick))
    tick()
  })
}

/**
 * A link whose text becomes the next page's title: a view transition morphs it into the docs
 * page's <h1> (both carry `view-transition-name: page-title` during it). A plain navigation where
 * view transitions are missing, under reduced motion, or with a modifier key.
 */
export function MorphLink({
  href,
  children,
}: {
  readonly href: string
  readonly children: ReactNode
}) {
  const router = useRouter()
  return (
    <Link
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
        e.preventDefault()
        const el = e.currentTarget
        el.style.viewTransitionName = "page-title"
        document.startViewTransition(async () => {
          el.style.viewTransitionName = ""
          router.push(href)
          // the new page is in once its title is rendered
          await until(
            () =>
              location.pathname === new URL(href, location.href).pathname &&
              document.querySelector("[data-page-title]") !== null,
          )
        })
      }}
    >
      {children}
    </Link>
  )
}
