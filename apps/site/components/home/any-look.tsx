"use client"

import {
  Accordion,
  Button,
  Checkbox,
  SegmentedControl,
  Switch,
  TextField,
  Toggle,
} from "@rind-ui/react"
import { type CSSProperties, useState } from "react"
import { usePhase } from "../phase"
import styles from "./home.module.css"
import { Reveal } from "./reveal"

type Skin = "crisp" | "juicy" | "bare"

const DEFAULT_BRAND: Record<Skin, string> = { crisp: "#0b0b0c", juicy: "#ff8fb1", bare: "#18181b" }

/** Ink or white, whichever reads better on `hex` (WCAG relative luminance). */
function textOn(hex: string): string {
  const [r = 0, g = 0, b = 0] = [1, 3, 5].map((i) => {
    const c = Number.parseInt(hex.slice(i, i + 2), 16) / 255
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  const l = 0.2126 * r + 0.7152 * g + 0.0722 * b
  // contrast against white vs against near-black ink; pick the larger
  return 1.05 / (l + 0.05) >= (l + 0.05) / 0.055 ? "#ffffff" : "#0b0b0c"
}

/** One set of real components; the reader swaps the skin and tunes it live. */
export function AnyLook() {
  const { phase } = usePhase()
  const [picked, setPicked] = useState<Skin | null>(null)
  const skin = picked ?? phase
  // the brand colour fills buttons, pressed toggles and checked controls; text follows contrast
  const [brand, setBrand] = useState<string | null>(null)
  const [radius, setRadius] = useState<number | null>(null)
  const vars = {
    ...(brand
      ? {
          "--s-brand": brand,
          "--s-brand-text": textOn(brand),
          "--s-brand-deep": `color-mix(in oklab, ${brand} 70%, #000)`,
        }
      : {}),
    ...(radius !== null
      ? { "--s-r": `${radius}px`, "--s-r-sm": `${Math.round(radius * 0.6)}px` }
      : {}),
  } as CSSProperties

  return (
    <section className={styles.section} aria-labelledby="look-title">
      <Reveal>
        <p className={styles.kicker}>The look is yours</p>
        <h2 id="look-title" className={styles.h2}>
          Same components. Any skin.
        </h2>
        <p className={styles.lead}>
          These are live rind components. Only the CSS changes: it targets their <code>data-*</code>{" "}
          attributes, so a skin is a stylesheet, never a fork.
        </p>
      </Reveal>
      <Reveal className={styles.lookPanel}>
        <div className={styles.lookControls}>
          <SegmentedControl.Root
            className={styles.segment}
            aria-label="Skin"
            value={skin}
            onValueChange={(v) => {
              if (v === "crisp" || v === "juicy" || v === "bare") setPicked(v)
            }}
          >
            {(["crisp", "juicy", "bare"] as const).map((s) => (
              <SegmentedControl.Item key={s} className={styles.segmentItem} value={s}>
                {s}
              </SegmentedControl.Item>
            ))}
            <SegmentedControl.Indicator className={styles.segmentIndicator} />
          </SegmentedControl.Root>
          <label className={styles.tune}>
            Brand
            <input
              type="color"
              value={brand ?? DEFAULT_BRAND[skin]}
              onChange={(e) => setBrand(e.currentTarget.value)}
            />
          </label>
          <label className={styles.tune}>
            Radius
            <input
              type="range"
              min={0}
              max={28}
              value={radius ?? (skin === "juicy" ? 22 : skin === "bare" ? 8 : 14)}
              onChange={(e) => setRadius(Number(e.currentTarget.value))}
            />
          </label>
          <Button
            className={styles.reset}
            onPress={() => {
              setBrand(null)
              setRadius(null)
            }}
          >
            Reset
          </Button>
        </div>
        <div
          className={styles.lookStage}
          data-view={skin}
          data-skinned=""
          data-skin={skin}
          style={vars}
        >
          <div className={styles.lookGrid}>
            <div className="stack">
              <TextField.Root name="handle">
                <TextField.Label>Handle</TextField.Label>
                <TextField.Input placeholder="@you" />
              </TextField.Root>
              <Switch.Root defaultChecked>
                <Switch.Control>
                  <Switch.Thumb />
                </Switch.Control>
                <Switch.Label>Notifications</Switch.Label>
              </Switch.Root>
              <Checkbox.Root defaultChecked>
                <Checkbox.Control>
                  <Checkbox.Indicator>✓</Checkbox.Indicator>
                </Checkbox.Control>
                <Checkbox.Label>Keyboard support</Checkbox.Label>
              </Checkbox.Root>
              <div className="row">
                <Button>Save</Button>
                <Toggle.Root defaultPressed>Bold</Toggle.Root>
              </div>
            </div>
            <Accordion.Root defaultValue={["what"]}>
              {[
                ["what", "What do I get?", "Behaviour, keyboard, ARIA, state and a test driver."],
                ["css", "And the CSS?", "Yours. Write it on data-scope, data-part and data-state."],
                ["theme", "No time for CSS?", "@rind-ui/theme is an optional starting point."],
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
      </Reveal>
    </section>
  )
}
