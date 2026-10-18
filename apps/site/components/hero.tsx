"use client"

import { Accordion, Button, CheckboxGroup, Heading, ToggleGroup } from "@rind-ui/react"
import Link from "next/link"
import { type ReactNode, useState } from "react"
import styles from "./hero.module.css"
import { usePhase } from "./phase"
import { Wordmark } from "./wordmark"

/**
 * Floating specimens are real rind components wearing the site skin of the current phase,
 * the same CSS the docs examples use.
 */
function Specimens() {
  const { phase } = usePhase()
  const [pending, setPending] = useState(false)
  return (
    <Heading.Level level={2}>
      <div className={styles.stage} data-skinned="" data-skin={phase}>
        <div className={styles.card} style={{ left: "2%", top: "0%", rotate: "-3deg" }}>
          <span className={styles.tag}>button · data-pending</span>
          <p className={styles.title}>Delete component?</p>
          <p className={styles.body}>Pending keeps focus and announces itself.</p>
          <div className={styles.acts}>
            <Button
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
          className={styles.float}
          style={{ right: "0%", top: "30%", rotate: "3deg", animationDelay: "-2s" }}
        >
          <span className={styles.tag}>toggle · aria-pressed</span>
          <div className="row">
            <ToggleGroup.Item defaultPressed>Bold</ToggleGroup.Item>
            <ToggleGroup.Item>Italic</ToggleGroup.Item>
            <ToggleGroup.Item defaultPressed>Mono</ToggleGroup.Item>
          </div>
        </div>

        <div
          className={styles.card}
          style={{ right: "0%", top: "66%", rotate: "-2deg", animationDelay: "-3s" }}
        >
          <span className={styles.tag}>checkbox · data-state</span>
          <div className="stack">
            {(["Keyboard", "Screen readers", "Your design"] as const).map((label, i) => (
              <CheckboxGroup.Item key={label} defaultChecked={i < 2}>
                <CheckboxGroup.ItemControl>
                  <CheckboxGroup.ItemIndicator>✓</CheckboxGroup.ItemIndicator>
                </CheckboxGroup.ItemControl>
                <CheckboxGroup.ItemLabel>{label}</CheckboxGroup.ItemLabel>
              </CheckboxGroup.Item>
            ))}
          </div>
        </div>

        <div
          className={styles.float}
          style={{
            left: "0%",
            top: "36%",
            width: "300px",
            rotate: "1.5deg",
            animationDelay: "-4s",
          }}
        >
          <span className={styles.tag}>accordion · data-state</span>
          <Accordion.Root defaultValue={["keyboard"]}>
            {[
              ["keyboard", "Keyboard", "Tab, Enter, Space, and arrows if you want them."],
              ["readers", "Screen readers", "Regions, labels and announcements, tested."],
              ["design", "Your design", "Nothing. That part is yours."],
            ].map(([value = "", title, text]) => (
              <Accordion.Item key={value} value={value}>
                <Accordion.Header>
                  <Accordion.Trigger>
                    {title}
                    <Accordion.Indicator>+</Accordion.Indicator>
                  </Accordion.Trigger>
                </Accordion.Header>
                <Accordion.Content>
                  <div className="pad">{text}</div>
                </Accordion.Content>
              </Accordion.Item>
            ))}
          </Accordion.Root>
        </div>
      </div>
    </Heading.Level>
  )
}

export function Hero({ children }: { children?: ReactNode }) {
  return (
    <main>
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
        <Specimens />
      </div>
      {children}
    </main>
  )
}
