"use client"

import { Accordion, Button, Switch } from "@rind-ui/react"
import { useRef, useState } from "react"
import { usePhase } from "../phase"
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

const STEPS: readonly Step[] = [
  { code: 'const faq = getAccordion(screen, { item: "Returns" })' },
  {
    code: 'await faq.expand("Returns")',
    act: (r) => click(r, '[data-scope="accordion"][data-part="trigger"]', "Returns"),
  },
  {
    code: 'expect(await faq.expanded()).toEqual(["Returns"])',
    check: (r) => JSON.stringify(expanded(r)) === JSON.stringify(["Returns"]),
  },
  { code: 'const wifi = getSwitch(screen, { name: "Wi-Fi" })' },
  {
    code: "await wifi.toggle()",
    act: (r) => click(r, '[data-scope="switch"][data-part="label"]', "Wi-Fi"),
  },
  {
    code: "expect(await wifi.isChecked()).toBe(true)",
    check: (r) =>
      r.querySelector('[role="switch"]')?.getAttribute("aria-checked") === "true" ||
      r.querySelector<HTMLInputElement>('[data-scope="switch"] input')?.checked === true,
  },
]
const CHECKS = STEPS.filter((s) => s.check).length

/** A driver test plays itself against the live components next to it. */
export function Tested() {
  const { phase } = usePhase()
  const stage = useRef<HTMLDivElement>(null)
  const [line, setLine] = useState(-1)
  const [running, setRunning] = useState(false)
  const [run, setRun] = useState(0)
  const [passed, setPassed] = useState<number | null>(null)
  // line index → the assertion's real outcome, filled in as the lines run
  const [results, setResults] = useState<Record<number, boolean>>({})
  const failed = Object.values(results).filter((ok) => !ok).length

  const play = async () => {
    setRunning(true)
    setPassed(null)
    setResults({})
    setRun((n) => n + 1)
    setLine(-1)
    const started = performance.now()
    await new Promise((r) => setTimeout(r, 300))
    for (let i = 0; i < STEPS.length; i++) {
      setLine(i)
      const root = stage.current
      const step = STEPS[i]
      if (root) step?.act?.(root)
      await new Promise((r) => setTimeout(r, 750))
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
              <span>faq.test.ts</span>
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
                <b>{failed ? "✗ FAIL" : "✓ PASS"}</b> faq.test.ts · {CHECKS - failed}/{CHECKS}{" "}
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
          <div className={styles.testStage} data-skinned="" data-skin={phase} ref={stage} key={run}>
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
              <Switch.Root>
                <Switch.Control>
                  <Switch.Thumb />
                </Switch.Control>
                <Switch.Label>Wi-Fi</Switch.Label>
              </Switch.Root>
            </div>
          </div>
        </Reveal>
      </section>
    </div>
  )
}
