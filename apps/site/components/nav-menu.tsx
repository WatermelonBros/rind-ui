"use client"

import { Drawer, SegmentedControl } from "@rind-ui/react"
import Link from "next/link"
import { useState } from "react"
import styles from "./nav.module.css"
import { usePhase } from "./phase"

const LINKS = [
  { href: "/docs/get-started/", label: "Docs" },
  { href: "/docs/#components", label: "Components" },
  { href: "/docs/testing-accessibility/", label: "Testing" },
] as const
const OUT = [
  { href: "https://github.com/WatermelonBros/rind-ui", label: "GitHub" },
  { href: "https://discord.gg/HHqT9ucXn4", label: "Discord" },
] as const

/**
 * The phone's way around (the bar has room only for the logo and the toggles): a rind Drawer
 * from the bottom edge, where the thumb is; a swipe down puts it away. A link closes it, and the
 * page wave (route-wave.tsx) takes the move from the press. The phase lives here too, both
 * sides named: the bar's switch had room for one label only. The drawer stays open on a pick,
 * so the wave is seen spreading from it.
 */
export function NavMenu() {
  const [open, setOpen] = useState(false)
  const { phase, setPhase } = usePhase()
  return (
    <Drawer.Root
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        // the landing's sound question does not hang over the open menu (sound-invite.tsx)
        if (next) window.dispatchEvent(new Event("rind:menu-open"))
      }}
    >
      <Drawer.Trigger className={styles.menuButton} aria-label="Menu">
        <span className={styles.burger} aria-hidden="true" />
      </Drawer.Trigger>
      <Drawer.Portal>
        <Drawer.Backdrop className={styles.menuBackdrop} />
        <Drawer.Positioner className={styles.menuPositioner}>
          <Drawer.Content className={styles.menu}>
            <Drawer.Handle className={styles.menuHandle} />
            <Drawer.Title className={styles.menuTitle}>Menu</Drawer.Title>
            <ul className={styles.menuLinks}>
              {LINKS.map((l) => (
                <li key={l.href}>
                  <Link prefetch={false} href={l.href} onClick={() => setOpen(false)}>
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
            <SegmentedControl.Root
              className={styles.menuPhase}
              aria-label="Look"
              value={phase}
              onValueChange={(v) => {
                if (v === "juicy" || v === "crisp") setPhase(v)
              }}
            >
              {(["juicy", "crisp"] as const).map((p) => (
                <SegmentedControl.Item key={p} className={styles.menuPhaseItem} value={p}>
                  {p}
                </SegmentedControl.Item>
              ))}
              <SegmentedControl.Indicator className={styles.menuPhaseIndicator} />
            </SegmentedControl.Root>
            <ul className={styles.menuOut}>
              {OUT.map((l) => (
                <li key={l.href}>
                  <a href={l.href}>{l.label} ↗</a>
                </li>
              ))}
            </ul>
          </Drawer.Content>
        </Drawer.Positioner>
      </Drawer.Portal>
    </Drawer.Root>
  )
}
