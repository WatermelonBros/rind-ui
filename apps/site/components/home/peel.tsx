"use client"

import { Button, CheckboxGroup, Switch } from "@rind-ui/react"
import { type CSSProperties, useEffect, useRef, useState } from "react"
import { Letters } from "../letters"
import { zoom } from "../zoom"
import {
  type HeroKind,
  heroKind,
  setPeelOn,
  setPeelTarget,
  useHeroOn,
  useLanded,
  useSceneGl,
} from "./hero-state"
import styles from "./peel.module.css"

const clamp = (n: number) => Math.min(1, Math.max(0, n))

const ACTS = [
  {
    title: "This is what ships.",
    text: "Parts, state and ARIA, as attributes. Style them any way you like.",
  },
  { title: "A machine underneath.", text: "Every interaction is a transition you can test." },
] as const

// each machine as it really is: its two states and the event (or prop) between them
const MACHINES: Record<HeroKind, { off: string; on: string; go: string; back: string }> = {
  switch: { off: "unchecked", on: "checked", go: "TOGGLE", back: "TOGGLE" },
  checkbox: { off: "unchecked", on: "checked", go: "TOGGLE", back: "TOGGLE" },
  button: { off: "idle", on: "pending", go: "pending: true", back: "pending: false" },
}

// where the five attribute chips land around the component: two above, two below, one under
const SLOTS = [
  { x: "-6px", y: "-82px", ax: 1 },
  { x: "6px", y: "-82px", ax: 0 },
  { x: "-6px", y: "82px", ax: 1 },
  { x: "6px", y: "82px", ax: 0 },
  { x: "0px", y: "118px", ax: 0.5 },
] as const

/**
 * A pinned scroll scene after the hero. The hero has already peeled the skin off its component
 * (skin-scene.tsx): this scene shows the same component, bare and in the same state, its real
 * attributes, then pulls back to the state machine driving it.
 */
export function Peel() {
  const section = useRef<HTMLElement>(null)
  const control = useRef<HTMLDivElement>(null)
  const [progress, setProgress] = useState(0)
  const [kind, setKind] = useState<HeroKind>("switch")
  const heroOn = useHeroOn()
  const [attrs, setAttrs] = useState<readonly string[]>([])
  useEffect(() => setKind(heroKind()), [])

  // The hero's 3D object travels here and stands over this scene's real control (skin-scene.tsx):
  // hand it the control and its state; hide the control's own look while the object draws.
  const gl = useSceneGl()
  const landed = useLanded()
  // biome-ignore lint/correctness/useExhaustiveDependencies: a new kind renders a new control to hand over
  useEffect(() => {
    setPeelTarget(
      control.current?.querySelector<HTMLElement>('[data-part="control"], button') ?? null,
    )
    return () => setPeelTarget(null)
  }, [kind])

  useEffect(() => {
    const el = section.current
    if (!el) return
    let raf = 0
    let pushed = 0
    const update = () => {
      raf = 0
      const rect = el.getBoundingClientRect()
      const travel = rect.height - window.innerHeight
      // a phone starts the acts while the scene is still rising into place: waiting for it to
      // reach the top left most of the screen empty ground
      const early = window.innerWidth <= 900 ? window.innerHeight * 0.48 : 0
      setProgress(clamp((early - rect.top) / (travel || 1)))
      // the builder's title, rising, pushes the whole scene up ahead of it, 40px clear
      // of its lowest part (the diagram), so the two never meet and the screen is never left
      // with the scene gone and the title not yet there
      const stick = el.querySelector<HTMLElement>(`.${styles.sticky}`)
      // the ink disc opens from behind the component, so its first sliver is hidden by it (from
      // a fixed point it began as a stray dot beside the object)
      const c = (
        control.current?.querySelector('[data-part="control"], button') ?? control.current
      )?.getBoundingClientRect()
      const box = stick?.getBoundingClientRect()
      if (stick && c && box?.width && box.height) {
        stick.style.setProperty(
          "--disc-x",
          `${((c.left + c.width / 2 - box.left) / box.width) * 100}%`,
        )
        stick.style.setProperty(
          "--disc-y",
          `${((c.top + c.height / 2 - box.top) / box.height) * 100}%`,
        )
      }
      const next = document.getElementById("look-title")?.getBoundingClientRect().top
      if (stick) {
        const low = (stick.querySelector("[data-state-graph]") ?? stick).getBoundingClientRect()
        // desktop only: a phone's column scrolls the scene away on its own
        const push =
          next === undefined || window.innerWidth <= 900
            ? 0
            : Math.max(0, low.bottom + pushed + 40 - next)
        if (push !== pushed) {
          pushed = push
          // its contents move, not its ground (moving that bared a band of the page under it)
          stick.style.setProperty("--push", `${-push / zoom()}px`)
        }
      }
    }
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update)
    }
    update()
    window.addEventListener("scroll", onScroll, { passive: true })
    window.addEventListener("resize", onScroll)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener("scroll", onScroll)
      window.removeEventListener("resize", onScroll)
    }
  }, [])

  // the machine takes a transition on its own once the camera shows it: from the hero's state
  // to the other one (a button goes pending)
  const late = progress > 0.75
  // a button stays idle: the object has no pending look, and a diagram saying "pending" over an
  // idle button contradicts it
  const on = kind === "button" ? false : late ? !heroOn : heroOn
  useEffect(() => setPeelOn(on), [on])

  // the chips are the control's real attributes, read from the DOM as they change
  // biome-ignore lint/correctness/useExhaustiveDependencies: a new kind renders a new control element to observe
  useEffect(() => {
    const host = control.current
    const el = host?.querySelector<HTMLElement>('[data-part="control"], button')
    if (!el) return
    const read = () =>
      setAttrs(
        [...el.attributes]
          .filter((a) =>
            /^(role|aria-(checked|busy|disabled)|data-(scope|part|state|pending))$/.test(a.name),
          )
          .slice(0, SLOTS.length)
          .map((a) => (a.value === "" ? a.name : `${a.name}="${a.value}"`)),
      )
    read()
    const mo = new MutationObserver(read)
    mo.observe(el, { attributes: true })
    return () => mo.disconnect()
  }, [kind])

  const p2 = clamp(progress / 0.4)
  const p3 = clamp((progress - 0.5) / 0.35)
  const act = progress < 0.5 ? 0 : 1
  const dark = p2 * (1 - p3)
  const vars = {
    "--p1": 1,
    "--p2": p2,
    "--p3": p3,
    "--dark": dark,
  } as CSSProperties
  const machine = MACHINES[kind]

  return (
    <section ref={section} className={styles.peel} style={vars} aria-labelledby="peel-title">
      {/* each act owns the whole field: the bare parts on ink, the machine on the brand colour */}
      {/* the object's label turns light as soon as the ink disc reaches it */}
      <div className={styles.sticky} data-act={act + 1} data-ink={dark > 0.15 ? "" : undefined}>
        <div className={styles.copy}>
          <h2 id="peel-title" className={styles.title} key={act}>
            <Letters>{ACTS[act]?.title ?? ""}</Letters>
          </h2>
          <p className={styles.text}>{ACTS[act]?.text}</p>
        </div>
        {/* the same copy in paper, clipped by the ink disc: every letter reads on both grounds */}
        <div className={styles.inkLayer} aria-hidden="true">
          <div className={styles.copy}>
            <p className={styles.title} key={act}>
              <Letters>{ACTS[act]?.title ?? ""}</Letters>
            </p>
            <p className={styles.text}>{ACTS[act]?.text}</p>
          </div>
        </div>

        {/* the scene is an illustration of the text beside it: not focusable, not announced */}
        <div
          className={styles.scene}
          inert
          aria-hidden="true"
          data-gl={gl ? "" : undefined}
          data-landed={landed ? "" : undefined}
        >
          <div className={styles.camera}>
            <div className={styles.layers} ref={control}>
              <div className={styles.under}>
                <div className={styles.component} data-skinned="" data-skin="bare">
                  {kind === "switch" ? (
                    <Switch.Root checked={on}>
                      <Switch.Control>
                        <Switch.Thumb />
                      </Switch.Control>
                      <Switch.Label>Wi-Fi</Switch.Label>
                    </Switch.Root>
                  ) : kind === "checkbox" ? (
                    <CheckboxGroup.Item checked={on}>
                      <CheckboxGroup.ItemControl>
                        <CheckboxGroup.ItemIndicator>✓</CheckboxGroup.ItemIndicator>
                      </CheckboxGroup.ItemControl>
                      <CheckboxGroup.ItemLabel>Keyboard ready</CheckboxGroup.ItemLabel>
                    </CheckboxGroup.Item>
                  ) : (
                    <Button pending={on}>Press me</Button>
                  )}
                </div>
              </div>
            </div>

            <ul className={styles.attrs}>
              {attrs.map((a, i) => {
                const slot = SLOTS[i] ?? SLOTS[0]
                const eq = a.indexOf("=")
                return (
                  <li
                    key={a.slice(0, eq < 0 ? undefined : eq)}
                    style={{ "--x": slot.x, "--y": slot.y, "--ax": slot.ax } as CSSProperties}
                  >
                    {eq < 0 ? (
                      a
                    ) : (
                      <>
                        {a.slice(0, eq + 1)}
                        <b>{a.slice(eq + 1)}</b>
                      </>
                    )}
                  </li>
                )
              })}
            </ul>

            <svg className={styles.graph} viewBox="0 0 420 150" data-state-graph="">
              <title>{`${kind} state machine`}</title>
              <path className={styles.edge} d="M118 58 C170 20 250 20 302 58" />
              <path className={styles.edge} d="M302 92 C250 130 170 130 118 92" />
              <text className={styles.event} x="210" y="22" textAnchor="middle">
                {machine.go}
              </text>
              <text className={styles.event} x="210" y="142" textAnchor="middle">
                {machine.back}
              </text>
              <g data-on={on ? undefined : ""} data-state-node="">
                <rect x="10" y="50" width="120" height="50" rx="25" />
                <text x="70" y="80" textAnchor="middle">
                  {machine.off}
                </text>
              </g>
              <g data-on={on ? "" : undefined} data-state-node="">
                <rect x="290" y="50" width="120" height="50" rx="25" />
                <text x="350" y="80" textAnchor="middle">
                  {machine.on}
                </text>
              </g>
            </svg>
          </div>
        </div>
      </div>
    </section>
  )
}
