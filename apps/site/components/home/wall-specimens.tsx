"use client"

import { CheckboxGroup, Kbd, PinInput, Rating, Slider, Switch, ToggleGroup } from "@rind-ui/react"
import {
  type CSSProperties,
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react"
import { MorphLink } from "../morph-link"
import { usePhase } from "../phase"
import styles from "./home.module.css"
import { itemFor } from "./sr/buffer"
import { speakItem } from "./sr/speech"

/** The keys each card's component answers to, shown as it is used (the APG pattern's). */
const KEYS: Record<string, readonly string[]> = {
  switch: ["Tab", "Space"],
  slider: ["←", "→", "Home", "End"],
  rating: ["←", "→", "Home", "End"],
  "pin-input": ["0–9", "⌫", "←", "→"],
  "checkbox-group": ["Tab", "Space"],
  "toggle-group": ["←", "→", "Space"],
}

/**
 * What a screen reader says for the control in use in a card (NVDA's words on focus, from the
 * site's speech model: sr/speech.ts), read again as its state changes. The card is the proof
 * that the keyboard and the reader are built in: used, not explained.
 */
function useSpoken(root: React.RefObject<HTMLDivElement | null>) {
  const [said, setSaid] = useState<string | null>(null)
  useEffect(() => {
    const stage = root.current
    const li = stage?.closest("li")
    if (!stage || !li) return
    let el: HTMLElement | null = null
    const say = () =>
      setSaid(el && stage.contains(el) ? speakItem(itemFor(el), "nvda", "focus").join(", ") : null)
    const CONTROLS =
      '[role="switch"], [role="slider"], [role="checkbox"], [role="radio"], button, input'
    // the control under the pointer, else the card's own (a slider's track, a rating's row:
    // the pointer is rarely on the exact element a reader focuses)
    const pick = (t: EventTarget | null) => {
      const near = t instanceof Element ? t.closest<HTMLElement>(CONTROLS) : null
      const hit =
        near && stage.contains(near)
          ? near
          : (stage.querySelector<HTMLElement>(
              '[role="radio"][aria-checked="true"], [role="slider"], [role="switch"], input, button',
            ) ?? null)
      if (hit) {
        el = hit
        say()
      }
    }
    const onOver = (e: Event) => pick(e.target)
    const onLeave = () => {
      if (stage.contains(document.activeElement)) return
      el = null
      say()
    }
    const onBlur = () =>
      requestAnimationFrame(() => {
        if (!li.matches(":hover")) onLeave()
      })
    // the state it reads changes as the control is used
    const mo = new MutationObserver(say)
    mo.observe(stage, {
      subtree: true,
      attributes: true,
      attributeFilter: ["aria-checked", "aria-valuenow", "aria-pressed", "data-state", "value"],
    })
    stage.addEventListener("pointerover", onOver)
    stage.addEventListener("focusin", onOver)
    li.addEventListener("pointerleave", onLeave)
    stage.addEventListener("focusout", onBlur)
    stage.addEventListener("input", say)
    return () => {
      mo.disconnect()
      stage.removeEventListener("pointerover", onOver)
      stage.removeEventListener("focusin", onOver)
      li.removeEventListener("pointerleave", onLeave)
      stage.removeEventListener("focusout", onBlur)
      stage.removeEventListener("input", say)
    }
  }, [root])
  return said
}

/** One attribute of one part, read live from the DOM: the styling contract, in plain sight. */
function useAttribute(selector: string, attr: string) {
  const root = useRef<HTMLDivElement>(null)
  const [value, setValue] = useState<string | null>(null)
  useEffect(() => {
    const el = root.current
    if (!el) return
    const read = () => setValue(el.querySelector(selector)?.getAttribute(attr) ?? null)
    read()
    const mo = new MutationObserver(read)
    mo.observe(el, { subtree: true, attributes: true, attributeFilter: [attr] })
    return () => mo.disconnect()
  }, [selector, attr])
  return [root, value] as const
}

function Specimen({
  index,
  name,
  slug,
  selector,
  attr,
  children,
}: {
  /** the card's place in the wave */
  index: number
  name: string
  slug: string
  selector: string
  attr: string
  children: ReactNode
}) {
  const { phase } = usePhase()
  const [root, value] = useAttribute(selector, attr)
  const said = useSpoken(root)
  const wave = useContext(Wave)
  // a diagonal front: each card is a little behind the one up and to its left
  const offset = ((index % 3) + Math.floor(index / 3)) * 0.3
  const at = wave === null ? null : Math.floor(wave + offset)
  // the card is pressed in to change skin: it sinks a little, takes the new skin while down and
  // springs back (a card turned over was caught edge-on, skewed or blank, by any pause)
  const [shown, setShown] = useState(at)
  useEffect(() => {
    // the whole card, foot and all
    const el = root.current?.closest("li")
    if (at === shown) return
    if (shown === null || !el) return setShown(at)
    // the hero's object is coming in to land here (skin-scene.tsx): the card keeps its skin
    // until the next press after, never changing under it
    if (el.hasAttribute("data-held")) return
    const away = el.animate(
      { transform: ["scale(1)", "scale(0.94)"], filter: ["brightness(1)", "brightness(1.06)"] },
      { duration: 140, easing: "cubic-bezier(0.5, 0, 1, 0.6)" },
    )
    away.onfinish = () => {
      setShown(at)
      el.animate(
        {
          transform: ["scale(0.94)", "scale(1.025)", "scale(1)"],
          filter: ["brightness(1.06)", "brightness(1)"],
        },
        { duration: 320, easing: "cubic-bezier(0.2, 0.9, 0.3, 1)" },
      )
    }
    return () => away.cancel()
  }, [at, shown, root])
  const skin = shown === null ? null : SKINS[shown % SKINS.length]
  return (
    <li className={styles.specimen}>
      <div
        ref={root}
        className={styles.specimenStage}
        data-skinned=""
        data-skin={skin?.base ?? phase}
        data-wave={skin ? "" : undefined}
        style={skin ? (skin.vars as CSSProperties) : undefined}
      >
        {skin ? (
          <span className={styles.skinChip} aria-hidden="true">
            {skin.name}
          </span>
        ) : null}
        {children}
        {/* the keys it answers to, while it is in use (decorative: the control says it all) */}
        <span className={styles.specimenKeys} data-shown={said ? "" : undefined} aria-hidden="true">
          {(KEYS[slug] ?? []).map((k) => (
            <Kbd.Root key={k}>{k}</Kbd.Root>
          ))}
        </span>
      </div>
      <div className={styles.specimenFoot} data-speaking={said ? "" : undefined}>
        <MorphLink href={`/docs/${slug}/`}>{name}</MorphLink>
        <code aria-hidden="true">
          {value === null ? `no ${attr}` : value === "" ? attr : `${attr}="${value}"`}
        </code>
        {/* what a screen reader says for it, typed out (decorative: a real reader says it itself) */}
        {said ? (
          <q key={said} className={styles.spoken} aria-hidden="true">
            {said}
          </q>
        ) : null}
      </div>
    </li>
  )
}

const TOPPINGS = ["Ham", "Cheese"]

// The wall's skins: the site's three, plus three more written here as nothing but custom
// properties, the way a consumer would. A timed wave re-skins every live card.
type Skin = {
  readonly name: string
  readonly base: "crisp" | "juicy" | "bare"
  readonly vars?: CSSProperties
}
const v = (vars: Record<`--s-${string}`, string>) => vars as CSSProperties
const SKINS: readonly Skin[] = [
  { name: "crisp", base: "crisp" },
  {
    name: "midnight",
    base: "crisp",
    vars: v({
      "--s-bg": "#10132b",
      "--s-ink": "#eef1ff",
      "--s-acc": "#7cf0ff",
      "--s-acc-deep": "#7cf0ff",
      "--s-on": "#10132b",
      "--s-card": "#1a1f45",
      "--s-muted": "#252b5a",
      "--s-line": "#eef1ff",
      "--s-bw": "2px",
      "--s-r": "12px",
      "--s-r-sm": "6px",
      "--s-lift": "none",
      "--s-lift-hi": "none",
      "--s-lift-lo": "none",
      "--s-ok": "#7cf0ff",
      "--s-error": "#ff9db0",
      "--s-brand": "#7cf0ff",
      "--s-brand-text": "#10132b",
      "--s-brand-deep": "#7cf0ff",
      "--s-focus": "#7cf0ff",
    }),
  },
  { name: "juicy", base: "juicy" },
  {
    name: "paper",
    base: "crisp",
    vars: v({
      "--s-bg": "#f4efe6",
      "--s-ink": "#2b2118",
      "--s-acc": "#b4532a",
      "--s-acc-deep": "#8a3a1a",
      "--s-on": "#f4efe6",
      "--s-card": "#fffaf2",
      "--s-muted": "#ebe3d6",
      "--s-line": "#2b2118",
      "--s-bw": "1px",
      "--s-r": "2px",
      "--s-r-sm": "2px",
      "--s-lift": "0 1px 0 #2b2118",
      "--s-lift-hi": "0 2px 0 #2b2118",
      "--s-lift-lo": "none",
      "--s-font": "Georgia, 'Times New Roman', serif",
      "--s-ok": "#2b2118",
      "--s-error": "#8a1c1c",
      "--s-brand": "#2b2118",
      "--s-brand-text": "#f4efe6",
      "--s-brand-deep": "#2b2118",
      "--s-focus": "#8a3a1a",
    }),
  },
  { name: "bare", base: "bare" },
  {
    name: "citrus",
    base: "crisp",
    vars: v({
      "--s-bg": "#fff0c2",
      "--s-ink": "#2e1d00",
      "--s-acc": "#ff7a00",
      "--s-acc-deep": "#9a4300",
      "--s-on": "#ffffff",
      "--s-card": "#ffffff",
      "--s-muted": "#ffe08a",
      "--s-line": "#2e1d00",
      "--s-bw": "2px",
      "--s-r": "20px",
      "--s-r-sm": "12px",
      "--s-lift": "0 4px 0 #2e1d00",
      "--s-lift-hi": "0 6px 0 #2e1d00",
      "--s-lift-lo": "0 1px 0 #2e1d00",
      "--s-ok": "#2e1d00",
      "--s-error": "#9c1a00",
      "--s-brand": "#9a4300",
      "--s-brand-text": "#ffffff",
      "--s-brand-deep": "#6b2e00",
      "--s-focus": "#9a4300",
    }),
  },
]

/** The wave's position: which skin each card wears is its index plus this, round the list. */
const Wave = createContext<number | null>(null)
const STEP_MS = 2000

/** Six ready components, alive: use them, and watch the attribute a stylesheet would target. */
export function WallSpecimens({ ready }: { readonly ready: number }) {
  // the wave advances one skin every two seconds while the list is on screen (a scroll-driven
  // wave changed too fast to read); it holds while the pointer or focus is on a card, so a
  // card can be used in one skin. Under reduced motion every card keeps the site's skin.
  const list = useRef<HTMLUListElement>(null)
  const [wave, setWave] = useState<number | null>(null)
  useEffect(() => {
    const el = list.current
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return
    let frame = 0
    let last = 0
    let w = 0
    let seen = false
    let held = false
    const tick = (now: number) => {
      frame = requestAnimationFrame(tick)
      if (!held && last) w += (now - last) / STEP_MS
      last = now
      // React only hears whole steps: a card turns over when its own comes round
      setWave(Math.floor(w * 10) / 10)
    }
    const run = () => {
      if (seen && !document.hidden && !frame) frame = requestAnimationFrame(tick)
      if ((!seen || document.hidden) && frame) {
        cancelAnimationFrame(frame)
        frame = 0
        last = 0
      }
    }
    const io = new IntersectionObserver(
      ([e]) => {
        seen = !!e?.isIntersecting
        run()
      },
      { threshold: 0.4 },
    )
    io.observe(el)
    const hold = () => {
      held = el.matches(":hover") || el.contains(document.activeElement)
    }
    setWave(0)
    for (const t of ["pointerover", "pointerleave", "focusin", "focusout"])
      el.addEventListener(t, () => requestAnimationFrame(hold))
    document.addEventListener("visibilitychange", run)
    return () => {
      io.disconnect()
      document.removeEventListener("visibilitychange", run)
      cancelAnimationFrame(frame)
    }
  }, [])
  // the wave starts at the site phase's own skin, so the first card wears the page's look and
  // a phase switch turns the wall with it
  const { phase } = usePhase()
  const start = Math.max(
    0,
    SKINS.findIndex((k) => k.name === phase),
  )
  return (
    <Wave.Provider value={wave === null ? null : wave + start}>
      <ul ref={list} className={styles.specimens} aria-label="Try a few">
        <Specimen
          index={0}
          name="Switch"
          slug="switch"
          selector='[data-scope="switch"][data-part="root"]'
          attr="data-state"
        >
          <Switch.Root>
            {/* where the hero's object ends its trip on a switch visit (skin-scene.tsx) */}
            <Switch.Control data-object-land="switch">
              <Switch.Thumb />
            </Switch.Control>
            <Switch.Label>Dark mode</Switch.Label>
          </Switch.Root>
        </Specimen>
        <Specimen
          index={1}
          name="Slider"
          slug="slider"
          selector="[aria-valuenow]"
          attr="aria-valuenow"
        >
          <Slider.Root defaultValue={40}>
            <Slider.Label>Volume</Slider.Label>
            <Slider.ValueText />
            <Slider.Control>
              <Slider.Track>
                <Slider.Indicator />
              </Slider.Track>
              <Slider.Thumb index={0} />
            </Slider.Control>
          </Slider.Root>
        </Specimen>
        <Specimen
          index={2}
          name="Checkbox Group"
          slug="checkbox-group"
          selector="[data-parent][data-state]"
          attr="data-state"
        >
          <CheckboxGroup.Root allValues={TOPPINGS} defaultValue={["Ham"]}>
            <CheckboxGroup.Label>Toppings</CheckboxGroup.Label>
            <CheckboxGroup.Parent>
              <CheckboxGroup.ItemControl>
                <CheckboxGroup.ItemIndicator>
                  {({ indeterminate }) => (indeterminate ? "–" : "✓")}
                </CheckboxGroup.ItemIndicator>
              </CheckboxGroup.ItemControl>
              <CheckboxGroup.ItemLabel>All</CheckboxGroup.ItemLabel>
            </CheckboxGroup.Parent>
            {TOPPINGS.map((value) => (
              <CheckboxGroup.Item key={value} value={value}>
                <CheckboxGroup.ItemControl
                  data-object-land={value === "Ham" ? "checkbox" : undefined}
                >
                  <CheckboxGroup.ItemIndicator>✓</CheckboxGroup.ItemIndicator>
                </CheckboxGroup.ItemControl>
                <CheckboxGroup.ItemLabel>{value}</CheckboxGroup.ItemLabel>
              </CheckboxGroup.Item>
            ))}
          </CheckboxGroup.Root>
        </Specimen>
        <Specimen
          index={3}
          name="Pin Input"
          slug="pin-input"
          selector='[data-scope="pin-input"][data-part="root"]'
          attr="data-complete"
        >
          <PinInput.Root length={4}>
            <PinInput.Label>Code</PinInput.Label>
            <PinInput.Control>
              <PinInput.Input />
              {[0, 1, 2, 3].map((i) => (
                <PinInput.Slot key={i} index={i} />
              ))}
            </PinInput.Control>
          </PinInput.Root>
        </Specimen>
        <Specimen
          index={4}
          name="Rating"
          slug="rating"
          selector="[aria-valuenow]"
          attr="aria-valuenow"
        >
          <Rating.Root defaultValue={3}>
            <Rating.Label>Rate it</Rating.Label>
            <Rating.Control>
              {[1, 2, 3, 4, 5].map((i) => (
                <Rating.Item key={i} index={i} />
              ))}
            </Rating.Control>
          </Rating.Root>
        </Specimen>
        <Specimen
          index={5}
          name="Toggle Group"
          slug="toggle-group"
          selector="[aria-pressed]"
          attr="aria-pressed"
        >
          <ToggleGroup.Root aria-label="Format" selectionMode="multiple">
            <ToggleGroup.Item value="bold" data-object-land="button">
              Bold
            </ToggleGroup.Item>
            <ToggleGroup.Item value="italic">Italic</ToggleGroup.Item>
          </ToggleGroup.Root>
        </Specimen>
        {/* the wall's last tile: the rest of the catalogue, one step away */}
        <li className={styles.wallMore}>
          <MorphLink href="/docs/">
            <b>{ready} ready</b>
            <span>
              Every one with its spec, tests, driver and docs <span aria-hidden="true">→</span>
            </span>
          </MorphLink>
        </li>
      </ul>
    </Wave.Provider>
  )
}
