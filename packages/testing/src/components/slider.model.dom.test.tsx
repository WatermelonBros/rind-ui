// Model-based tests (task 7.1): the Slider contract over all transitions. Browser mode walks
// pointer, touch, keyboard and virtual; jsdom (no layout) keyboard only. Configurations of
// design §6; the oracle's onValueCommit spy is compared with the page's (commit counts).
import { platforms, sliderContract } from "@rind-ui/core"
import { RindProvider, Slider, type SliderRootProps } from "@rind-ui/react"
import { render, screen } from "@testing-library/react"
import axe from "axe-core"
import { type ReactElement, useState } from "react"
import { describe, it } from "vitest"
import { currentRun, sliderStepInvariants, testMachine } from "../index"

const inJsdom = navigator.userAgent.includes("jsdom")
const a11y = async () => {
  const { violations } = await axe.run(document.body, {
    rules: { region: { enabled: false }, "color-contrast": { enabled: false } },
  })
  if (violations.length > 0) throw new Error(violations.map((v) => `${v.id}: ${v.help}`).join("\n"))
}

// Every prop the machine's guards read, as the component receives it.
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

function Fixture({
  thumbs,
  disabledThumb,
  ...props
}: SliderRootProps & { readonly thumbs: number; readonly disabledThumb?: number }) {
  const vertical = props.orientation === "vertical"
  return (
    <form>
      <Slider.Root name="v" {...props}>
        <Slider.Label>Volume</Slider.Label>
        <Slider.ValueText />
        <Slider.Control
          style={
            vertical ? { width: 20, height: 200 } : { width: 200, height: 20, margin: "8px 0" }
          }
        >
          <Slider.Track style={{ position: "absolute", inset: 0 }}>
            <Slider.Indicator />
          </Slider.Track>
          {Array.from({ length: thumbs }, (_, i) => (
            <Slider.Thumb
              // biome-ignore lint/suspicious/noArrayIndexKey: thumbs are identified by index
              key={i}
              index={i}
              disabled={i === disabledThumb}
              style={{ width: 16, height: 16, "--rind-slider-thumb-size": "16px" } as never}
            />
          ))}
        </Slider.Control>
      </Slider.Root>
      <button type="reset">Reset</button>
    </form>
  )
}

/** Outside the component that re-renders: a new environment per render resets modality. */
const withRun = (ui: ReactElement) => (
  <RindProvider
    dir={currentRun()?.direction ?? "ltr"}
    environment={{ platform: currentRun()?.platform ?? platforms.linux }}
  >
    {ui}
  </RindProvider>
)

/** Controlled by a parent that applies every proposal (the oracle runs uncontrolled). */
function Applying(props: { readonly initial: number[]; readonly onValueCommit: () => void }) {
  const [value, setValue] = useState<readonly number[]>(props.initial)
  return (
    <Fixture
      thumbs={props.initial.length}
      value={value}
      defaultValue={props.initial}
      onValueChange={(v) => setValue(v as readonly number[])} // an array value: array callbacks
      onValueCommit={props.onValueCommit}
    />
  )
}

interface Config {
  readonly name: string
  readonly props: Record<string, unknown>
  readonly ui: (commit: () => void) => ReactElement
}

const configs: Config[] = [
  {
    name: "single, uncontrolled",
    props: { defaultValue: [20] },
    ui: (c) => <Fixture thumbs={1} defaultValue={20} onValueCommit={c} />,
  },
  ...(["stop", "push", "swap"] as const).map((policy) => ({
    name: `range [20, 80], gap 2, ${policy}`,
    props: { defaultValue: [20, 80], minStepsBetweenThumbs: 2, thumbCollision: policy },
    ui: (c: () => void) => (
      <Fixture
        thumbs={2}
        defaultValue={[20, 80]}
        minStepsBetweenThumbs={2}
        thumbCollision={policy}
        onValueCommit={c}
      />
    ),
  })),
  {
    name: "vertical",
    props: { defaultValue: [20] },
    ui: (c) => <Fixture thumbs={1} defaultValue={20} orientation="vertical" onValueCommit={c} />,
  },
  {
    name: "read-only",
    props: { defaultValue: [20], readOnly: true },
    ui: (c) => <Fixture thumbs={1} defaultValue={20} readOnly onValueCommit={c} />,
  },
  {
    name: "first thumb disabled",
    props: { defaultValue: [20, 80], thumbDisabled: [true, false] },
    ui: (c) => <Fixture thumbs={2} defaultValue={[20, 80]} disabledThumb={0} onValueCommit={c} />,
  },
  {
    name: "contain",
    props: { defaultValue: [20] },
    ui: (c) => <Fixture thumbs={1} defaultValue={20} thumbAlignment="contain" onValueCommit={c} />,
  },
  {
    name: "controlled, applying",
    props: { defaultValue: [20] },
    ui: (c) => <Applying initial={[20]} onValueCommit={c} />,
  },
]

for (const cfg of configs) {
  describe(`slider model: ${cfg.name}`, () => {
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
        return render(withRun(cfg.ui(() => pageCommits++)))
      },
      target: () => screen,
      anchor: [{ name: "Volume" }] as never,
      props: {
        ...base,
        ...cfg.props,
        onValueCommit: () => {
          oracleCommits++
        },
      } as never,
      // No layout in jsdom: the pointer steps run in browser mode only.
      ...(inJsdom ? { modalities: ["keyboard"] as const } : {}),
      invariants: steps.invariants,
      a11y,
    })
  })
}
