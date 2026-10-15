"use client"

import { Accordion, Button, Toggle } from "@rind-ui/react"
import Link from "next/link"
import { useState } from "react"
import styles from "./hero.module.css"
import { Wordmark } from "./wordmark"

const INSTALL = "pnpm add @rind-ui/react"

/** Floating specimens are real rind components, skinned here through their data-* attributes. */
function Specimens() {
  const [pending, setPending] = useState(false)
  return (
    <div className={styles.stage}>
      <div className={styles.card} style={{ left: "4%", top: "2%", rotate: "-3deg" }}>
        <span className={styles.tag}>button · data-pending</span>
        <p className={styles.title}>Delete component?</p>
        <p className={styles.body}>Pending keeps focus and announces itself. You style the rest.</p>
        <div className={styles.acts}>
          <Button className={styles.btn}>Cancel</Button>
          <Button
            className={styles.btn}
            data-primary=""
            pending={pending}
            onPress={() => {
              setPending(true)
              setTimeout(() => setPending(false), 1600)
            }}
          >
            {pending ? "Deleting…" : "Delete"}
          </Button>
        </div>
      </div>

      <div
        className={styles.card}
        style={{ right: "0%", top: "34%", rotate: "4deg", animationDelay: "-2s" }}
      >
        <span className={styles.tag}>toggle · aria-pressed</span>
        <Toggle.Root className={styles.toggle} defaultPressed>
          <span className={styles.track} aria-hidden="true">
            <span className={styles.thumb} />
          </span>
          Notifications
        </Toggle.Root>
      </div>

      <div
        className={styles.card}
        style={{ left: "10%", top: "56%", rotate: "2deg", animationDelay: "-4s" }}
      >
        <span className={styles.tag}>accordion · data-state</span>
        <Accordion.Root className={styles.acc} defaultValue={["keyboard"]}>
          {[
            ["keyboard", "Keyboard", "Tab, Enter, Space, and arrows if you want them."],
            ["readers", "Screen readers", "Regions, labels and announcements, tested."],
            ["design", "Your design", "Nothing. That part is yours."],
          ].map(([value, title, text]) => (
            <Accordion.Item key={value} value={value ?? ""}>
              <Accordion.Header>
                <Accordion.Trigger>
                  {title}
                  <Accordion.Indicator>+</Accordion.Indicator>
                </Accordion.Trigger>
              </Accordion.Header>
              <Accordion.Content>
                <p>{text}</p>
              </Accordion.Content>
            </Accordion.Item>
          ))}
        </Accordion.Root>
      </div>
    </div>
  )
}

export function Hero() {
  const [copied, setCopied] = useState(false)
  return (
    <main className={styles.hero}>
      <section className={styles.copy}>
        <span className={styles.eyebrow}>
          <b aria-hidden="true" />
          v0.1 · headless · React · built to be tested
        </span>
        <h1 className={styles.visuallyHidden}>rind</h1>
        <Wordmark />
        <p className={styles.lede}>
          Behaviour, accessibility and state. <em>The look is yours.</em>
        </p>
        <div className={styles.ctas}>
          <Link href="/docs/" className={styles.primary}>
            Get started →
          </Link>
          <Button
            className={styles.install}
            onPress={() => {
              navigator.clipboard?.writeText(INSTALL).then(() => {
                setCopied(true)
                setTimeout(() => setCopied(false), 1400)
              })
            }}
          >
            {INSTALL}
            <span aria-hidden="true">{copied ? "✓" : "⧉"}</span>
          </Button>
          <span role="status" className={styles.visuallyHidden}>
            {copied ? "Copied" : ""}
          </span>
        </div>
      </section>
      <Specimens />
    </main>
  )
}
