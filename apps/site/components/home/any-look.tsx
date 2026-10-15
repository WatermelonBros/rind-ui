"use client"

import { Accordion, Button, Checkbox, Switch, TextField, Toggle } from "@rind-ui/react"
import { type CSSProperties, useState } from "react"
import { usePhase } from "../phase"
import styles from "./home.module.css"
import { Reveal } from "./reveal"

type Skin = "crisp" | "juicy" | "bare"

/** One set of real components; the reader swaps the skin and tunes it live. */
export function AnyLook() {
  const { phase } = usePhase()
  const [picked, setPicked] = useState<Skin | null>(null)
  const skin = picked ?? phase
  const [accent, setAccent] = useState<string | null>(null)
  const [radius, setRadius] = useState<number | null>(null)
  const vars = {
    ...(accent ? { "--s-acc": accent, "--s-acc-deep": accent } : {}),
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
          <div className={styles.segment}>
            {(["crisp", "juicy", "bare"] as const).map((s) => (
              <Toggle.Root
                key={s}
                className={styles.segmentItem}
                pressed={skin === s}
                onPressedChange={() => setPicked(s)}
              >
                {s}
                <span className={styles.visuallyHidden}> skin</span>
              </Toggle.Root>
            ))}
          </div>
          <label className={styles.tune}>
            Accent
            <input
              type="color"
              value={
                accent ?? (skin === "juicy" ? "#ff8fb1" : skin === "bare" ? "#2563eb" : "#ff3d8b")
              }
              onChange={(e) => setAccent(e.currentTarget.value)}
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
              setAccent(null)
              setRadius(null)
            }}
          >
            Reset
          </Button>
        </div>
        <div className={styles.lookStage} data-view={skin} data-skin={skin} style={vars}>
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
