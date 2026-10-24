// The Slider contract model (React's matrix) against the Svelte parts, and DOM parity.
import { sliderContract } from "@rind-ui/core"
import * as R from "@rind-ui/react"
import { sliderStepInvariants, testMachine } from "@rind-ui/testing"
import { screen } from "@testing-library/dom"
import axe from "axe-core"
import { createElement as r } from "react"
import { describe, it } from "vitest"
import { mount } from "../../fixtures/mount"
import { clientParity } from "../../fixtures/parity"
import Volume from "../../fixtures/slider/volume.svelte"

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
interface Config {
  readonly name: string
  readonly props: P
  readonly ui: (commit: () => void) => P
}
const configs: Config[] = [
  {
    name: "single, uncontrolled",
    props: { defaultValue: [20] },
    ui: (c) => ({ thumbs: 1, root: { defaultValue: 20, onValueCommit: c } }),
  },
  ...(["stop", "push", "swap"] as const).map((policy) => ({
    name: `range [20, 80], gap 2, ${policy}`,
    props: { defaultValue: [20, 80], minStepsBetweenThumbs: 2, thumbCollision: policy },
    ui: (c: () => void) => ({
      thumbs: 2,
      root: {
        defaultValue: [20, 80],
        minStepsBetweenThumbs: 2,
        thumbCollision: policy,
        onValueCommit: c,
      },
    }),
  })),
  {
    name: "vertical",
    props: { defaultValue: [20] },
    ui: (c) => ({
      thumbs: 1,
      root: { defaultValue: 20, orientation: "vertical", onValueCommit: c },
    }),
  },
  {
    name: "read-only",
    props: { defaultValue: [20], readOnly: true },
    ui: (c) => ({ thumbs: 1, root: { defaultValue: 20, readonly: true, onValueCommit: c } }),
  },
  {
    name: "first thumb disabled",
    props: { defaultValue: [20, 80], thumbDisabled: [true, false] },
    ui: (c) => ({
      thumbs: 2,
      root: { defaultValue: [20, 80], onValueCommit: c },
      disabledThumb: 0,
    }),
  },
  {
    name: "contain",
    props: { defaultValue: [20] },
    ui: (c) => ({
      thumbs: 1,
      root: { defaultValue: 20, thumbAlignment: "contain", onValueCommit: c },
    }),
  },
  {
    name: "controlled, applying",
    props: { defaultValue: [20] },
    ui: (c) => ({ applying: [20], root: { onValueCommit: c } }),
  },
]

for (const cfg of configs) {
  describe(`svelte slider model: ${cfg.name}`, () => {
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
        return mount(Volume, cfg.ui(() => pageCommits++) as never)
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

describe("Svelte Slider matches React", () => {
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
        { defaultValue: 20, readonly: true, disabled: true },
      ],
      [
        2,
        { defaultValue: [20, 80], thumbAlignment: "contain" },
        { defaultValue: [20, 80], thumbAlignment: "contain" },
        0,
      ],
    ]
    for (const [thumbs, react, svelte, off] of cases) {
      await clientParity(reactSlider(thumbs, react, off), Volume, {
        thumbs,
        root: svelte,
        disabledThumb: off,
        provider: false,
      } as never)
    }
    const reactMarked = r(
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
    )
    await clientParity(reactMarked, Volume, { marked: true, provider: false } as never)
  })
})
