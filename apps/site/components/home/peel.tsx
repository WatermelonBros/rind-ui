"use client"

import { Switch } from "@rind-ui/react"
import { type CSSProperties, useEffect, useRef, useState } from "react"
import { usePhase } from "../phase"
import styles from "./peel.module.css"

const clamp = (n: number) => Math.min(1, Math.max(0, n))

const ACTS = [
  { title: "Peel the skin.", text: "What you see on this site is a stylesheet on top." },
  { title: "This is what ships.", text: "Parts, state and ARIA, exposed as attributes you style." },
  { title: "A machine underneath.", text: "Every interaction is a transition you can test." },
] as const

/**
 * A pinned scroll scene: a skinned Switch peels away to the bare component, its attributes
 * appear, then the camera pulls back to the state machine driving it.
 */
export function Peel() {
  const { phase } = usePhase()
  const section = useRef<HTMLElement>(null)
  const [progress, setProgress] = useState(0)
  const [checked, setChecked] = useState(false)
  // the skinned component's size: the fold geometry is in its pixels
  const layers = useRef<HTMLDivElement>(null)
  const [box, setBox] = useState({ w: 0, h: 0 })
  useEffect(() => {
    const el = layers.current
    if (!el) return
    const ro = new ResizeObserver(() => setBox({ w: el.offsetWidth, h: el.offsetHeight }))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    const el = section.current
    if (!el) return
    let raf = 0
    const update = () => {
      raf = 0
      const rect = el.getBoundingClientRect()
      const travel = rect.height - window.innerHeight
      setProgress(clamp(-rect.top / (travel || 1)))
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

  // the machine takes a transition on its own once the camera shows it
  useEffect(() => setChecked(progress > 0.8), [progress])

  const p1 = clamp(progress / 0.32)
  const p2 = clamp((progress - 0.34) / 0.25)
  const p3 = clamp((progress - 0.62) / 0.25)
  const act = progress < 0.33 ? 0 : progress < 0.62 ? 1 : 2
  const vars = { "--p1": p1, "--p2": p2, "--p3": p3 } as CSSProperties

  // The peel, in two beats. First a 45° fold line x + y = d travels in from the bottom-right
  // corner (d = w + h) until the corner is as deep as the short side: the skin keeps the part before the line, and the
  // part beyond it is the flap, reflected across the line ((x, y) → (d − y, d − x)) so its back,
  // the rind, lies on top. Then the skin and its flap lift together and slide away.
  const eased = p1 * p1 * (3 - 2 * p1)
  const fold = Math.min(1, eased / 0.6)
  const lift = clamp((eased - 0.6) / 0.4)
  // the fold stops at a corner as deep as the short side: the reflected flap stays on the skin
  const d = box.w + box.h - fold * Math.min(box.w, box.h)
  const far = box.w + box.h
  const away = `translate(${-lift * 70}px, ${-lift * 90}px)`
  const skinStyle = {
    clipPath: `polygon(0 0, ${d}px 0, 0 ${d}px)`,
    transform: away,
    opacity: 1 - lift,
  } as CSSProperties
  const flapStyle = {
    clipPath: `polygon(${d}px 0, ${far}px 0, ${far}px ${far}px, 0 ${far}px, 0 ${d}px)`,
    transform: `${away} matrix(0, -1, -1, 0, ${d}, ${d})`,
    opacity: fold > 0 ? 1 - lift : 0,
  } as CSSProperties

  const control = (skin: string) => (
    <div className={styles.component} data-skinned="" data-skin={skin}>
      <Switch.Root checked={checked} onCheckedChange={setChecked}>
        <Switch.Control>
          <Switch.Thumb />
        </Switch.Control>
        <Switch.Label>Wi-Fi</Switch.Label>
      </Switch.Root>
    </div>
  )

  return (
    <section ref={section} className={styles.peel} style={vars} aria-labelledby="peel-title">
      <div className={styles.sticky}>
        <div className={styles.copy}>
          <p className={styles.step}>{String(act + 1).padStart(2, "0")} / 03</p>
          <h2 id="peel-title" className={styles.title} key={act}>
            {ACTS[act]?.title}
          </h2>
          <p className={styles.text}>{ACTS[act]?.text}</p>
        </div>

        {/* the scene is an illustration of the text beside it: not focusable, not announced */}
        <div className={styles.scene} inert aria-hidden="true">
          <div className={styles.camera}>
            <div className={styles.layers} ref={layers}>
              <div className={styles.under}>{control("bare")}</div>
              <div className={styles.skin} style={skinStyle}>
                {control(phase)}
              </div>
              {/* the back of the peeled corner: the rind */}
              <span className={styles.flap} data-skin={phase} style={flapStyle} />
            </div>

            {/* two chips above, two below, one under them: each pair anchored to its own side of the
                centre, so they never overlap whatever their width */}
            <ul className={styles.attrs}>
              <li style={{ "--x": "-6px", "--y": "-82px", "--ax": 1 } as CSSProperties}>
                data-scope=<b>"switch"</b>
              </li>
              <li style={{ "--x": "-6px", "--y": "82px", "--ax": 1 } as CSSProperties}>
                role=<b>"switch"</b>
              </li>
              <li style={{ "--x": "6px", "--y": "-82px", "--ax": 0 } as CSSProperties}>
                data-state=<b>"{checked ? "checked" : "unchecked"}"</b>
              </li>
              <li style={{ "--x": "6px", "--y": "82px", "--ax": 0 } as CSSProperties}>
                aria-checked=<b>"{String(checked)}"</b>
              </li>
              <li style={{ "--x": "0px", "--y": "118px", "--ax": 0.5 } as CSSProperties}>
                data-part=<b>"thumb"</b>
              </li>
            </ul>

            <svg className={styles.graph} viewBox="0 0 420 150">
              <title>Switch state machine</title>
              <path className={styles.edge} d="M118 58 C170 20 250 20 302 58" />
              <path className={styles.edge} d="M302 92 C250 130 170 130 118 92" />
              <text className={styles.event} x="210" y="22" textAnchor="middle">
                TOGGLE
              </text>
              <text className={styles.event} x="210" y="142" textAnchor="middle">
                TOGGLE
              </text>
              <g data-on={checked ? undefined : ""}>
                <rect x="10" y="50" width="120" height="50" rx="25" />
                <text x="70" y="80" textAnchor="middle">
                  unchecked
                </text>
              </g>
              <g data-on={checked ? "" : undefined}>
                <rect x="290" y="50" width="120" height="50" rx="25" />
                <text x="350" y="80" textAnchor="middle">
                  checked
                </text>
              </g>
            </svg>
          </div>
        </div>
      </div>
    </section>
  )
}
