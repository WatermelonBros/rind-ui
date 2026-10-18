"use client"

import { Switch } from "@rind-ui/react"
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
      <a href="https://discord.gg/HHqT9ucXn4">Discord</a>
      {/* The site's phase is an on/off setting that applies at once: a rind Switch. */}
      <Switch.Root
        className={styles.phase}
        checked={phase === "juicy"}
        onCheckedChange={(on) => setPhase(on ? "juicy" : "crisp")}
      >
        <span
          className={styles.side}
          aria-hidden="true"
          data-on={phase === "crisp" ? "" : undefined}
        >
          crisp
        </span>
        <Switch.Control className={styles.track}>
          <Switch.Thumb className={styles.thumb} />
        </Switch.Control>
        <Switch.Label className={styles.side} data-on={phase === "juicy" ? "" : undefined}>
          juicy<span className={styles.visuallyHidden}> mode</span>
        </Switch.Label>
      </Switch.Root>
    </nav>
  )
}
