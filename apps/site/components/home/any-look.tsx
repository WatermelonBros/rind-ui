"use client"

import {
  Accordion,
  Avatar,
  Badge,
  Button,
  CheckboxGroup,
  Collapsible,
  SegmentedControl,
  Slider,
  Switch,
  Tabs,
  TextField,
  Toggle,
  ToggleGroup,
} from "@rind-ui/react"
import { type CSSProperties, type ReactNode, useEffect, useRef, useState } from "react"
import { Letters } from "../letters"
import { type Phase, usePhase } from "../phase"
import { cue } from "../sound"
import { type ColourComponent, ColourPlaceholder, type ColourProps } from "./colour-placeholder"
import { handoff } from "./handoff"
import { heroKind, setLookColors, setLookTarget } from "./hero-state"
import styles from "./home.module.css"
import { Reveal } from "./reveal"
import {
  contrast,
  DENSITIES,
  decodeLook,
  encodeLook,
  FILLS,
  FONT_NAMES,
  FONTS,
  LETTERS,
  type Look,
  MOTIONS,
  PATTERNS,
  PRESETS,
  SHADOWS,
  SITE_FONTS,
  sameLook,
  skinCss,
  textOn,
} from "./skins"
import { wear } from "./wear"

/** The brand before the visitor picks one: the site's own, rind green in juicy and lime in crisp. */
const BRAND: Record<Phase, string> = { juicy: "#5cd690", crisp: "#D4FF3A" }

/** Where the builder starts and what Reset returns to: the site's own look (skins.ts). */
const BASE = PRESETS[0]?.look as Look // PRESETS is a non-empty literal list
const SWATCHES = ["#FF3D8B", "#FF8F3D", "#F5D90A", "#2EC27E", "#3D8BFF", "#8B3DFF", "#18181B"]
const ACCENTS = ["#FF8FA3", "#FFC371", "#01CDFE", "#C084FC", "#F2C12E", "#FF00E5", "#71717A"]
const SURFACES = ["#FFFFFF", "#FAF7F0", "#F1EDFF", "#EAF7EE", "#C0C0C0", "#18181B", "#0F172A"]

/** The copied CSS names real families; the preview wears them as this site loads them. */
const siteFonts = (css: string) =>
  FONT_NAMES.reduce((out, f) => out.replaceAll(FONTS[f], SITE_FONTS[f]), css)

/**
 * The same CSS for every rind component on the page while the skin is worn (wear.ts): its tokens
 * on the page, its rules on every skinned part (over the site's own skins) but the builder's
 * own chrome. The page's sections keep their grounds: the root's paint is left out.
 */
function onPage(css: string): string {
  const out: string[] = []
  let root = false
  for (const line of css.split("\n")) {
    if (line === ":root {") {
      root = true
      out.push("html[data-worn] {")
    } else if (root) {
      if (line === "}") {
        root = false
        out.push(line)
        // the site's own skins speak --s-* (skins/base.css): their every part (a label, a
        // panel's copy, a value) takes the worn skin's colours too, never one phase's ink on
        // another skin's ground, and its shape (borders, radii, lifts) never juicy's pink edge;
        // over the wall's cards too, whose wave writes its skins inline
        out.push(`html[data-worn] [data-skinned]:not([data-skin="bare"]) {
  --s-bg: var(--skin-surface) !important;
  --s-ink: var(--skin-ink) !important;
  --s-acc: var(--skin-brand) !important;
  --s-acc-deep: var(--skin-brand) !important;
  --s-on: var(--skin-fill-text) !important;
  --s-card: var(--skin-card) !important;
  --s-muted: var(--skin-muted) !important;
  --s-line: var(--skin-line) !important;
  --s-field-line: var(--skin-line) !important;
  --s-brand: var(--skin-brand) !important;
  --s-brand-text: var(--skin-fill-text) !important;
  --s-brand-deep: var(--skin-brand) !important;
  --s-ok: var(--skin-ink) !important;
  --s-focus: var(--skin-brand) !important;
  --s-font: var(--skin-font) !important;
  --s-bw: var(--skin-border) !important;
  --s-r: var(--skin-radius) !important;
  --s-r-sm: var(--skin-radius-sm) !important;
  --s-lift: var(--skin-shadow) !important;
  --s-lift-hi: var(--skin-shadow) !important;
  --s-lift-lo: var(--skin-shadow) !important;
  color: var(--skin-ink);
}`)
        continue
      }
      if (!/^\s*(background|color|font):/.test(line)) out.push(line)
    } else if (line.endsWith("{") && !line.trimStart().startsWith("/*"))
      out.push(`html[data-worn] [data-skinned]:not([data-skin="bare"]) ${line}`)
    else out.push(line)
  }
  return out.join("\n")
}

/** The same CSS, scoped to the stage: `:root` becomes the stage, every rule stays as written. */
const scoped = (css: string) => `@scope ([data-look]) {\n${css.replace(":root {", ":scope {")}\n}`

/** Comments, selectors, properties and values in their own colour: the CSS we generate only. */
function highlight(css: string): ReactNode[] {
  let inBlock = false
  return css.split("\n").map((line, i) => {
    const key = `${i}`
    let node: ReactNode = line
    if (line.trimStart().startsWith("/*")) node = <span className={styles.tkCom}>{line}</span>
    else if (line.endsWith("{")) {
      inBlock = true
      node = (
        <>
          <span className={styles.tkSel}>{line.slice(0, -1)}</span>
          {"{"}
        </>
      )
    } else if (line === "}") inBlock = false
    else if (inBlock) {
      const colon = line.indexOf(":")
      node = (
        <>
          <span className={styles.tkProp}>{line.slice(0, colon)}</span>:
          <span className={styles.tkVal}>{line.slice(colon + 1, -1)}</span>
          {";"}
        </>
      )
    }
    return (
      <span key={key}>
        {node}
        {"\n"}
      </span>
    )
  })
}

/** A labelled one-thumb slider of the builder. */
function Tune(props: {
  readonly label: string
  readonly value: number
  readonly max: number
  readonly onChange: (v: number) => void
}) {
  return (
    <Slider.Root
      className={styles.tuneSlider}
      value={props.value}
      min={0}
      max={props.max}
      onValueChange={props.onChange}
    >
      <div className={styles.tuneHead}>
        <Slider.Label>{props.label}</Slider.Label>
        <span className={styles.tuneValue} aria-hidden="true">
          {props.value}px
        </span>
      </div>
      <Slider.Control>
        <Slider.Track>
          <Slider.Indicator />
        </Slider.Track>
        <Slider.Thumb index={0} />
      </Slider.Control>
    </Slider.Root>
  )
}

/** A labelled segmented choice of the builder. */
function Choice<T extends string>(props: {
  readonly label: string
  readonly value: T
  readonly options: readonly T[]
  readonly onChange: (v: T) => void
}) {
  return (
    <div className={styles.tuneChoice}>
      <span className={styles.tuneLabel} aria-hidden="true">
        {props.label}
      </span>
      <SegmentedControl.Root
        aria-label={props.label}
        value={props.value}
        onValueChange={(v) => {
          const next = props.options.find((o) => o === v)
          if (next) props.onChange(next)
        }}
      >
        {props.options.map((o) => (
          <SegmentedControl.Item key={o} value={o}>
            {o}
          </SegmentedControl.Item>
        ))}
        <SegmentedControl.Indicator />
      </SegmentedControl.Root>
    </div>
  )
}

/** The real picker once its module has loaded, its look-alike until then. */
function LazyColour(props: ColourProps & { readonly picker: ColourComponent | null }) {
  const { picker: Picker, ...rest } = props
  return Picker ? <Picker {...rest} /> : <ColourPlaceholder label={rest.label} value={rest.value} />
}

/**
 * Real components with no stylesheet but the one built here: the stage is styled only by the CSS
 * shown below it (scoped to the stage), so what you copy is exactly what you see.
 */
export function AnyLook() {
  const [picked, setLook] = useState<Look>(BASE)
  const { phase } = usePhase()
  const look = { ...picked, brand: picked.brand ?? BRAND[phase] }
  // the hero's travelling object lands on the preview component of its own kind (skin-scene.tsx)
  const stage = useRef<HTMLDivElement>(null)
  // from the machine above: its state leaves the graph as the scene lets go, becomes the
  // selector it is, and lands on the data-* this section styles (desktop only: handoff.ts)
  useEffect(
    () =>
      handoff({
        scene: () => document.querySelector('[aria-labelledby="peel-title"]'),
        // one traveller (two crossed and left a stale one behind): the state the object flies
        // in, checked for a switch or a checkbox, idle for a button (skin-scene.tsx), so the chip
        // and the object beside it say the same thing
        from: () => {
          const nodes = document.querySelectorAll("[data-state-node]")
          const node = nodes[heroKind() === "button" ? 0 : 1]
          return node ? [node] : []
        },
        to: () => [...document.querySelectorAll("[data-states-land]")],
        make: (node) => {
          const pill = document.createElement("span")
          pill.className = styles.statePill ?? ""
          pill.dataset["word"] = node.textContent?.trim() ?? ""
          pill.textContent = pill.dataset["word"]
          return pill
        },
        update: (pill, t) => {
          const word = pill.dataset["word"] ?? ""
          // the state, the selector it is, then the data-* it lands on, as wide as its landing
          // before it turns in under the paragraph
          const text = t > 0.5 ? "data-*" : t > 0.2 ? `[data-state="${word}"]` : word
          if (pill.textContent !== text) pill.textContent = text
          // the word gives way only while the chip rises into it: a swap, never the chip lying
          // over a word already there, nor a gap in the sentence while it is still far away
          // (not once it has landed: the trip goes on to its end after the catch)
          const code = document.querySelector("[data-states-land]")
          if (code && !code.hasAttribute("data-landed"))
            code.toggleAttribute("data-waiting", t > 0.69)
        },
        landed: (code, on) => {
          code.toggleAttribute("data-landed", on)
          if (on) code.removeAttribute("data-waiting")
        },
        leaving: (on) => {
          document.querySelector("[data-state-graph]")?.toggleAttribute("data-left", on)
          if (!on) document.querySelector("[data-states-land]")?.removeAttribute("data-waiting")
        },
        // down the right margin, clear of this section's title and lead
        lane: () => window.innerWidth - 140,
        // then along under the lead, whose last line ends short of the word, and up into it
        under: () =>
          (document.querySelector("[data-states-land]")?.closest("p")?.getBoundingClientRect()
            .bottom ?? 0) + 20,
      }),
    [],
  )
  useEffect(() => {
    const selector = {
      switch: '[data-scope="switch"][data-part="control"]',
      checkbox: '[data-scope="checkbox"][data-part="control"]',
      button: 'button[data-scope="button"]',
    }[heroKind()]
    setLookTarget(stage.current?.querySelector<HTMLElement>(selector) ?? null)
    return () => setLookTarget(null)
  }, [])
  const section = useRef<HTMLElement>(null)
  const [copied, setCopied] = useState<"css" | "link" | null>(null)
  // the visitor has taken over: the builder stops playing its skins by itself
  const touched = useRef(false)
  const set = (patch: Partial<Look>) => {
    const next = { ...picked, ...patch }
    setLook(next)
    setCopied(null)
    touched.current = true
    // a pick is the visitor's: the page wears it (again, after crisp/juicy took it off), except
    // the Rind preset, which is the page's own look (worn, its white ground replaced the page's)
    setOwned(!sameLook(next, BASE))
    setWearing(true)
  }
  const preset = PRESETS.find((p) => sameLook(p.look, picked))
  // the page wears the skin once it is the visitor's own (a press in the builder, a shared
  // link), never one the builder plays by itself; the nav's crisp/juicy takes it off
  const [owned, setOwned] = useState(false)
  const [wearing, setWearing] = useState(true)
  const worn = owned && wearing ? JSON.stringify(look) : ""
  useEffect(
    () =>
      setLookColors({
        brand: look.brand,
        surface: look.surface,
        // only a skin worn on the page dresses the object everywhere; crisp/juicy taking it off
        // the page takes it off the object too (it kept the skin on a crisp page)
        picked: worn !== "",
        // and the rest of it: the object is rebuilt in the skin, not only recoloured
        material: {
          accent: look.accent,
          radius: look.radius,
          border: look.border,
          shadow: look.shadow,
          fill: look.fill,
        },
      }),
    [look.brand, look.surface, look.accent, look.radius, look.border, look.shadow, look.fill, worn],
  )
  // biome-ignore lint/correctness/useExhaustiveDependencies: worn is the look, serialised
  useEffect(() => {
    wear(worn ? look : null)
  }, [worn])
  useEffect(() => () => wear(null), [])
  const firstPhase = useRef(phase)
  useEffect(() => {
    if (phase !== firstPhase.current) setWearing(false)
    firstPhase.current = phase
  }, [phase])
  // the ready skins in a shuffled deck: Surprise me deals the next, every one before a repeat
  const deck = useRef<string[]>([])
  // never the skin on now, nor the one dealt last (a fresh deck could start with it)
  const dealt = useRef("")
  const surprise = () => {
    let id: string | undefined
    for (let tries = 0; tries < PRESETS.length * 2; tries++) {
      if (deck.current.length === 0)
        deck.current = PRESETS.map((p) => p.id).sort(() => Math.random() - 0.5)
      id = deck.current.shift()
      if (id && id !== preset?.id && id !== dealt.current) break
    }
    const next = PRESETS.find((p) => p.id === id)
    if (!next) return undefined
    dealt.current = next.id
    set(next.look)
    cue("reskin", { value: PRESETS.indexOf(next) / (PRESETS.length - 1) })
    return next.id
  }
  // a shared link opens on its skin (#skin=…), the builder brought into view
  // biome-ignore lint/correctness/useExhaustiveDependencies: once, on load
  useEffect(() => {
    const m = /[#&]skin=([\w.-]+)/.exec(window.location.hash)
    const shared = m?.[1] ? decodeLook(m[1]) : null
    if (!shared) return
    set(shared)
    document.getElementById("look-title")?.scrollIntoView({ block: "start" })
  }, [])
  const css = skinCss(look)
  const [picker, setPicker] = useState<ColourComponent | null>(null)
  // load the picker a screen before the builder shows up (or at once without IntersectionObserver)
  useEffect(() => {
    const el = section.current
    if (!el) return
    let gone = false
    const load = () => {
      import("./colour")
        .then((m) => {
          if (!gone) setPicker(() => m.Colour)
        })
        // a failed chunk keeps the plain input: the builder still works
        .catch(() => {})
    }
    if (typeof IntersectionObserver === "undefined") {
      load()
      return
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          io.disconnect()
          load()
        }
      },
      { rootMargin: "600px 0px" },
    )
    io.observe(el)
    return () => {
      gone = true
      io.disconnect()
    }
  }, [])

  return (
    <section ref={section} className={styles.section} aria-labelledby="look-title">
      <Reveal>
        <h2 id="look-title" className={styles.h2}>
          <Letters>Same components. Any skin.</Letters>
        </h2>
        <p className={styles.lead}>
          These are live rind components with no styles of their own. Build a skin, then take the
          CSS: it only targets <code data-states-land="">data-*</code> attributes, so a skin is a
          stylesheet, never a fork.
        </p>
      </Reveal>
      <Reveal className={styles.lookPanel}>
        {/* the builder's own controls are rind components in the site's bare skin */}
        <div
          className={styles.lookPresets}
          data-xray-off=""
          data-skinned=""
          data-skin="bare"
          data-rind-theme="skin-bare"
        >
          <ToggleGroup.Root
            className={styles.presets}
            aria-label="Ready skins"
            value={preset ? [preset.id] : []}
            onValueChange={(v) => {
              const next = PRESETS.find((p) => p.id === v[0])
              if (next) set(next.look)
            }}
          >
            {PRESETS.map((p) => (
              <ToggleGroup.Item key={p.id} value={p.id} className={styles.preset}>
                <span
                  className={styles.presetSwatch}
                  aria-hidden="true"
                  style={
                    {
                      "--a": p.look.brand ?? BRAND[phase],
                      "--b": p.look.surface,
                      "--c": p.look.accent,
                    } as CSSProperties
                  }
                />
                {p.name}
              </ToggleGroup.Item>
            ))}
          </ToggleGroup.Root>
          <div className={styles.tuneActions}>
            <Button onPress={surprise}>Surprise me</Button>
            <Button
              onPress={() => {
                const url = `${window.location.origin}${window.location.pathname}#skin=${encodeLook(picked)}`
                navigator.clipboard?.writeText(url).then(
                  () => setCopied("link"),
                  () => {},
                )
              }}
            >
              {/* both labels hold the button's width: the copied one never moves the row */}
              <span className={styles.swap}>
                <span aria-hidden={copied === "link" ? true : undefined}>Share link</span>
                <span aria-hidden={copied === "link" ? undefined : true}>Link copied</span>
              </span>
            </Button>
            <Button
              onPress={() => {
                set(BASE)
                setOwned(false)
              }}
            >
              Reset
            </Button>
            {/* the visitor's skin on the whole page, nav and titles and all (wear.ts) */}
            <Switch.Root
              checked={wearing}
              onCheckedChange={setWearing}
              className={styles.wearSwitch}
            >
              <Switch.Control>
                <Switch.Thumb />
              </Switch.Control>
              <Switch.Label>Wear it on the page</Switch.Label>
            </Switch.Root>
          </div>
        </div>
        <style>{scoped(siteFonts(css))}</style>
        {worn ? <style>{onPage(siteFonts(css))}</style> : null}
        <div className={styles.lookBody}>
          <div ref={stage} className={styles.lookStage} data-look="">
            <div className={styles.lookSticky}>
              <div className={styles.lookGrid}>
                {/* a profile's head: who it is, and its plan */}
                <div className={styles.lookWho}>
                  {/* beside the person's visible name, which names it */}
                  <Avatar.Root aria-hidden="true">
                    <Avatar.Fallback>AV</Avatar.Fallback>
                  </Avatar.Root>
                  <span>
                    <b>Ada Vance</b>
                    <small>@ada</small>
                  </span>
                  <Badge.Root>Pro</Badge.Root>
                </div>
                <div className={styles.lookCol}>
                  <TextField.Root name="handle">
                    <TextField.Label>Handle</TextField.Label>
                    <TextField.Input placeholder="@you" />
                  </TextField.Root>
                  <Slider.Root defaultValue={60} min={0} max={100}>
                    <Slider.Label>Volume</Slider.Label>
                    <Slider.Control>
                      <Slider.Track>
                        <Slider.Indicator />
                      </Slider.Track>
                      <Slider.Thumb index={0} />
                    </Slider.Control>
                  </Slider.Root>
                  <Switch.Root defaultChecked>
                    <Switch.Control>
                      <Switch.Thumb />
                    </Switch.Control>
                    <Switch.Label>Notifications</Switch.Label>
                  </Switch.Root>
                  <CheckboxGroup.Item defaultChecked>
                    <CheckboxGroup.ItemControl>
                      <CheckboxGroup.ItemIndicator>✓</CheckboxGroup.ItemIndicator>
                    </CheckboxGroup.ItemControl>
                    <CheckboxGroup.ItemLabel>Keyboard support</CheckboxGroup.ItemLabel>
                  </CheckboxGroup.Item>
                  <div className={styles.lookRow}>
                    <Button>
                      Save <span aria-hidden="true">→</span>
                    </Button>
                    <Toggle.Root defaultPressed>Bold</Toggle.Root>
                  </div>
                </div>
                <Accordion.Root defaultValue={["what"]}>
                  {[
                    [
                      "what",
                      "What do I get?",
                      "Behaviour, keyboard, ARIA, state and a test driver.",
                    ],
                    [
                      "css",
                      "And the CSS?",
                      "Yours. Write it on data-scope, data-part and data-state.",
                    ],
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
                        <p>{text}</p>
                      </Accordion.Content>
                    </Accordion.Item>
                  ))}
                </Accordion.Root>
              </div>
            </div>
          </div>
          <div
            className={styles.lookControls}
            data-xray-off=""
            data-skinned=""
            data-skin="bare"
            data-rind-theme="skin-bare"
          >
            {/* four short tabs, not one long rack: the preview beside it keeps its height */}
            <Tabs.Root defaultValue="colour" className={styles.rackTabs}>
              <Tabs.List aria-label="Skin settings">
                <Tabs.Tab value="colour">Colour</Tabs.Tab>
                <Tabs.Tab value="shape">Shape</Tabs.Tab>
                <Tabs.Tab value="type">Type</Tabs.Tab>
                <Tabs.Tab value="feel">Feel</Tabs.Tab>
                <Tabs.Indicator />
              </Tabs.List>
              <Tabs.Panel value="colour" className={styles.rackPanel}>
                <div className={styles.tuneGroup}>
                  <LazyColour
                    label="Brand"
                    value={look.brand}
                    swatches={SWATCHES}
                    picker={picker}
                    onChange={(brand) => set({ brand })}
                  />
                  <LazyColour
                    label="Accent"
                    value={look.accent}
                    swatches={ACCENTS}
                    picker={picker}
                    onChange={(accent) => set({ accent })}
                  />
                  <LazyColour
                    label="Surface"
                    value={look.surface}
                    swatches={SURFACES}
                    picker={picker}
                    onChange={(surface) => set({ surface })}
                  />
                </div>
                {/* the brand's ramp, and how the three read together, measured (WCAG) */}
                <div
                  className={styles.ramp}
                  aria-hidden="true"
                  style={{ "--b": look.brand } as CSSProperties}
                >
                  {[12, 28, 46, 64, 82, 100].map((k) => (
                    <i key={k} style={{ "--k": `${k}%` } as CSSProperties} />
                  ))}
                </div>
                <ul className={styles.checks} aria-label="Contrast">
                  {(
                    [
                      ["Text on surface", textOn(look.surface), look.surface, 4.5],
                      ["Text on brand", textOn(look.brand), look.brand, 4.5],
                      ["Brand on surface", look.brand, look.surface, 3],
                    ] as const
                  ).map(([name, fg, bg, need]) => {
                    const ratio = contrast(fg, bg)
                    return (
                      <li key={name} data-pass={ratio >= need ? "" : undefined}>
                        <span>{name}</span>
                        <b>{ratio.toFixed(1)}:1</b>
                        <small>{ratio >= need ? "AA ✓" : `below ${need}:1`}</small>
                      </li>
                    )
                  })}
                </ul>
              </Tabs.Panel>
              <Tabs.Panel value="shape" className={styles.rackPanel}>
                <div className={styles.tuneGroup}>
                  <Tune
                    label="Radius"
                    value={look.radius}
                    max={28}
                    onChange={(v) => set({ radius: v })}
                  />
                  <Tune
                    label="Border"
                    value={look.border}
                    max={4}
                    onChange={(v) => set({ border: v })}
                  />
                </div>
                <Choice
                  label="Shadow"
                  value={look.shadow}
                  options={SHADOWS}
                  onChange={(v) => set({ shadow: v })}
                />
                <Choice
                  label="Fill"
                  value={look.fill}
                  options={FILLS}
                  onChange={(v) => set({ fill: v })}
                />
              </Tabs.Panel>
              <Tabs.Panel value="type" className={styles.rackPanel}>
                <Choice
                  label="Font"
                  value={look.font}
                  options={FONT_NAMES}
                  onChange={(v) => set({ font: v })}
                />
                <Choice
                  label="Case"
                  value={look.letters}
                  options={LETTERS}
                  onChange={(v) => set({ letters: v })}
                />
              </Tabs.Panel>
              <Tabs.Panel value="feel" className={styles.rackPanel}>
                <Choice
                  label="Ground"
                  value={look.pattern}
                  options={PATTERNS}
                  onChange={(v) => set({ pattern: v })}
                />
                <Choice
                  label="Density"
                  value={look.density}
                  options={DENSITIES}
                  onChange={(v) => set({ density: v })}
                />
                <Choice
                  label="Motion"
                  value={look.motion}
                  options={MOTIONS}
                  onChange={(v) => set({ motion: v })}
                />
              </Tabs.Panel>
            </Tabs.Root>
          </div>
        </div>
        {/* the stylesheet is there on demand: open, its scrolling box sat in the page's path */}
        <Collapsible.Root className={styles.lookCode}>
          <div className={styles.lookCodeBar}>
            <Collapsible.Trigger>
              <Collapsible.Indicator>▸</Collapsible.Indicator>
              Show skin.css
            </Collapsible.Trigger>
            <span data-skinned="" data-skin="bare" data-rind-theme="skin-bare">
              <Button
                onPress={() => {
                  navigator.clipboard?.writeText(css).then(
                    () => setCopied("css"),
                    () => {},
                  )
                }}
              >
                {copied === "css" ? "Copied" : "Copy"}
              </Button>
            </span>
          </div>
          <Collapsible.Content render={<section aria-label="skin.css" />}>
            <pre
              className={styles.lookPre}
              // biome-ignore lint/a11y/noNoninteractiveTabindex: a scrollable region must be reachable by keyboard
              tabIndex={0}
            >
              <code>{highlight(css)}</code>
            </pre>
          </Collapsible.Content>
        </Collapsible.Root>
      </Reveal>
    </section>
  )
}
