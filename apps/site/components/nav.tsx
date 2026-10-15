"use client"

import { Toggle } from "@rind-ui/react"
import Link from "next/link"
import styles from "./nav.module.css"
import { usePhase } from "./phase"

export function Nav() {
  const { phase, setPhase } = usePhase()
  return (
    <nav className={styles.nav} aria-label="Main">
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
        <span className={styles.label}>Juicy</span>
        <span className={styles.track} aria-hidden="true">
          <span className={styles.thumb} />
        </span>
      </Toggle.Root>
    </nav>
  )
}
