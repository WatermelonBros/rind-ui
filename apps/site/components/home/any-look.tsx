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
  ToggleGroup,
} from "@rind-ui/react"
import { type CSSProperties, useState } from "react"
import { usePhase } from "../phase"
import styles from "./home.module.css"
import { Reveal } from "./reveal"

type Skin = "crisp" | "juicy" | "bare"
type Shadow = "flat" | "soft" | "hard"
type Font = "sans" | "round" | "mono"

interface Look {
  readonly brand: string
  readonly radius: number
  readonly border: number
  readonly shadow: Shadow
  readonly font: Font
}

/** Each skin's own values: the builder starts from them and Reset returns to them. */
const BASE: Record<Skin, Look> = {
  crisp: { brand: "#0B0B0C", radius: 14, border: 3, shadow: "hard", font: "sans" },
  juicy: { brand: "#FF8FB1", radius: 22, border: 0, shadow: "soft", font: "round" },
  bare: { brand: "#18181B", radius: 8, border: 1, shadow: "flat", font: "sans" },
}
const SWATCHES = ["#FF3D8B", "#FF8F3D", "#F5D90A", "#2EC27E", "#3D8BFF", "#8B3DFF", "#0B0B0C"]
const SHADOWS: Record<Shadow, readonly [string, string, string]> = {
  flat: ["none", "none", "none"],
  soft: ["0 1px 2px #0b0b0c1f", "0 6px 16px #0b0b0c24", "0 14px 34px #0b0b0c2e"],
  hard: ["1px 1px 0 var(--s-ink)", "4px 4px 0 var(--s-ink)", "6px 6px 0 var(--s-ink)"],
}
const FONTS: Record<Font, string> = {
  sans: "var(--font-inter), system-ui, sans-serif",
  round: "var(--font-fredoka), system-ui, sans-serif",
  mono: "var(--font-mono), ui-monospace, monospace",
}
const FONT_NAMES: Record<Font, string> = { sans: "Inter", round: "Fredoka", mono: "JetBrains Mono" }

/** Ink or white, whichever reads better on `hex` (WCAG relative luminance). */
function textOn(hex: string): string {
  const [r = 0, g = 0, b = 0] = [1, 3, 5].map((i) => {
    const c = Number.parseInt(hex.slice(i, i + 2), 16) / 255
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  const l = 0.2126 * r + 0.7152 * g + 0.0722 * b
  // contrast against white vs against near-black ink; pick the larger
  return 1.05 / (l + 0.05) >= (l + 0.05) / 0.055 ? "#FFFFFF" : "#0B0B0C"
}

const pick = <T,>(list: readonly T[]): T => list[Math.floor(Math.random() * list.length)] as T

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

/** One set of real components; the reader builds a skin live, with rind, and takes its CSS. */
export function AnyLook() {
  const { phase } = usePhase()
  const [picked, setPicked] = useState<Skin | null>(null)
  const skin = picked ?? phase
  // only what the reader changed; the rest is the skin's own value
  const [own, setOwn] = useState<Partial<Look>>({})
  const [copied, setCopied] = useState(false)
  const look: Look = { ...BASE[skin], ...own }
  const set = (patch: Partial<Look>) => {
    setOwn((o) => ({ ...o, ...patch }))
    setCopied(false)
  }

  const [lo, mid, hi] = SHADOWS[look.shadow]
  const tokens: (readonly [string, string])[] = [
    ["--s-brand", look.brand],
    ["--s-brand-text", textOn(look.brand)],
    ["--s-brand-deep", `color-mix(in oklab, ${look.brand} 70%, #000)`],
    ["--s-r", `${look.radius}px`],
    ["--s-r-sm", `${Math.round(look.radius * 0.6)}px`],
    ["--s-bw", `${look.border}px`],
    ["--s-lift-lo", lo],
    ["--s-lift", mid],
    ["--s-lift-hi", hi],
    ["--s-font", FONTS[look.font]],
  ]
  const vars = Object.fromEntries(tokens) as CSSProperties
  const css = `/* your skin: tokens, then rules on rind's attributes */
[data-skin="mine"] {
${tokens
  .filter(([k]) => k !== "--s-font")
  .map(([k, v]) => `  ${k}: ${v};`)
  .join("\n")}
  --s-font: "${FONT_NAMES[look.font]}", system-ui;
}
[data-scope="button"][data-part="root"] {
  background: var(--s-brand);
  color: var(--s-brand-text);
  border: var(--s-bw) solid var(--s-ink);
  border-radius: var(--s-r-sm);
  box-shadow: var(--s-lift);
}
[data-scope="switch"][data-part="control"][data-state="checked"] {
  background: var(--s-brand);
}`

  return (
    <section className={styles.section} aria-labelledby="look-title">
      <Reveal>
        <p className={styles.kicker}>The look is yours</p>
        <h2 id="look-title" className={styles.h2}>
          Same components. Any skin.
        </h2>
        <p className={styles.lead}>
          These are live rind components. Build a skin, with rind components too, then take the CSS:
          it only targets <code>data-*</code> attributes, so a skin is a stylesheet, never a fork.
        </p>
      </Reveal>
      <Reveal className={styles.lookPanel}>
        {/* the builder's own controls are rind components in the neutral bare skin */}
        <div
          className={styles.lookControls}
          data-skinned=""
          data-skin="bare"
          data-rind-theme="skin-bare"
        >
          <Choice
            label="Start from"
            value={skin}
            options={["crisp", "juicy", "bare"] as const}
            onChange={(s) => {
              setPicked(s)
              setOwn({})
            }}
          />
          <ColorPicker.Root
            className={styles.tuneColor}
            value={look.brand}
            onValueChange={(c) => set({ brand: formatColor(c, "hex") })}
          >
            <ColorPicker.Label>Brand</ColorPicker.Label>
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
                    {SWATCHES.map((c) => (
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
            options={["sans", "round", "mono"] as const}
            onChange={(v) => set({ font: v })}
          />
          <div className={styles.tuneActions}>
            <Button
              onPress={() =>
                set({
                  brand: pick(SWATCHES),
                  radius: pick([0, 4, 8, 14, 22, 28]),
                  border: pick([0, 1, 2, 3, 4]),
                  shadow: pick(["flat", "soft", "hard"] as const),
                  font: pick(["sans", "round", "mono"] as const),
                })
              }
            >
              Surprise me
            </Button>
            <Button onPress={() => setOwn({})}>Reset</Button>
          </div>
        </div>
        <div
          className={styles.lookStage}
          data-view={skin}
          data-skinned=""
          data-skin={skin}
          style={vars}
        >
          <div className={styles.lookGrid}>
            <div className="stack">
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
              <div className="row">
                <Button>Save</Button>
                <ToggleGroup.Item defaultPressed>Bold</ToggleGroup.Item>
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
                    <div className="pad">{text}</div>
                  </Accordion.Content>
                </Accordion.Item>
              ))}
            </Accordion.Root>
          </div>
        </div>
        <div className={styles.lookCode} data-skinned="" data-skin="bare">
          <div className={styles.lookCodeBar}>
            <span>skin.css</span>
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
          </div>
          <pre
            className={styles.lookPre}
            // biome-ignore lint/a11y/noNoninteractiveTabindex: a scrollable region must be reachable by keyboard
            tabIndex={0}
          >
            <code>{css}</code>
          </pre>
        </div>
      </Reveal>
    </section>
  )
}
