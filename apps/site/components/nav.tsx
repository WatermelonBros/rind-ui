"use client"

import { Switch, Toggle } from "@rind-ui/react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useEffect, useState } from "react"
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
      {/* Sound is a pressed/unpressed button, off until pressed: a rind Toggle. */}
      <Toggle.Root
        className={styles.sound}
        data-sound-toggle=""
        aria-label="Sound"
        pressed={sound.enabled}
        onPressedChange={sound.setEnabled}
      >
        {/* the indicator is a span: it holds a whole icon, on or muted */}
        <Toggle.Indicator className={styles.soundIcon} fallback={<Speaker muted />}>
          <Speaker />
        </Toggle.Indicator>
      </Toggle.Root>
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

function Speaker({ muted = false }: { muted?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
      <path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor" />
      <path
        d={muted ? "m16 9 5 6m0-6-5 6" : "M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12"}
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  )
}
