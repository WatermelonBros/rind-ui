// Model-based tests (add-color-picker 9.1): the Color Slider is the Slider contract plus the
// colour invariants, per channel; LTR and RTL (directional), vertical; browser mode walks the
// pointer, jsdom the keyboard. The oracle is the Slider machine over the channel's range.

import { channelRange, parseColor, platforms, spaceForChannel } from "@rind-ui/core"
import { channelSliderNaming, colorSliderContract } from "@rind-ui/core/internal"
import { RindProvider } from "@rind-ui/react"
import { render, screen } from "@testing-library/react"
import axe from "axe-core"
import { describe, it } from "vitest"
import { currentRun, sliderStepInvariants, testMachine } from "../index"
import { ColorSlider, type ColorSliderRootProps } from "./color-parts"

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

function Fixture(props: ColorSliderRootProps) {
  const vertical = props.orientation === "vertical"
  return (
    <RindProvider
      dir={currentRun()?.direction ?? "ltr"}
      environment={{ platform: currentRun()?.platform ?? platforms.linux }}
    >
      <form>
        <ColorSlider.Root name="v" {...props}>
          <ColorSlider.Control
            style={vertical ? { width: 20, height: 200 } : { width: 200, height: 20 }}
          >
            <ColorSlider.Track style={{ position: "absolute", inset: 0 }}>
              <ColorSlider.Thumb
                style={{ width: 16, height: 16, "--rind-slider-thumb-size": "16px" } as never}
              />
            </ColorSlider.Track>
          </ColorSlider.Control>
        </ColorSlider.Root>
        <button type="reset">Reset</button>
      </form>
    </RindProvider>
  )
}

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
  describe(`color slider model: ${cfg.name}`, () => {
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
        return render(
          <Fixture
            channel={cfg.channel}
            defaultValue={parseColor(cfg.color)}
            {...("orientation" in cfg ? { orientation: cfg.orientation } : {})}
            onValueCommit={() => {
              pageCommits++
            }}
          />,
        )
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
