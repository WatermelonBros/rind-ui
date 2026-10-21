"use client"

import Link from "next/link"
import type { ReactNode } from "react"
import styles from "./hero.module.css"
import { SkinScene } from "./home/skin-scene"
import { Wordmark } from "./wordmark"

export function Hero({ children }: { children?: ReactNode }) {
  return (
    <main>
      {/* the run is taller than the screen: the hero holds still while the skin comes off */}
      <div className={styles.run}>
        <div className={styles.hero}>
          <section className={styles.copy} aria-label="Introduction">
            <h1 className={styles.visuallyHidden}>rind</h1>
            <Wordmark />
            <p className={styles.lede}>
              Behaviour, accessibility and state. <em>The look is yours.</em>
            </p>
            <div className={styles.ctas}>
              <Link href="/docs/get-started/" className={styles.primary}>
                Get started →
              </Link>
              <Link href="/docs/#components" className={styles.install}>
                Browse components
              </Link>
            </div>
            <p className={styles.frameworks}>
              <b>React</b> today · Vue, Svelte, Solid and Angular on the same core, soon
            </p>
          </section>
          <SkinScene />
        </div>
      </div>
      {children}
    </main>
  )
}
