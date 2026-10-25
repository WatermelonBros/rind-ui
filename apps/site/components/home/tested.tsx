"use client"

import { Accordion, Button, CheckboxGroup, Switch } from "@rind-ui/react"
import { computeAccessibleName } from "dom-accessibility-api"
import { useEffect, useRef, useState } from "react"
import { Letters } from "../letters"
import { usePhase } from "../phase"
import { cue } from "../sound"
import { zoom } from "../zoom"
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
  /** what the line's driver finds: drawn round on the stage while the line runs */
  readonly target?: (root: HTMLElement) => HTMLElement | null
}

const byText = (root: HTMLElement, selector: string, text: string) =>
  [...root.querySelectorAll<HTMLElement>(selector)].find((el) => el.textContent?.includes(text)) ??
  null
const returns = (r: HTMLElement) =>
  byText(r, '[data-scope="accordion"][data-part="trigger"]', "Returns")
const control = (r: HTMLElement) =>
  r.querySelector<HTMLElement>(
    '[data-scope="switch"][data-part="control"], [data-scope="checkbox"][data-part="control"], button[data-scope="button"]',
  )

/** What a driver reads off an element: its role, its accessible name and its state, from ARIA. */
function readAria(el: HTMLElement): string {
  const role = el.getAttribute("role") ?? (el.tagName === "BUTTON" ? "button" : el.localName)
  const name = computeAccessibleName(el).trim()
  const state = ["aria-expanded", "aria-checked", "aria-pressed"]
    .map((a) => (el.hasAttribute(a) ? `${a}="${el.getAttribute(a)}"` : ""))
    .find(Boolean)
  return `${role} "${name}"${state ? ` · ${state}` : ""}`
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
  { code: 'const faq = getAccordion(screen, { item: "Returns" })', target: returns },
  {
    code: 'await faq.expand("Returns")',
    act: (r) => click(r, '[data-scope="accordion"][data-part="trigger"]', "Returns"),
    target: returns,
  },
  {
    code: 'expect(await faq.expanded()).toEqual(["Returns"])',
    check: (r) => JSON.stringify(expanded(r)) === JSON.stringify(["Returns"]),
    target: returns,
  },
]

// the second half drives the visit's own component, the one the hero showed (hero-state.ts)
const CONTROL: Record<HeroKind, readonly Step[]> = {
  switch: [
    { code: 'const wifi = getSwitch(screen, { name: "Wi-Fi" })', target: control },
    {
      code: "await wifi.toggle()",
      target: control,
      // the control itself, as the driver does: a label's click focuses the control and scrolls
      // it into view, which would pull back a visitor who has scrolled past the run
      act: (r) =>
        r.querySelector<HTMLElement>('[data-scope="switch"][data-part="control"]')?.click(),
    },
    {
      code: "expect(await wifi.isChecked()).toBe(true)",
      target: control,
      check: (r) => r.querySelector('[role="switch"]')?.getAttribute("aria-checked") === "true",
    },
  ],
  checkbox: [
    { code: 'const ready = getCheckbox(screen, { name: "Keyboard ready" })', target: control },
    {
      code: "await ready.toggle()",
      target: control,
      act: (r) =>
        r.querySelector<HTMLElement>('[data-scope="checkbox"][data-part="control"]')?.click(),
    },
    {
      code: "expect(await ready.isChecked()).toBe(true)",
      target: control,
      check: (r) => r.querySelector('[role="checkbox"]')?.getAttribute("aria-checked") === "true",
    },
  ],
  button: [
    { code: 'const save = getButton(screen, { name: "Save" })', target: control },
    {
      code: "await save.press()",
      target: control,
      act: (r) => click(r, 'button[data-scope="button"]', "Save"),
    },
    {
      // a press has no state of its own: the test asserts the handler, as the driver docs say
      code: "expect(onPress).toHaveBeenCalledOnce()",
      target: control,
      check: (r) => r.querySelector("[data-presses]")?.getAttribute("data-presses") === "1",
    },
  ],
}

// a phone runs the test on its own once in view; a desktop window as narrow (or zoomed in) keeps
// the run on its scroll, as every desktop does
const PHONE = "(max-width: 900px) and (pointer: coarse)"

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
  // the running line's target, framed on the stage with what its driver reads there (live ARIA,
  // read again once the line's action has settled)
  const [driving, setDriving] = useState<{
    x: number
    y: number
    w: number
    h: number
    aria: string
  } | null>(null)
  // biome-ignore lint/correctness/useExhaustiveDependencies: follows the running line only
  useEffect(() => {
    const root = stage.current
    const target = root ? STEPS[line]?.target?.(root) : null
    if (!root || !target) {
      setDriving(null)
      return
    }
    // framed whole: an accordion's trigger opening its panel under a frame drawn round the
    // trigger alone struck the panel's first line through
    const framed =
      target.closest<HTMLElement>('[data-scope="accordion"][data-part="item"]') ?? target
    const frame = () => {
      const s = root.getBoundingClientRect()
      const r = framed.getBoundingClientRect()
      const z = zoom()
      setDriving({
        x: (r.left - s.left) / z,
        y: (r.top - s.top) / z,
        w: r.width / z,
        h: r.height / z,
        aria: readAria(target),
      })
    }
    frame()
    // again once a panel the line opened has finished growing
    const later = window.setTimeout(frame, 320)
    const settled = window.setTimeout(frame, 720)
    return () => {
      window.clearTimeout(later)
      window.clearTimeout(settled)
    }
  }, [line, run])
  const playRef = useRef<() => void>(() => {})
  const autoRan = useRef(false)
  // biome-ignore lint/correctness/useExhaustiveDependencies: the visit's kind renders a new control to observe
  useEffect(() => {
    // the object lands, holds still a moment, then the run goes with the scroll (scrollRef)
    let wait = 0
    const go = () => {
      if (autoRan.current) return
      autoRan.current = true
      // a phone does not hold the scene, so a run driven by the scroll carried the panel off the
      // screen before its PASS: there it runs on its own, as the Run button does
      const phone = window.matchMedia(PHONE).matches
      wait = window.setTimeout(() => (phone ? playRef.current() : scrollRef.current()), 500)
    }
    const off = onTestArrived(go)
    // desktop: the run also starts as the scene comes to hold still, if the object is late
    const hold = roomRef.current?.previousElementSibling
    const onHold = () => {
      if (!hold || autoRan.current) return
      const top = (Number.parseFloat(getComputedStyle(hold).top) || 0) * zoom()
      if (hold.getBoundingClientRect().top <= top + 1) {
        autoRan.current = true
        scrollRef.current()
      }
    }
    if (window.matchMedia("(min-width: 901px)").matches)
      window.addEventListener("scroll", onHold, { passive: true })
    // a phone runs as soon as the control itself is in view: waiting for it to reach the
    // object's landing height let the visitor scroll past the PASS
    const root = stage.current?.querySelector<HTMLElement>(
      '[data-scope="switch"][data-part="control"], [data-scope="checkbox"][data-part="control"], button[data-scope="button"]',
    )
    if (!root || !window.matchMedia(PHONE).matches)
      return () => {
        off()
        window.clearTimeout(wait)
        window.removeEventListener("scroll", onHold)
      }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) go()
      },
      { threshold: 0.6 },
    )
    io.observe(root)
    return () => {
      off()
      io.disconnect()
      window.clearTimeout(wait)
      window.removeEventListener("scroll", onHold)
    }
  }, [kind])

  const play = async () => {
    let green = true
    setRunning(true)
    setPassed(null)
    setResults({})
    setRun((n) => n + 1)
    setPresses(0)
    setLine(-1)
    const started = performance.now()
    // the control takes its starting state and stays there long enough to be seen
    await new Promise((r) => setTimeout(r, 700))
    for (let i = 0; i < STEPS.length; i++) {
      setLine(i)
      const root = stage.current
      const step = STEPS[i]
      if (root) step?.act?.(root)
      await new Promise((r) => setTimeout(r, 260))
      // read after the component has settled, like an awaited driver query
      const check = step?.check
      if (check && stage.current) {
        const ok = check(stage.current)
        if (!ok) green = false
        setResults((all) => ({ ...all, [i]: ok }))
      }
    }
    setLine(STEPS.length)
    setPassed(Math.round(performance.now() - started))
    setRunning(false)
    if (green) cue("pass")
  }
  playRef.current = () => {
    if (!running) void play()
  }

  // The visit's own run is driven by the scroll: the control takes its starting state, then each
  // further stretch of scroll runs the next line (its action, then its assertion, read from the
  // live DOM). Stop scrolling and the run stops on its line; the PASS only comes with the last
  // one, so nothing downstream (the install's ticks) ever leaves from a test that has not run.
  const scrollRef = useRef<() => void>(() => {})
  // the stretch of scroll the run holds for: only until it has passed once, then gone for good
  const [room, setRoom] = useState(true)
  const roomRef = useRef<HTMLDivElement>(null)
  const dropRoom = () => {
    // once the room is wholly above the screen it goes, but only while the scroll is at rest: a
    // smooth scroll still running would carry on to its old target and undo the compensation.
    // The browser's scroll anchoring keeps what is on screen in place; where there is none
    // (Safari), the scroll moves back by what the middle of the screen moved
    let idle = 0
    const drop = () => {
      const el = roomRef.current
      if (!el) return
      const r = el.getBoundingClientRect()
      if (r.bottom > 0) return
      // near the page's end the scroll cannot move back by all of it (it would clamp, and the
      // screen would shift): it waits until there is page enough below
      const below = document.documentElement.scrollHeight - window.innerHeight - window.scrollY
      if (below < r.height + 8) return
      window.removeEventListener("scroll", off)
      const anchor =
        document.elementFromPoint(window.innerWidth / 2, window.innerHeight / 2) ?? document.body
      const before = anchor.getBoundingClientRect().top
      el.style.display = "none"
      const moved = anchor.getBoundingClientRect().top - before
      if (Math.abs(moved) > 0.5) window.scrollBy({ top: moved, behavior: "instant" })
      // the smooth scroll (smooth-scroll.tsx) takes the new position as its own
      window.dispatchEvent(new Event("rind:scroll-sync"))
      setRoom(false)
    }
    const off = () => {
      window.clearTimeout(idle)
      idle = window.setTimeout(drop, 250)
    }
    window.addEventListener("scroll", off, { passive: true })
  }
  scrollRef.current = () => {
    if (running) return
    const n = STEPS.length
    const stepPx = window.matchMedia("(max-width: 900px)").matches ? 70 : 90
    setRunning(true)
    setPassed(null)
    setResults({})
    setRun((k) => k + 1)
    setPresses(0)
    setLine(-1)
    const started = performance.now()
    // the lines count from where the scene holds still (its sticky top; desktop), so the run
    // ends with the hold (home.module.css: .testRoom is the lines' stretches and a little for the
    // PASS); the first line waits a half stretch, so the reset state is seen first
    const hold = roomRef.current?.previousElementSibling
    const holdStyle = hold ? getComputedStyle(hold) : null
    const stuckAt =
      hold && holdStyle?.position === "sticky"
        ? window.scrollY +
          hold.getBoundingClientRect().top -
          (Number.parseFloat(holdStyle.top) || 0) * zoom()
        : window.scrollY
    const y0 = Math.max(window.scrollY, stuckAt) + stepPx * 0.5
    let done = 0
    let green = true
    // a line lights the moment the scroll reaches it, however fast; its action runs then, and
    // its assertion reads the DOM once the component has settled, without holding the next line
    let checked = 0
    const finish = () => {
      window.removeEventListener("scroll", onScroll)
      setLine(n)
      setPassed(Math.round(performance.now() - started))
      setRunning(false)
      if (green) cue("pass")
      dropRoom()
    }
    const runStep = (i: number) => {
      setLine(i)
      cue("line", { value: i / Math.max(1, STEPS.length - 1) })
      const step = STEPS[i]
      if (stage.current) step?.act?.(stage.current)
      window.setTimeout(() => {
        const check = step?.check
        if (check && stage.current) {
          const ok = check(stage.current)
          if (!ok) green = false
          setResults((all) => ({ ...all, [i]: ok }))
        }
        if (++checked === n) finish()
      }, 220)
    }
    const onScroll = () => {
      const target = Math.min(n, Math.max(0, Math.floor((window.scrollY - y0) / stepPx) + 1))
      while (done < target) runStep(done++)
    }
    window.addEventListener("scroll", onScroll, { passive: true })
  }

  return (
    <div className={styles.band} data-band="ink" data-from="page">
      <section className={styles.section} aria-labelledby="tested-title">
        {/* the title, its lead and the panel hold still together while the run goes with the
            scroll, then the room under them (testRoom) is taken out once it has passed */}
        <div className={styles.testHold}>
          <Reveal>
            <h2 id="tested-title" className={styles.h2}>
              <Letters>The tests come in the box.</Letters>
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
              <ol
                aria-label={`${kind}.test.ts`}
                // biome-ignore lint/a11y/noNoninteractiveTabindex: a line too long for the panel scrolls the list, which must be reachable by keyboard
                tabIndex={0}
              >
                {STEPS.map((s, i) => (
                  <li
                    key={s.code}
                    data-state={i < line ? "done" : i === line ? "current" : undefined}
                    className={passed !== null && failed === 0 ? styles.pass : undefined}
                    style={passed !== null ? { animationDelay: `${i * 0.05}s` } : undefined}
                  >
                    <code>{s.code}</code>
                    {/* what the line's driver reads off its target, live, as a comment */}
                    {i === line && driving ? (
                      <span className={styles.reads}>{`// ${driving.aria}`}</span>
                    ) : null}
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
                  <b data-pass-mark={failed ? undefined : ""}>{failed ? "✗ FAIL" : "✓ PASS"}</b>{" "}
                  {/* each fact wraps whole, with its separator: never "· 2.7s" alone on a line */}
                  <span className={styles.passFact}>{kind}.test.ts</span>{" "}
                  <span className={styles.passFact}>
                    · {CHECKS - failed}/{CHECKS} assertions
                  </span>{" "}
                  <span className={styles.passFact}>· {(passed / 1000).toFixed(1)}s</span>
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
              {driving ? (
                <div
                  className={styles.driving}
                  aria-hidden="true"
                  style={{
                    translate: `${driving.x}px ${driving.y}px`,
                    inlineSize: driving.w,
                    blockSize: driving.h,
                  }}
                />
              ) : null}
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
        </div>
        {room ? <div ref={roomRef} className={styles.testRoom} aria-hidden="true" /> : null}
      </section>
    </div>
  )
}
