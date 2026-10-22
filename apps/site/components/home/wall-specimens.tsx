"use client"

import { CheckboxGroup, PinInput, Rating, Slider, Switch, ToggleGroup } from "@rind-ui/react"
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
  const wave = useContext(Wave)
  // a diagonal front: each card is a little behind the one up and to its left
  const offset = ((index % 3) + Math.floor(index / 3)) * 0.3
  const at = wave === null ? null : Math.floor(wave + offset)
  const skin = at === null ? null : SKINS[at % SKINS.length]
  const next = at === null ? null : SKINS[(at + 1) % SKINS.length]
  return (
    <li className={styles.specimen}>
      <div
        ref={root}
        className={styles.specimenStage}
        data-skinned=""
        data-skin={skin?.base ?? phase}
        data-wave={skin ? "" : undefined}
        style={
          skin
            ? ({
                ...skin.vars,
                "--o": String(offset),
                "--next-bg": GROUND[next?.name ?? "crisp"],
              } as CSSProperties)
            : undefined
        }
      >
        {skin ? (
          <span className={styles.skinChip} aria-hidden="true">
            {skin.name}
          </span>
        ) : null}
        {children}
      </div>
      <div className={styles.specimenFoot}>
        <MorphLink href={`/docs/${slug}/`}>{name}</MorphLink>
        <code aria-hidden="true">
          {value === null ? `no ${attr}` : value === "" ? attr : `${attr}="${value}"`}
        </code>
      </div>
    </li>
  )
}

const TOPPINGS = ["Ham", "Cheese"]

// The wall's skins: the site's three, plus three more written here as nothing but custom
// properties, the way a consumer would. One wave of scroll re-skins every live card.
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

// each skin's ground, for the front that sweeps the next one in
const GROUND: Record<string, string> = {
  crisp: "#d4ff3a",
  midnight: "#10132b",
  juicy: "#e9e2ff",
  paper: "#f4efe6",
  bare: "#f4f4f5",
  citrus: "#fff0c2",
}

/** The wave's position: which skin each card wears is its index plus this, round the list. */
const Wave = createContext<number | null>(null)

/** Six ready components, alive: use them, and watch the attribute a stylesheet would target. */
export function WallSpecimens() {
  // the wave advances one skin per eighth of the list's trip through the screen; under reduced
  // motion every card keeps the site's skin
  const list = useRef<HTMLUListElement>(null)
  const [wave, setWave] = useState<number | null>(null)
  useEffect(() => {
    const el = list.current
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return
    let frame = 0
    const update = () => {
      frame = 0
      const r = el.getBoundingClientRect()
      const p = (window.innerHeight - r.top) / (window.innerHeight + r.height)
      const w = Math.min(1, Math.max(0, p)) * 8
      el.style.setProperty("--w", String(w))
      // React only hears whole-ish steps; the front between them is CSS (--w)
      setWave(Math.floor(w * 20) / 20)
    }
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update)
    }
    update()
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => {
      window.removeEventListener("scroll", onScroll)
      cancelAnimationFrame(frame)
    }
  }, [])
  return (
    <Wave.Provider value={wave}>
      <ul ref={list} className={styles.specimens} aria-label="Try a few">
        <Specimen
          index={0}
          name="Switch"
          slug="switch"
          selector='[data-scope="switch"][data-part="root"]'
          attr="data-state"
        >
          <Switch.Root>
            <Switch.Control>
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
                <CheckboxGroup.ItemControl>
                  <CheckboxGroup.ItemIndicator>✓</CheckboxGroup.ItemIndicator>
                </CheckboxGroup.ItemControl>
                <CheckboxGroup.ItemLabel>{value}</CheckboxGroup.ItemLabel>
              </CheckboxGroup.Item>
            ))}
          </CheckboxGroup.Root>
        </Specimen>
        <Specimen
          index={5}
          name="Toggle Group"
          slug="toggle-group"
          selector="[aria-pressed]"
          attr="aria-pressed"
        >
          <ToggleGroup.Root aria-label="Format" selectionMode="multiple">
            <ToggleGroup.Item value="bold">Bold</ToggleGroup.Item>
            <ToggleGroup.Item value="italic">Italic</ToggleGroup.Item>
          </ToggleGroup.Root>
        </Specimen>
      </ul>
    </Wave.Provider>
  )
}
