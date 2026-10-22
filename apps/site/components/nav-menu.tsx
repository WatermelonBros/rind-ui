"use client"

import { Drawer } from "@rind-ui/react"
import Link from "next/link"
import { useState } from "react"
import styles from "./nav.module.css"

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
 * page wave (route-wave.tsx) takes the move from the press.
 */
export function NavMenu() {
  const [open, setOpen] = useState(false)
  return (
    <Drawer.Root open={open} onOpenChange={setOpen}>
      <Drawer.Trigger className={styles.menuButton}>Menu</Drawer.Trigger>
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
