"use client"

import { Accordion, Button, CheckboxGroup, Switch } from "@rind-ui/react"
import { useEffect, useRef, useState } from "react"
import { usePhase } from "../phase"
import {
  type HeroKind,
  heroKind,
  onTestArrived,
  setTestState,
  setTestTarget,
  useSceneGl,
  useTestLanded,
} from "./hero-state"
import styles from "./home.module.css"
import { Reveal } from "./reveal"

type Step = {
  readonly code: string
  /** what the line does to the live component, if anything */
  readonly act?: (root: HTMLElement) => void
  /** an assertion: checked against the live DOM when the line runs, never assumed */
  readonly check?: (root: HTMLElement) => boolean
}

const click = (root: HTMLElement, selector: string, text: string) => {
  for (const el of root.querySelectorAll<HTMLElement>(selector)) {
    if (el.textContent?.includes(text)) {
      el.click()
      return
    }
  }
}

/** The names of the open accordion items, read the way the driver reads them: from ARIA. */
const expanded = (root: HTMLElement) =>
  [...root.querySelectorAll('[data-scope="accordion"][data-part="trigger"]')]
    .filter((t) => t.getAttribute("aria-expanded") === "true")
    .map((t) => t.textContent?.replace("+", "").trim())

const FAQ: readonly Step[] = [
  { code: 'const faq = getAccordion(screen, { item: "Returns" })' },
  {
    code: 'await faq.expand("Returns")',
    act: (r) => click(r, '[data-scope="accordion"][data-part="trigger"]', "Returns"),
  },
  {
    code: 'expect(await faq.expanded()).toEqual(["Returns"])',
    check: (r) => JSON.stringify(expanded(r)) === JSON.stringify(["Returns"]),
  },
]

// the second half drives the visit's own component, the one the hero showed (hero-state.ts)
const CONTROL: Record<HeroKind, readonly Step[]> = {
  switch: [
    { code: 'const wifi = getSwitch(screen, { name: "Wi-Fi" })' },
    {
      code: "await wifi.toggle()",
      // the control itself, as the driver does: a label's click focuses the control and scrolls
      // it into view, which would pull back a visitor who has scrolled past the run
      act: (r) =>
        r.querySelector<HTMLElement>('[data-scope="switch"][data-part="control"]')?.click(),
    },
    {
      code: "expect(await wifi.isChecked()).toBe(true)",
      check: (r) => r.querySelector('[role="switch"]')?.getAttribute("aria-checked") === "true",
    },
  ],
  checkbox: [
    { code: 'const ready = getCheckbox(screen, { name: "Keyboard ready" })' },
    {
      code: "await ready.toggle()",
      act: (r) =>
        r.querySelector<HTMLElement>('[data-scope="checkbox"][data-part="control"]')?.click(),
    },
    {
      code: "expect(await ready.isChecked()).toBe(true)",
      check: (r) => r.querySelector('[role="checkbox"]')?.getAttribute("aria-checked") === "true",
    },
  ],
  button: [
    { code: 'const save = getButton(screen, { name: "Save" })' },
    {
      code: "await save.press()",
      act: (r) => click(r, 'button[data-scope="button"]', "Save"),
    },
    {
      // a press has no state of its own: the test asserts the handler, as the driver docs say
      code: "expect(onPress).toHaveBeenCalledOnce()",
      check: (r) => r.querySelector("[data-presses]")?.getAttribute("data-presses") === "1",
    },
  ],
}

/** A driver test plays itself against the live components next to it. */
export function Tested() {
  const { phase } = usePhase()
  const [kind, setKind] = useState<HeroKind>("switch")
  useEffect(() => setKind(heroKind()), [])
  const STEPS = [...FAQ, ...CONTROL[kind]]
  const CHECKS = STEPS.filter((s) => s.check).length
  const [presses, setPresses] = useState(0)
  const stage = useRef<HTMLDivElement>(null)
  const [line, setLine] = useState(-1)
  const [running, setRunning] = useState(false)
  const [run, setRun] = useState(0)
  const [passed, setPassed] = useState<number | null>(null)
  // line index → the assertion's real outcome, filled in as the lines run
  const [results, setResults] = useState<Record<number, boolean>>({})
  const failed = Object.values(results).filter((ok) => !ok).length

  // The hero's object ends its trip here (skin-scene.tsx): hand it this test's control and its
  // state, hide the control while the object stands on it, and run the test once it arrives
  const landed = useTestLanded()
  const gl = useSceneGl()
  // biome-ignore lint/correctness/useExhaustiveDependencies: a new run remounts the stage, a new kind changes the control
  useEffect(() => {
    const root = stage.current
    const el = root?.querySelector<HTMLElement>(
      '[data-scope="switch"][data-part="control"], [data-scope="checkbox"][data-part="control"], button[data-scope="button"]',
    )
    setTestTarget(el ?? null)
    if (!root) return
    const read = () => {
      const on =
        root.querySelector('[role="switch"], [role="checkbox"]')?.getAttribute("aria-checked") ===
        "true"
      const presses = Number(
        root.querySelector("[data-presses]")?.getAttribute("data-presses") ?? 0,
      )
      setTestState(on, presses)
    }
    read()
    const mo = new MutationObserver(read)
    mo.observe(root, {
      subtree: true,
      attributes: true,
      attributeFilter: ["aria-checked", "data-presses"],
    })
    // the run opens an accordion item, which moves the control: hand it over again
    const ro = new ResizeObserver(() => setTestTarget(el ?? null))
    ro.observe(root)
    return () => {
      ro.disconnect()
      mo.disconnect()
      setTestTarget(null)
    }
  }, [kind, run])
  const playRef = useRef<() => void>(() => {})
  const autoRan = useRef(false)
  useEffect(() => {
    const go = () => {
      if (autoRan.current) return
      autoRan.current = true
      playRef.current()
    }
    const off = onTestArrived(go)
    // a phone runs as soon as the control itself is in view: waiting for it to reach the
    // object's landing height let the visitor scroll past the PASS
    const root = stage.current?.querySelector<HTMLElement>(
      '[data-scope="switch"][data-part="control"], [data-scope="checkbox"][data-part="control"], button[data-scope="button"]',
    )
    if (!root || !window.matchMedia("(max-width: 900px)").matches) return off
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) go()
      },
      { threshold: 0.9 },
    )
    io.observe(root)
    return () => {
      off()
      io.disconnect()
    }
  }, [])

  const play = async () => {
    setRunning(true)
    setPassed(null)
    setResults({})
    setRun((n) => n + 1)
    setPresses(0)
    setLine(-1)
    const started = performance.now()
    await new Promise((r) => setTimeout(r, 200))
    for (let i = 0; i < STEPS.length; i++) {
      setLine(i)
      const root = stage.current
      const step = STEPS[i]
      if (root) step?.act?.(root)
      await new Promise((r) => setTimeout(r, 420))
      // read after the component has settled, like an awaited driver query
      const check = step?.check
      if (check && stage.current) {
        const ok = check(stage.current)
        setResults((all) => ({ ...all, [i]: ok }))
      }
    }
    setLine(STEPS.length)
    setPassed(Math.round(performance.now() - started))
    setRunning(false)
  }
  playRef.current = () => {
    if (!running) void play()
  }

  return (
    <div className={styles.band} data-band="ink">
      <section className={styles.section} aria-labelledby="tested-title">
        <Reveal>
          <h2 id="tested-title" className={styles.h2}>
            The tests come in the box.
          </h2>
          <p className={styles.lead}>
            Every component ships a driver: what a user does and asks. One test runs in Testing
            Library and in Playwright, and never reaches into your markup.
          </p>
        </Reveal>
        <Reveal className={styles.testPanel}>
          <div className={styles.testCode}>
            <div className={styles.testBar}>
              <span>{kind}.test.ts</span>
              <Button className={styles.run} pending={running} onPress={play}>
                {running ? "Running…" : "▶ Run"}
              </Button>
            </div>
            <ol>
              {STEPS.map((s, i) => (
                <li
                  key={s.code}
                  data-state={i < line ? "done" : i === line ? "current" : undefined}
                  className={passed !== null && failed === 0 ? styles.pass : undefined}
                  style={passed !== null ? { animationDelay: `${i * 0.05}s` } : undefined}
                >
                  <code>{s.code}</code>
                  {i in results ? (
                    <span className={styles.verdict} data-ok={results[i] ? "" : undefined}>
                      {results[i] ? "✓" : "✗"}
                    </span>
                  ) : null}
                </li>
              ))}
            </ol>
          </div>
          <p
            className={styles.passBanner}
            role="status"
            data-show={passed !== null ? "" : undefined}
          >
            {passed !== null && (
              <>
                <b>{failed ? "✗ FAIL" : "✓ PASS"}</b> {kind}.test.ts · {CHECKS - failed}/{CHECKS}{" "}
                assertions · {(passed / 1000).toFixed(1)}s
                {failed ? null : (
                  <span className={styles.confetti} aria-hidden="true">
                    {Array.from({ length: 14 }, (_, i) => (
                      // biome-ignore lint/suspicious/noArrayIndexKey: fixed decorative set
                      <i key={i} style={{ "--i": i } as React.CSSProperties} />
                    ))}
                  </span>
                )}
              </>
            )}
          </p>
          <div
            className={styles.testStage}
            data-skinned=""
            data-skin={phase}
            data-gl={gl ? "" : undefined}
            data-object={landed ? "" : undefined}
            ref={stage}
            key={run}
          >
            <div className={styles.testStageInner}>
              <Accordion.Root>
                {["Shipping", "Returns"].map((t) => (
                  <Accordion.Item key={t} value={t.toLowerCase()}>
                    <Accordion.Header>
                      <Accordion.Trigger>
                        {t}
                        <Accordion.Indicator>+</Accordion.Indicator>
                      </Accordion.Trigger>
                    </Accordion.Header>
                    <Accordion.Content>
                      <div className="pad">
                        {t === "Shipping" ? "Two days, tracked." : "Thirty days, free pickup."}
                      </div>
                    </Accordion.Content>
                  </Accordion.Item>
                ))}
              </Accordion.Root>
              {kind === "switch" ? (
                <Switch.Root>
                  <Switch.Control>
                    <Switch.Thumb />
                  </Switch.Control>
                  <Switch.Label>Wi-Fi</Switch.Label>
                </Switch.Root>
              ) : kind === "checkbox" ? (
                <CheckboxGroup.Item>
                  <CheckboxGroup.ItemControl>
                    <CheckboxGroup.ItemIndicator>✓</CheckboxGroup.ItemIndicator>
                  </CheckboxGroup.ItemControl>
                  <CheckboxGroup.ItemLabel>Keyboard ready</CheckboxGroup.ItemLabel>
                </CheckboxGroup.Item>
              ) : (
                <div data-presses={presses}>
                  <Button onPress={() => setPresses((n) => n + 1)}>Save</Button>
                </div>
              )}
            </div>
          </div>
        </Reveal>
      </section>
    </div>
  )
}
