"use client"

import { Switch, Toggle } from "@rind-ui/react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useEffect, useRef, useState } from "react"
import styles from "./nav.module.css"
import { usePhase } from "./phase"
import { useSound } from "./sound"

export function Nav() {
  const { phase, setPhase } = usePhase()
  const sound = useSound()
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
      <Link href="/docs/get-started/">Docs</Link>
      <Link href="/docs/#components">Components</Link>
      <Link href="/docs/testing-accessibility/">Testing</Link>
      <a href="https://github.com/WatermelonBros/rind-ui">GitHub</a>
      <a href="https://discord.gg/HHqT9ucXn4">Discord</a>
      {/* Sound is a pressed/unpressed button, off until pressed: a rind Toggle (the landing's
          only: sound.tsx) */}
      {home && (
        <Toggle.Root
          className={styles.sound}
          data-sound-toggle=""
          aria-label="Sound"
          pressed={sound.enabled}
          onPressedChange={sound.setEnabled}
        >
          <Bars />
          <span className={styles.soundWord} aria-hidden="true">
            sound
          </span>
        </Toggle.Root>
      )}
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

/** The sound toggle's face: four bars that move with what is playing, a flat line when off. */
function Bars() {
  const { enabled, levels } = useSound()
  const bars = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    const el = bars.current
    if (!el) return
    let frame = 0
    const draw = () => {
      const now = levels(4)
      el.querySelectorAll("i").forEach((bar, k) => {
        bar.style.setProperty("--level", String(now[k] ?? 0))
      })
      frame = requestAnimationFrame(draw)
    }
    if (enabled) draw()
    else for (const bar of el.querySelectorAll("i")) bar.style.removeProperty("--level")
    return () => cancelAnimationFrame(frame)
  }, [enabled, levels])
  return (
    <span ref={bars} className={styles.bars} aria-hidden="true">
      <i />
      <i />
      <i />
      <i />
    </span>
  )
}
