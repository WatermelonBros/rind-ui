"use client"

import { Marquee as RindMarquee } from "@rind-ui/react"
import styles from "./marquee.module.css"

/**
 * The component names scroll by, on rind-ui's own Marquee: copies, pause on hover, reduced
 * motion and a pause button (WCAG 2.2.2). The band is decorative (the names are in the nav),
 * so the Viewport is hidden from assistive technology; the button is not.
 */
export function Marquee({ items }: { items: readonly string[] }) {
  return (
    <RindMarquee.Root className={styles.marquee} speed={40} autoFill>
      <RindMarquee.Viewport className={styles.viewport} aria-hidden="true">
        <RindMarquee.Content className={styles.track}>
          {items.map((name) => (
            <span key={name}>{name}</span>
          ))}
        </RindMarquee.Content>
      </RindMarquee.Viewport>
      <RindMarquee.PauseTrigger className={styles.pause}>
        <span className={styles.glyph} aria-hidden="true" />
      </RindMarquee.PauseTrigger>
    </RindMarquee.Root>
  )
}
