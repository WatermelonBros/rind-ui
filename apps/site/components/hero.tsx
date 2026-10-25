"use client"

import Link from "next/link"
import { Fragment, type ReactNode } from "react"
import styles from "./hero.module.css"
import { SkinScene } from "./home/skin-scene"
import { Wordmark } from "./wordmark"

export function Hero({
  children,
  today = ["React"],
  frameworks = "",
  ready = 0,
}: {
  children?: ReactNode
  /** the frameworks released, from their packages (lib/frameworks.ts) */
  today?: readonly string[]
  /** where the other frameworks stand (lib/framework-status.ts: upcoming) */
  frameworks?: string
  /** the components ready today (the roadmap) */
  ready?: number
}) {
  return (
    <main>
      {/* the run is taller than the screen: the hero holds still while the skin comes off */}
      <div className={styles.run}>
        <div className={styles.hero}>
          <section className={styles.copy} aria-label="Introduction">
            <h1 className={styles.visuallyHidden}>rind</h1>
            <Wordmark />
            <p className={styles.lede}>
              Behaviour, accessibility and state. {/* the line follows the hero's peel */}
              <span className={styles.swap}>
                <em className={styles.look}>The look is yours.</em>
                <em className={styles.stays}>Everything else stays.</em>
              </span>
            </p>
            <div className={styles.ctas}>
              <Link prefetch={false} href="/docs/get-started/" className={styles.primary}>
                Get started →
              </Link>
              <Link prefetch={false} href="/docs/#components" className={styles.install}>
                Browse components
              </Link>
            </div>
            <p className={styles.frameworks}>
              {today.map((name, i) => (
                <Fragment key={name}>
                  {i === 0 ? "" : i === today.length - 1 ? " and " : ", "}
                  <b>{name}</b>
                </Fragment>
              ))}{" "}
              today{frameworks ? ` · ${frameworks}, on the same core` : ""}
            </p>
          </section>
          <SkinScene />
          {/* the hero's foot: what the library is, in numbers */}
          <ul className={styles.facts} aria-label="rind in numbers">
            <li>
              <b>{ready}</b> components ready
            </li>
            <li>
              <b>{today.length}</b> frameworks
            </li>
            <li>
              <b>0</b> styles shipped
            </li>
            <li>
              <b>1</b> test driver each
            </li>
          </ul>
        </div>
      </div>
      {children}
    </main>
  )
}
