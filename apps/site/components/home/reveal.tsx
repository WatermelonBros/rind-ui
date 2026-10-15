"use client"

import { type ReactNode, useEffect, useRef } from "react"

/** Fades and lifts its content in the first time it scrolls into view (instant under reduced motion). */
export function Reveal({
  children,
  className,
}: {
  children: ReactNode
  className?: string | undefined
}) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          el.dataset["in"] = ""
          io.disconnect()
        }
      },
      { rootMargin: "0px 0px -12% 0px" },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])
  return (
    <div ref={ref} className={className} data-scroll-reveal="">
      {children}
    </div>
  )
}
