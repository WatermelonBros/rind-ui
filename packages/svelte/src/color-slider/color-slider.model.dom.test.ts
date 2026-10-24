// Model-based tests (React's, against the Svelte parts): the Color Slider is the Slider contract
// bound to one channel; commits match the oracle's after every step.
import { channelRange, parseColor, spaceForChannel } from "@rind-ui/core"
import { channelSliderNaming, colorSliderContract } from "@rind-ui/core/internal"
import { allowRindWarning, sliderStepInvariants, testMachine } from "@rind-ui/testing"
import { screen } from "@testing-library/dom"
import axe from "axe-core"
import { beforeEach, describe, it } from "vitest"
import Slider from "../../fixtures/color/slider.svelte"
import { mount } from "../../fixtures/mount"

// Library issue reported (alpha from #RRGGBB80 is off the slider's step grid); remove when fixed.
beforeEach(() => allowRindWarning(/slider: defaultValue \[0\.50196/))

const inJsdom = navigator.userAgent.includes("jsdom")
const a11y = async () => {
  const { violations } = await axe.run(document.body, {
    rules: { region: { enabled: false }, "color-contrast": { enabled: false } },
  })
  if (violations.length > 0) throw new Error(violations.map((v) => `${v.id}: ${v.help}`).join("\n"))
}

const contract = inJsdom
  ? {
      ...colorSliderContract,
      events: {
        ...colorSliderContract.events,
        "POINTER.DOWN": { skip: "no layout in jsdom: walked in browser mode" },
      },
    }
  : colorSliderContract

const configs = [
  { name: "hue", channel: "hue", color: "hsb(200, 50%, 50%)", value: 200, label: "Hue" },
  { name: "alpha", channel: "alpha", color: "#33669980", value: 0.5, label: "Alpha" },
  { name: "red", channel: "red", color: "rgb(120, 80, 40)", value: 120, label: "Red" },
  {
    name: "saturation, vertical",
    channel: "saturation",
    color: "hsb(200, 50%, 50%)",
    value: 50,
    label: "Saturation",
    orientation: "vertical",
  },
] as const

for (const cfg of configs) {
  describe(`svelte color slider model: ${cfg.name}`, () => {
    let pageCommits = 0
    let oracleCommits = 0
    const steps = sliderStepInvariants({
      naming: channelSliderNaming,
      commits: () => pageCommits,
      expectedCommits: () => oracleCommits,
    })
    const range = channelRange(spaceForChannel(cfg.channel), cfg.channel)
    testMachine(contract, {
      test: it,
      setup: () => {
        steps.reset()
        pageCommits = 0
        oracleCommits = 0
        return mount(Slider, {
          root: {
            channel: cfg.channel,
            defaultValue: parseColor(cfg.color),
            ...("orientation" in cfg ? { orientation: cfg.orientation } : {}),
            onValueCommit: () => {
              pageCommits++
            },
          },
        } as never)
      },
      target: () => screen,
      anchor: [{ name: cfg.label }] as never,
      props: {
        value: undefined,
        defaultValue: [cfg.value],
        min: range.min,
        max: range.max,
        step: range.step,
        largeStep: range.pageStep,
        minStepsBetweenThumbs: undefined,
        disabled: undefined,
        readOnly: undefined,
        thumbDisabled: undefined,
        onValueCommit: () => {
          oracleCommits++
        },
      } as never,
      ...(inJsdom ? { modalities: ["keyboard"] as const } : {}),
      invariants: steps.invariants,
      a11y,
    })
  })
}
