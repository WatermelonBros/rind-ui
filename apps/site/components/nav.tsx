"use client"

import { Toggle } from "@rind-ui/react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useEffect, useState } from "react"
import styles from "./nav.module.css"
import { usePhase } from "./phase"

export function Nav() {
  const { phase, setPhase } = usePhase()
  const home = usePathname() === "/"
  // On the landing the bar floats over the hero and only gets a surface once the page scrolls.
  const [scrolled, setScrolled] = useState(false)
  useEffect(() => {
    if (!home) return
    const onScroll = () => setScrolled(window.scrollY > 24)
    onScroll()
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [home])
  return (
    <nav
      className={styles.nav}
      aria-label="Main"
      data-floating={home && !scrolled ? "" : undefined}
    >
      <Link href="/" className={styles.mini} aria-label="rind home">
        r<span>i</span>nd
      </Link>
      <Link href="/docs/">Docs</Link>
      <Link href="/docs/#components">Components</Link>
      <Link href="/docs/testing-accessibility/">Testing</Link>
      <a href="https://github.com/WatermelonBros/rind-ui">GitHub</a>
      {/* The site's own phase switch is a rind Toggle: same name in both states, aria-pressed carries it. */}
      <Toggle.Root
        className={styles.phase}
        pressed={phase === "juicy"}
        onPressedChange={(pressed) => setPhase(pressed ? "juicy" : "crisp")}
      >
        <span
          className={styles.side}
          aria-hidden="true"
          data-on={phase === "crisp" ? "" : undefined}
        >
          crisp
        </span>
        <span className={styles.track} aria-hidden="true">
          <span className={styles.thumb} />
        </span>
        <span className={styles.side} data-on={phase === "juicy" ? "" : undefined}>
          juicy<span className={styles.visuallyHidden}> mode</span>
        </span>
      </Toggle.Root>
    </nav>
  )
}
