"use client"

import { Button, CheckboxGroup, Collapsible, Switch, ToggleGroup } from "@rind-ui/react"
import { type KeyboardEvent, type ReactNode, useEffect, useRef, useState } from "react"
import { usePhase } from "../phase"
import { type HeroKind, heroKind } from "./hero-state"
import styles from "./home.module.css"
import { Reveal } from "./reveal"
import { utterance } from "./sr-view"

const KEYS = [
  ["Tab", "Tab"],
  ["ArrowLeft", "←"],
  ["ArrowRight", "→"],
  ["Home", "Home"],
  ["End", "End"],
  ["Space", "Space"],
] as const

/** A claim on the left, the live component that proves it on the right. */
function Proof({
  title,
  text,
  hint,
  readout,
  children,
}: {
  title: string
  text: string
  hint: string
  readout: ReactNode
  children: ReactNode
}) {
  const { phase } = usePhase()
  return (
    <Reveal className={styles.proof}>
      <div className={styles.claim}>
        <h3>{title}</h3>
        <p>{text}</p>
      </div>
      <div className={styles.proofPanel}>
        <div className={styles.proofStage} data-skinned="" data-skin={phase}>
          {children}
        </div>
        <div className={styles.readout}>
          <span className={styles.hint}>{hint}</span>
          {readout}
        </div>
      </div>
    </Reveal>
  )
}

/** The real keys light up as they reach the group. */
function KeyboardProof() {
  const [lit, setLit] = useState("")
  const [inside, setInside] = useState(false)
  const group = useRef<HTMLDivElement>(null)
  const timer = useRef(0)
  useEffect(() => () => clearTimeout(timer.current), [])
  useEffect(() => {
    const el = group.current
    if (!el) return
    const stage = el.closest<HTMLElement>("[data-skinned]") ?? el
    const focusGroup = () => {
      const target =
        el.querySelector<HTMLElement>('[aria-pressed="true"]') ?? el.querySelector("button")
      target?.focus()
    }
    // a press anywhere on the panel lands in the group, so the keys have somewhere to go
    const onDown = (e: PointerEvent) => {
      if (e.target instanceof Element && e.target.closest("button")) return
      e.preventDefault()
      focusGroup()
    }
    // arrows with nothing focused, while the proof is on screen: they go where the page says
    // they work. Never taken from another control: only from the page itself.
    let seen = false
    const io = new IntersectionObserver(
      ([entry]) => {
        seen = entry?.isIntersecting ?? false
      },
      { threshold: 0.6 },
    )
    io.observe(stage)
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (!seen || (e.key !== "ArrowLeft" && e.key !== "ArrowRight")) return
      if (document.activeElement && document.activeElement !== document.body) return
      e.preventDefault()
      focusGroup()
    }
    const sync = () => setInside(el.contains(document.activeElement))
    const onOut = () => requestAnimationFrame(sync)
    stage.addEventListener("pointerdown", onDown)
    document.addEventListener("keydown", onKey)
    el.addEventListener("focusin", sync)
    el.addEventListener("focusout", onOut)
    return () => {
      io.disconnect()
      stage.removeEventListener("pointerdown", onDown)
      document.removeEventListener("keydown", onKey)
      el.removeEventListener("focusin", sync)
      el.removeEventListener("focusout", onOut)
    }
  }, [])
  const onKeyDown = (e: KeyboardEvent) => {
    const key = e.key === " " ? "Space" : e.key
    if (!KEYS.some(([k]) => k === key)) return
    setLit(key)
    clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setLit(""), 700)
  }
  return (
    <Proof
      title="Every key works."
      text="Tab in, arrows across, Home and End to the ends. The keyboard pattern is built in, not bolted on."
      hint={inside ? "Focus is in. Try ← → Home End." : "Click the panel, or press ← →."}
      readout={
        <span className={styles.keys} aria-hidden="true">
          {KEYS.map(([k, label]) => (
            <kbd key={k} data-lit={lit === k ? "" : undefined}>
              {label}
            </kbd>
          ))}
        </span>
      }
    >
      {/* biome-ignore lint/a11y/noStaticElementInteractions: only listens to keys bubbling from the group, adds no behaviour */}
      <div ref={group} onKeyDown={onKeyDown}>
        <ToggleGroup.Root aria-label="Alignment" defaultValue={["left"]}>
          <ToggleGroup.Item value="left">Left</ToggleGroup.Item>
          <ToggleGroup.Item value="center">Center</ToggleGroup.Item>
          <ToggleGroup.Item value="right">Right</ToggleGroup.Item>
        </ToggleGroup.Root>
      </div>
    </Proof>
  )
}

/** What a screen reader says, read from the same attributes it reads. */
const HINTS: Record<HeroKind, string> = {
  switch: "Focus or flip the switch.",
  checkbox: "Focus or tick the checkbox.",
  button: "Focus the button, then press it.",
}

function HeardProof() {
  const [kind, setKind] = useState<HeroKind>("switch")
  useEffect(() => setKind(heroKind()), [])
  // the button's state worth hearing is pending: a press sends for a moment
  const [pending, setPending] = useState(false)
  const timer = useRef(0)
  useEffect(() => () => clearTimeout(timer.current), [])
  const send = () => {
    setPending(true)
    clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setPending(false), 1400)
  }
  const stage = useRef<HTMLDivElement>(null)
  const [said, setSaid] = useState("")
  useEffect(() => {
    const el = stage.current
    if (!el) return
    // after the state settles: the attribute flips in the same task as the click
    const read = (e: Event) =>
      requestAnimationFrame(() => {
        const t = e.target
        if (t instanceof HTMLElement) setSaid(utterance(t))
      })
    el.addEventListener("focusin", read)
    el.addEventListener("click", read)
    el.addEventListener("keyup", read)
    return () => {
      el.removeEventListener("focusin", read)
      el.removeEventListener("click", read)
      el.removeEventListener("keyup", read)
    }
  }, [])
  return (
    <Proof
      title="Every state is heard."
      text="Names, roles and states land in the accessibility tree, so a screen reader says what you see."
      hint={HINTS[kind]}
      readout={
        <output className={styles.said} aria-live="off">
          {said ? `“${said}”` : "…"}
        </output>
      }
    >
      <div ref={stage}>
        {/* the visit's own component, the one the hero showed (hero-state.ts) */}
        {kind === "switch" ? (
          <Switch.Root>
            <Switch.Control>
              <Switch.Thumb />
            </Switch.Control>
            <Switch.Label>Notifications</Switch.Label>
          </Switch.Root>
        ) : kind === "checkbox" ? (
          <CheckboxGroup.Item>
            <CheckboxGroup.ItemControl>
              <CheckboxGroup.ItemIndicator>✓</CheckboxGroup.ItemIndicator>
            </CheckboxGroup.ItemControl>
            <CheckboxGroup.ItemLabel>Notifications</CheckboxGroup.ItemLabel>
          </CheckboxGroup.Item>
        ) : (
          <Button pending={pending} onPress={send}>
            {pending ? "Sending…" : "Send"}
          </Button>
        )}
      </div>
    </Proof>
  )
}

/** Every open and close is logged as the machine's own transition. */
function MachineProof() {
  const [log, setLog] = useState<readonly string[]>([])
  return (
    <Proof
      title="Every change is a transition."
      text="Behind each component is a declared state machine. Nothing happens that is not in its graph."
      hint="Open it, close it."
      readout={
        <ol className={styles.log} aria-label="Transitions">
          {log.length === 0 ? <li>closed</li> : null}
          {log.map((line, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: an append-only log, never reordered
            <li key={i}>{line}</li>
          ))}
        </ol>
      }
    >
      <Collapsible.Root
        onOpenChange={(open) =>
          setLog((l) =>
            [open ? "closed → open · TOGGLE" : "open → closed · TOGGLE", ...l].slice(0, 3),
          )
        }
      >
        <Collapsible.Trigger>
          <Collapsible.Indicator>▸</Collapsible.Indicator>
          What ships in the box?
        </Collapsible.Trigger>
        <Collapsible.Content>
          <div className="pad">Behaviour, keyboard, ARIA, state and a test driver.</div>
        </Collapsible.Content>
      </Collapsible.Root>
    </Proof>
  )
}

export function Why() {
  return (
    <div className={styles.band} data-band="paper">
      <section className={styles.section} aria-labelledby="why-title">
        <Reveal>
          <h2 id="why-title" className={styles.h2}>
            Everything but the look.
          </h2>
          <p className={styles.lead}>No CSS ships. Here is what does: try each one.</p>
        </Reveal>
        <div className={styles.proofs}>
          <KeyboardProof />
          <HeardProof />
          <MachineProof />
        </div>
      </section>
    </div>
  )
}
