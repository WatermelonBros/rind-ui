"use client"

import { formatColor } from "@rind-ui/core"
import {
  Accordion,
  Button,
  CheckboxGroup,
  ColorPicker,
  SegmentedControl,
  Slider,
  Switch,
  TextField,
  Toggle,
} from "@rind-ui/react"
import { type ReactNode, useState } from "react"
import styles from "./home.module.css"
import { Reveal } from "./reveal"

type Shadow = "flat" | "soft" | "hard"
type Font = "sans" | "serif" | "mono" | "rounded"
type Density = "compact" | "cozy" | "roomy"

interface Look {
  readonly brand: string
  readonly surface: string
  readonly radius: number
  readonly border: number
  readonly shadow: Shadow
  readonly font: Font
  readonly density: Density
}

/** Where the builder starts and what Reset returns to: a plain, neutral look. */
const BASE: Look = {
  brand: "#18181B",
  surface: "#FFFFFF",
  radius: 8,
  border: 1,
  shadow: "flat",
  font: "sans",
  density: "cozy",
}
const SWATCHES = ["#FF3D8B", "#FF8F3D", "#F5D90A", "#2EC27E", "#3D8BFF", "#8B3DFF", "#18181B"]
const SURFACES = ["#FFFFFF", "#FAF7F0", "#F1EDFF", "#EAF7EE", "#18181B", "#0F172A"]
const SHADOWS: Record<Shadow, string> = {
  flat: "none",
  soft: "0 1px 2px rgb(0 0 0 / 0.12), 0 8px 20px rgb(0 0 0 / 0.1)",
  hard: "3px 3px 0 var(--skin-ink)",
}
// system stacks, so the copied CSS renders the same anywhere: no web font to load
const FONTS: Record<Font, string> = {
  sans: "system-ui, sans-serif",
  serif: "ui-serif, Georgia, serif",
  mono: "ui-monospace, Menlo, monospace",
  rounded: "ui-rounded, 'SF Pro Rounded', system-ui, sans-serif",
}
const DENSITY: Record<Density, readonly [number, number, number]> = {
  compact: [6, 10, 10],
  cozy: [9, 14, 14],
  roomy: [12, 18, 20],
}

/** Ink or white, whichever reads better on `hex` (WCAG relative luminance). */
function textOn(hex: string): string {
  const [r = 0, g = 0, b = 0] = [1, 3, 5].map((i) => {
    const c = Number.parseInt(hex.slice(i, i + 2), 16) / 255
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  const l = 0.2126 * r + 0.7152 * g + 0.0722 * b
  // contrast against white vs against near-black ink; pick the larger
  return 1.05 / (l + 0.05) >= (l + 0.05) / 0.055 ? "#FFFFFF" : "#18181B"
}

const pick = <T,>(list: readonly T[]): T => list[Math.floor(Math.random() * list.length)] as T

/** The whole skin: tokens on `:root`, then rules on rind's attributes and nothing else. */
function skinCss(look: Look): string {
  const [py, px, gap] = DENSITY[look.density]
  return `/* skin.css: the whole look of the components above */
:root {
  --skin-brand: ${look.brand.toLowerCase()};
  --skin-brand-text: ${textOn(look.brand).toLowerCase()};
  --skin-surface: ${look.surface.toLowerCase()};
  --skin-ink: ${textOn(look.surface).toLowerCase()};
  --skin-line: color-mix(in oklab, var(--skin-ink) 20%, var(--skin-surface));
  --skin-muted: color-mix(in oklab, var(--skin-ink) 7%, var(--skin-surface));
  --skin-radius: ${look.radius}px;
  --skin-radius-sm: ${Math.round(look.radius * 0.6)}px;
  --skin-border: ${look.border}px;
  --skin-shadow: ${SHADOWS[look.shadow]};
  --skin-font: ${FONTS[look.font]};
  --skin-pad-y: ${py}px;
  --skin-pad-x: ${px}px;
  --skin-gap: ${gap}px;
  background: var(--skin-surface);
  color: var(--skin-ink);
  font: 15px / 1.4 var(--skin-font);
}
[data-scope]:focus-visible {
  outline: 2px solid var(--skin-brand);
  outline-offset: 2px;
}

/* Text field */
[data-scope="text-field"][data-part="root"] {
  display: grid;
  gap: 6px;
}
[data-scope="text-field"][data-part="label"] {
  font-weight: 600;
  font-size: 14px;
}
[data-scope="text-field"][data-part="input"] {
  font: inherit;
  color: inherit;
  padding: var(--skin-pad-y) var(--skin-pad-x);
  background: var(--skin-muted);
  border: var(--skin-border) solid var(--skin-line);
  border-radius: var(--skin-radius-sm);
}
[data-scope="text-field"][data-part="input"]:focus-visible {
  outline-offset: 0;
}

/* Switch */
[data-scope="switch"][data-part="root"] {
  display: inline-flex;
  align-items: center;
  gap: 10px;
}
[data-scope="switch"][data-part="control"] {
  display: inline-flex;
  align-items: center;
  box-sizing: border-box;
  inline-size: 44px;
  block-size: 26px;
  padding: 3px;
  border: var(--skin-border) solid var(--skin-line);
  border-radius: 99px;
  background: var(--skin-line);
  transition: background-color 0.2s;
}
[data-scope="switch"][data-part="control"][data-state="checked"] {
  background: var(--skin-brand);
  border-color: var(--skin-brand);
}
[data-scope="switch"][data-part="thumb"] {
  inline-size: 18px;
  block-size: 18px;
  border-radius: 50%;
  background: var(--skin-surface);
  box-shadow: var(--skin-shadow);
  transition: translate 0.2s;
}
[data-scope="switch"][data-part="thumb"][data-state="checked"] {
  translate: calc(44px - 18px - 6px - 2 * var(--skin-border)) 0;
}

/* Checkbox */
[data-scope="checkbox"][data-part="root"] {
  display: inline-flex;
  align-items: center;
  gap: 10px;
}
[data-scope="checkbox"][data-part="control"] {
  display: grid;
  place-items: center;
  box-sizing: border-box;
  inline-size: 20px;
  block-size: 20px;
  border: max(1px, var(--skin-border)) solid var(--skin-line);
  border-radius: min(6px, var(--skin-radius-sm));
  background: var(--skin-surface);
  color: var(--skin-brand-text);
  font-size: 13px;
  transition: background-color 0.2s, border-color 0.2s;
}
[data-scope="checkbox"][data-part="control"][data-state="checked"] {
  background: var(--skin-brand);
  border-color: var(--skin-brand);
}
[data-scope="checkbox"][data-part="indicator"][data-state="unchecked"] {
  visibility: hidden;
}

/* Button and toggle */
:is([data-scope="button"][data-part="root"], [data-scope="toggle"][data-part="root"]) {
  font: 600 14px var(--skin-font);
  padding: var(--skin-pad-y) calc(var(--skin-pad-x) + 4px);
  border: var(--skin-border) solid var(--skin-line);
  border-radius: var(--skin-radius-sm);
  box-shadow: var(--skin-shadow);
  cursor: pointer;
  transition: background-color 0.2s, translate 0.1s;
}
[data-scope="button"][data-part="root"] {
  background: var(--skin-brand);
  border-color: var(--skin-brand);
  color: var(--skin-brand-text);
}
[data-scope="button"][data-part="root"][data-hover] {
  background: color-mix(in oklab, var(--skin-brand) 85%, var(--skin-ink));
}
[data-scope="toggle"][data-part="root"] {
  background: var(--skin-muted);
  color: var(--skin-ink);
}
[data-scope="toggle"][data-part="root"][data-state="on"] {
  background: var(--skin-ink);
  border-color: var(--skin-ink);
  color: var(--skin-surface);
}
:is([data-scope="button"][data-part="root"], [data-scope="toggle"][data-part="root"])[data-pressed] {
  translate: 0 1px;
}

/* Accordion */
[data-scope="accordion"][data-part="root"] {
  border: var(--skin-border) solid var(--skin-line);
  border-radius: var(--skin-radius);
  background: var(--skin-surface);
  box-shadow: var(--skin-shadow);
  overflow: hidden;
}
[data-scope="accordion"][data-part="item"] + [data-part="item"] {
  border-top: max(1px, var(--skin-border)) solid var(--skin-line);
}
[data-scope="accordion"][data-part="header"] {
  margin: 0;
}
[data-scope="accordion"][data-part="trigger"] {
  display: flex;
  justify-content: space-between;
  align-items: center;
  inline-size: 100%;
  padding: calc(var(--skin-pad-y) + 4px) var(--skin-pad-x);
  border: 0;
  background: none;
  color: inherit;
  font: 600 15px var(--skin-font);
  text-align: start;
  cursor: pointer;
}
[data-scope="accordion"][data-part="indicator"] {
  transition: rotate 0.2s;
}
[data-scope="accordion"][data-part="indicator"][data-state="open"] {
  rotate: 45deg;
}
[data-scope="accordion"][data-part="content"] > p {
  margin: 0;
  padding: 0 var(--skin-pad-x) calc(var(--skin-pad-y) + 6px);
  color: color-mix(in oklab, var(--skin-ink) 72%, var(--skin-surface));
}`
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

/** A labelled colour of the builder: a swatch that opens a picker. */
function Colour(props: {
  readonly label: string
  readonly value: string
  readonly swatches: readonly string[]
  readonly onChange: (hex: string) => void
}) {
  return (
    <ColorPicker.Root
      className={styles.tuneColor}
      value={props.value}
      onValueChange={(c) => props.onChange(formatColor(c, "hex"))}
    >
      <ColorPicker.Label>{props.label}</ColorPicker.Label>
      <ColorPicker.Control>
        <ColorPicker.Trigger>
          <ColorPicker.ValueSwatch />
        </ColorPicker.Trigger>
        <ColorPicker.ValueText />
      </ColorPicker.Control>
      <ColorPicker.Portal>
        <ColorPicker.Positioner>
          <ColorPicker.Content>
            <ColorPicker.Area>
              <ColorPicker.AreaBackground />
              <ColorPicker.AreaThumb />
            </ColorPicker.Area>
            <ColorPicker.ChannelSlider channel="hue">
              <ColorPicker.ChannelSliderTrack>
                <ColorPicker.ChannelSliderThumb />
              </ColorPicker.ChannelSliderTrack>
            </ColorPicker.ChannelSlider>
            <ColorPicker.SwatchGroup>
              {props.swatches.map((c) => (
                <ColorPicker.SwatchTrigger key={c} color={c}>
                  <ColorPicker.Swatch color={c} aria-hidden="true" />
                  <ColorPicker.SwatchIndicator />
                </ColorPicker.SwatchTrigger>
              ))}
            </ColorPicker.SwatchGroup>
            <ColorPicker.ChannelInput channel="hex" />
          </ColorPicker.Content>
        </ColorPicker.Positioner>
      </ColorPicker.Portal>
    </ColorPicker.Root>
  )
}

/**
 * Real components with no stylesheet but the one built here: the stage is styled only by the CSS
 * shown below it (scoped to the stage), so what you copy is exactly what you see.
 */
export function AnyLook() {
  const [look, setLook] = useState<Look>(BASE)
  const [copied, setCopied] = useState(false)
  const set = (patch: Partial<Look>) => {
    setLook((l) => ({ ...l, ...patch }))
    setCopied(false)
  }
  const css = skinCss(look)

  return (
    <section className={styles.section} aria-labelledby="look-title">
      <Reveal>
        <h2 id="look-title" className={styles.h2}>
          Same components. Any skin.
        </h2>
        <p className={styles.lead}>
          These are live rind components with no styles of their own. Build a skin, then take the
          CSS: it only targets <code>data-*</code> attributes, so a skin is a stylesheet, never a
          fork.
        </p>
      </Reveal>
      <Reveal className={styles.lookPanel}>
        {/* the builder's own controls are rind components in the site's bare skin */}
        <div
          className={styles.lookControls}
          data-skinned=""
          data-skin="bare"
          data-rind-theme="skin-bare"
        >
          <Colour
            label="Brand"
            value={look.brand}
            swatches={SWATCHES}
            onChange={(brand) => set({ brand })}
          />
          <Colour
            label="Surface"
            value={look.surface}
            swatches={SURFACES}
            onChange={(surface) => set({ surface })}
          />
          <Tune label="Radius" value={look.radius} max={28} onChange={(v) => set({ radius: v })} />
          <Tune label="Border" value={look.border} max={4} onChange={(v) => set({ border: v })} />
          <Choice
            label="Shadow"
            value={look.shadow}
            options={["flat", "soft", "hard"] as const}
            onChange={(v) => set({ shadow: v })}
          />
          <Choice
            label="Font"
            value={look.font}
            options={["sans", "serif", "mono", "rounded"] as const}
            onChange={(v) => set({ font: v })}
          />
          <Choice
            label="Density"
            value={look.density}
            options={["compact", "cozy", "roomy"] as const}
            onChange={(v) => set({ density: v })}
          />
          <div className={styles.tuneActions}>
            <Button
              onPress={() =>
                set({
                  brand: pick(SWATCHES),
                  surface: pick(SURFACES),
                  radius: pick([0, 4, 8, 14, 22, 28]),
                  border: pick([0, 1, 2, 3]),
                  shadow: pick(["flat", "soft", "hard"] as const),
                  font: pick(["sans", "serif", "mono", "rounded"] as const),
                  density: pick(["compact", "cozy", "roomy"] as const),
                })
              }
            >
              Surprise me
            </Button>
            <Button onPress={() => set(BASE)}>Reset</Button>
          </div>
        </div>
        <style>{scoped(css)}</style>
        <div className={styles.lookStage} data-look="">
          <div className={styles.lookGrid}>
            <div className={styles.lookCol}>
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
              <CheckboxGroup.Item defaultChecked>
                <CheckboxGroup.ItemControl>
                  <CheckboxGroup.ItemIndicator>✓</CheckboxGroup.ItemIndicator>
                </CheckboxGroup.ItemControl>
                <CheckboxGroup.ItemLabel>Keyboard support</CheckboxGroup.ItemLabel>
              </CheckboxGroup.Item>
              <div className={styles.lookRow}>
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
                    <p>{text}</p>
                  </Accordion.Content>
                </Accordion.Item>
              ))}
            </Accordion.Root>
          </div>
        </div>
        <section className={styles.lookCode} aria-label="skin.css">
          <div className={styles.lookCodeBar}>
            <span>skin.css</span>
            <span data-skinned="" data-skin="bare" data-rind-theme="skin-bare">
              <Button
                onPress={() => {
                  navigator.clipboard?.writeText(css).then(
                    () => setCopied(true),
                    () => {},
                  )
                }}
              >
                {copied ? "Copied" : "Copy"}
              </Button>
            </span>
          </div>
          <pre
            className={styles.lookPre}
            // biome-ignore lint/a11y/noNoninteractiveTabindex: a scrollable region must be reachable by keyboard
            tabIndex={0}
          >
            <code>{highlight(css)}</code>
          </pre>
        </section>
      </Reveal>
    </section>
  )
}
