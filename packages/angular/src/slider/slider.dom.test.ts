// The Slider contract model (React's matrix) against the Angular parts, and markup parity.
import { Component, signal } from "@angular/core"
import { platforms, sliderContract, type ThumbAlignment, type ThumbCollision } from "@rind-ui/core"
import * as R from "@rind-ui/react"
import { currentRun, sliderStepInvariants, testMachine } from "@rind-ui/testing"
import { screen } from "@testing-library/dom"
import axe from "axe-core"
import { createElement as r } from "react"
import { describe, it } from "vitest"
import { mount } from "../../fixtures/mount"
import { both } from "../../fixtures/parity"
import { RindProvider } from "../provider"
import { Slider, type SliderValue } from "./slider"

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

interface Cfg {
  readonly thumbs: number
  readonly defaultValue?: SliderValue
  readonly minStepsBetweenThumbs?: number
  readonly thumbCollision?: ThumbCollision
  readonly thumbAlignment?: ThumbAlignment
  readonly orientation?: "horizontal" | "vertical"
  readonly readOnly?: boolean
  readonly disabled?: boolean
  readonly disabledThumb?: number
  /** Controlled by a parent that applies every proposal (the oracle runs uncontrolled). */
  readonly applying?: boolean
  readonly form?: boolean
  readonly marked?: boolean
}
/** The configuration the next fixture renders, and the commit counter it reports to. */
let current: { cfg: Cfg; commit: () => void } = { cfg: { thumbs: 1 }, commit: () => {} }

const SLIDER = `<div
      rindSliderRoot
      name="v"
      [value]="value()"
      [defaultValue]="cfg.defaultValue"
      [minStepsBetweenThumbs]="cfg.minStepsBetweenThumbs"
      [thumbCollision]="cfg.thumbCollision"
      [thumbAlignment]="cfg.thumbAlignment ?? 'center'"
      [orientation]="cfg.orientation ?? 'horizontal'"
      [readonly]="cfg.readOnly ?? false"
      [disabled]="cfg.disabled ?? false"
      (valueChange)="apply($event)"
      (valueCommit)="commit()"
    >
      <label rindSliderLabel>Volume</label>
      <div rindSliderValueText></div>
      <div rindSliderControl [style]="controlStyle">
        <div rindSliderTrack style="position: absolute; inset: 0"><div rindSliderIndicator></div></div>
        @for (i of thumbs; track i) {
          <div
            rindSliderThumb
            [index]="i"
            [disabled]="i === cfg.disabledThumb"
            style="width: 16px; height: 16px; --rind-slider-thumb-size: 16px"
          ></div>
        }
      </div>
    </div>`

@Component({
  selector: "rind-f",
  imports: [RindProvider, Slider],
  template: `<ng-container rindProvider [environment]="env" [dir]="dir">
    @if (cfg.marked) {
      <div rindSliderRoot [defaultValue]="50">
        <label rindSliderLabel>Level</label>
        <div rindSliderControl><div rindSliderThumb [index]="0"></div></div>
        <div rindSliderMarkerGroup>
          @for (v of [0, 50, 100]; track v) {
            <div rindSliderMarker [value]="v"></div>
          }
        </div>
        <div rindSliderDescription>Pick a level</div>
      </div>
    } @else if (cfg.form) {
      <form>${SLIDER}<button type="reset">Reset</button></form>
    } @else {
      ${SLIDER}
    }
  </ng-container>`,
})
class Tree {
  readonly env = { platform: currentRun()?.platform ?? platforms.linux }
  readonly dir = currentRun()?.direction ?? "ltr"
  readonly cfg = current.cfg
  readonly commit = current.commit
  readonly thumbs = Array.from({ length: current.cfg.thumbs }, (_, i) => i)
  readonly controlStyle =
    current.cfg.orientation === "vertical"
      ? { width: "20px", height: "200px" }
      : { width: "200px", height: "20px", margin: "8px 0" }
  readonly value = signal(current.cfg.applying ? current.cfg.defaultValue : undefined)
  apply(v: SliderValue) {
    if (this.cfg.applying) this.value.set(v)
  }
}

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
  readonly cfg: Cfg
}
const configs: Config[] = [
  {
    name: "single, uncontrolled",
    props: { defaultValue: [20] },
    cfg: { thumbs: 1, defaultValue: 20 },
  },
  ...(["stop", "push", "swap"] as const).map((policy) => ({
    name: `range [20, 80], gap 2, ${policy}`,
    props: { defaultValue: [20, 80], minStepsBetweenThumbs: 2, thumbCollision: policy },
    cfg: {
      thumbs: 2,
      defaultValue: [20, 80],
      minStepsBetweenThumbs: 2,
      thumbCollision: policy,
    },
  })),
  {
    name: "vertical",
    props: { defaultValue: [20] },
    cfg: { thumbs: 1, defaultValue: 20, orientation: "vertical" },
  },
  {
    name: "read-only",
    props: { defaultValue: [20], readOnly: true },
    cfg: { thumbs: 1, defaultValue: 20, readOnly: true },
  },
  {
    name: "first thumb disabled",
    props: { defaultValue: [20, 80], thumbDisabled: [true, false] },
    cfg: { thumbs: 2, defaultValue: [20, 80], disabledThumb: 0 },
  },
  {
    name: "contain",
    props: { defaultValue: [20] },
    cfg: { thumbs: 1, defaultValue: 20, thumbAlignment: "contain" },
  },
  {
    name: "controlled, applying",
    props: { defaultValue: [20] },
    cfg: { thumbs: 1, defaultValue: [20], applying: true },
  },
]

for (const cfg of configs) {
  describe(`angular slider model: ${cfg.name}`, () => {
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
        current = { cfg: { ...cfg.cfg, form: true }, commit: () => pageCommits++ }
        return mount(Tree)
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

describe("Angular Slider matches React", () => {
  it("single, range, vertical, read-only, a disabled thumb, markers, description", async () => {
    const cases: [Cfg, P][] = [
      [{ thumbs: 1, defaultValue: 20 }, { defaultValue: 20 }],
      [
        { thumbs: 2, defaultValue: [20, 80], minStepsBetweenThumbs: 2 },
        { defaultValue: [20, 80], minStepsBetweenThumbs: 2 },
      ],
      [
        { thumbs: 1, defaultValue: 30, orientation: "vertical" },
        { defaultValue: 30, orientation: "vertical" },
      ],
      [
        { thumbs: 1, defaultValue: 20, readOnly: true, disabled: true },
        { defaultValue: 20, readOnly: true, disabled: true },
      ],
      [
        { thumbs: 2, defaultValue: [20, 80], thumbAlignment: "contain", disabledThumb: 0 },
        { defaultValue: [20, 80], thumbAlignment: "contain" },
      ],
    ]
    for (const [cfg, react] of cases) {
      current = { cfg, commit: () => {} }
      await both(reactSlider(cfg.thumbs, react, cfg.disabledThumb), Tree)
    }
    current = { cfg: { thumbs: 0, marked: true }, commit: () => {} }
    await both(
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
      Tree,
    )
  })
})
