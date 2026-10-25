/** @jsxImportSource solid-js */
// The Slider contract model (React's matrix) against the Solid parts, a form submission and
// reset, and markup parity.
import { platforms, sliderContract } from "@rind-ui/core"
import * as R from "@rind-ui/react"
import { currentRun, sliderStepInvariants, testMachine } from "@rind-ui/testing"
import { screen } from "@testing-library/dom"
import axe from "axe-core"
import { createElement as r } from "react"
import { createSignal, For, type JSX } from "solid-js"
import { describe, expect, it, vi } from "vitest"
import { mount } from "../../fixtures/mount"
import { clientParity } from "../../fixtures/parity"
import { RindProvider, Slider, type SliderRootProps, type SliderValue } from "../index"

const inJsdom = navigator.userAgent.includes("jsdom")
const a11y = async () => {
  const { violations } = await axe.run(document.body, {
    rules: { region: { enabled: false }, "color-contrast": { enabled: false } },
  })
  if (violations.length > 0) throw new Error(violations.map((v) => `${v.id}: ${v.help}`).join("\n"))
}
const base = {
  value: undefined,
  defaultValue: undefined,
  min: undefined,
  max: undefined,
  step: undefined,
  largeStep: undefined,
  minStepsBetweenThumbs: undefined,
  disabled: undefined,
  readOnly: undefined,
  thumbDisabled: undefined,
}
/** jsdom has no layout: the drag steps are walked in browser mode only. */
const contract = inJsdom
  ? {
      ...sliderContract,
      events: {
        ...sliderContract.events,
        "POINTER.DOWN": { skip: "no layout in jsdom: walked in browser mode" },
      },
    }
  : sliderContract

type P = Record<string, unknown>
const controlStyle = (p: P) =>
  p["orientation"] === "vertical"
    ? { width: "20px", height: "200px" }
    : { width: "200px", height: "20px", margin: "8px 0" }
const THUMB = { width: "16px", height: "16px", "--rind-slider-thumb-size": "16px" }
const slider = (thumbs: number, p: P, disabledThumb?: number): JSX.Element => (
  <Slider.Root name="v" {...(p as SliderRootProps)}>
    <Slider.Label>Volume</Slider.Label>
    <Slider.ValueText />
    <Slider.Control style={controlStyle(p)}>
      <Slider.Track style={{ position: "absolute", inset: "0" }}>
        <Slider.Indicator />
      </Slider.Track>
      <For each={Array.from({ length: thumbs }, (_, i) => i)}>
        {(i) => <Slider.Thumb index={i} disabled={i === disabledThumb} style={THUMB} />}
      </For>
    </Slider.Control>
  </Slider.Root>
)
const reactSlider = (thumbs: number, p: P, disabledThumb?: number) =>
  r(
    R.Slider.Root,
    { name: "v", ...p } as never,
    r(R.Slider.Label, null, "Volume"),
    r(R.Slider.ValueText),
    r(
      R.Slider.Control,
      { style: controlStyle(p) },
      r(R.Slider.Track, { style: { position: "absolute", inset: "0" } }, r(R.Slider.Indicator)),
      Array.from({ length: thumbs }, (_, i) =>
        r(R.Slider.Thumb, {
          key: i,
          index: i,
          disabled: i === disabledThumb,
          style: THUMB as never,
        }),
      ),
    ),
  )
const fixture = (thumbs: number, p: P, disabledThumb?: number): JSX.Element => (
  <form>
    {slider(thumbs, p, disabledThumb)}
    <button type="reset">Reset</button>
  </form>
)

/** Controlled by a parent that applies every proposal (the oracle runs uncontrolled). */
function Applying(props: { initial: number[]; commit: () => void }) {
  const [value, setValue] = createSignal<SliderValue>(props.initial)
  return fixture(props.initial.length, {
    get value() {
      return value()
    },
    defaultValue: props.initial,
    onValueChange: (v: SliderValue) => setValue(v),
    onValueCommit: props.commit,
  })
}
interface Config {
  readonly name: string
  readonly props: P
  readonly ui: (commit: () => void) => JSX.Element
}
const configs: Config[] = [
  {
    name: "single, uncontrolled",
    props: { defaultValue: [20] },
    ui: (c) => fixture(1, { defaultValue: 20, onValueCommit: c }),
  },
  ...(["stop", "push", "swap"] as const).map((policy) => ({
    name: `range [20, 80], gap 2, ${policy}`,
    props: { defaultValue: [20, 80], minStepsBetweenThumbs: 2, thumbCollision: policy },
    ui: (c: () => void) =>
      fixture(2, {
        defaultValue: [20, 80],
        minStepsBetweenThumbs: 2,
        thumbCollision: policy,
        onValueCommit: c,
      }),
  })),
  {
    name: "vertical",
    props: { defaultValue: [20] },
    ui: (c) => fixture(1, { defaultValue: 20, orientation: "vertical", onValueCommit: c }),
  },
  {
    name: "read-only",
    props: { defaultValue: [20], readOnly: true },
    ui: (c) => fixture(1, { defaultValue: 20, readOnly: true, onValueCommit: c }),
  },
  {
    name: "first thumb disabled",
    props: { defaultValue: [20, 80], thumbDisabled: [true, false] },
    ui: (c) => fixture(2, { defaultValue: [20, 80], onValueCommit: c }, 0),
  },
  {
    name: "contain",
    props: { defaultValue: [20] },
    ui: (c) => fixture(1, { defaultValue: 20, thumbAlignment: "contain", onValueCommit: c }),
  },
  {
    name: "controlled, applying",
    props: { defaultValue: [20] },
    ui: (c) => <Applying initial={[20]} commit={c} />,
  },
]

for (const cfg of configs) {
  describe(`solid slider model: ${cfg.name}`, () => {
    let pageCommits = 0
    let oracleCommits = 0
    const steps = sliderStepInvariants({
      commits: () => pageCommits,
      expectedCommits: () => oracleCommits,
    })
    testMachine(contract, {
      test: it,
      setup: () => {
        steps.reset()
        pageCommits = 0
        oracleCommits = 0
        return mount(() => (
          <RindProvider
            dir={currentRun()?.direction ?? "ltr"}
            environment={{ platform: currentRun()?.platform ?? platforms.linux }}
          >
            {cfg.ui(() => pageCommits++)}
          </RindProvider>
        ))
      },
      target: () => screen,
      anchor: [{ name: "Volume" }] as never,
      props: { ...base, ...cfg.props, onValueCommit: () => oracleCommits++ } as never,
      ...(inJsdom ? { modalities: ["keyboard"] as const } : {}),
      invariants: steps.invariants,
      a11y,
    })
  })
}

describe("solid slider in a form", () => {
  it("submits every thumb under the name; reset restores the default", async () => {
    mount(() => fixture(2, { defaultValue: [20, 80] }))
    const form = document.querySelector("form") as HTMLFormElement
    expect(new FormData(form).getAll("v")).toEqual(["20", "80"])
    const first = screen.getAllByRole("slider")[0] as HTMLInputElement
    first.focus()
    first.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }))
    await vi.waitFor(() => expect(new FormData(form).getAll("v")).toEqual(["21", "80"]))
    screen.getByRole("button", { name: "Reset" }).click()
    await vi.waitFor(() => expect(new FormData(form).getAll("v")).toEqual(["20", "80"]))
  })
})

describe("Solid Slider matches React", () => {
  it("single, range, vertical, read-only, a disabled thumb, markers, description", async () => {
    const cases: [number, P, P, number?][] = [
      [1, { defaultValue: 20 }, { defaultValue: 20 }],
      [
        2,
        { defaultValue: [20, 80], minStepsBetweenThumbs: 2 },
        { defaultValue: [20, 80], minStepsBetweenThumbs: 2 },
      ],
      [
        1,
        { defaultValue: 30, orientation: "vertical" },
        { defaultValue: 30, orientation: "vertical" },
      ],
      [
        1,
        { defaultValue: 20, readOnly: true, disabled: true },
        { defaultValue: 20, readOnly: true, disabled: true },
      ],
      [
        2,
        { defaultValue: [20, 80], thumbAlignment: "contain" },
        { defaultValue: [20, 80], thumbAlignment: "contain" },
        0,
      ],
    ]
    for (const [thumbs, react, solid, off] of cases) {
      await clientParity(reactSlider(thumbs, react, off), () => slider(thumbs, solid, off))
    }
    await clientParity(
      r(
        R.Slider.Root,
        { defaultValue: 50 },
        r(R.Slider.Label, null, "Level"),
        r(R.Slider.Control, null, r(R.Slider.Thumb, { index: 0 })),
        r(
          R.Slider.MarkerGroup,
          null,
          [0, 50, 100].map((v) => r(R.Slider.Marker, { key: v, value: v })),
        ),
        r(R.Slider.Description, null, "Pick a level"),
      ),
      () => (
        <Slider.Root defaultValue={50}>
          <Slider.Label>Level</Slider.Label>
          <Slider.Control>
            <Slider.Thumb index={0} />
          </Slider.Control>
          <Slider.MarkerGroup>
            <For each={[0, 50, 100]}>{(v) => <Slider.Marker value={v} />}</For>
          </Slider.MarkerGroup>
          <Slider.Description>Pick a level</Slider.Description>
        </Slider.Root>
      ),
    )
  })
})
