// Model-based tests (add-color-picker 9.1): the Color Area contract over all transitions, with
// the colour model as oracle (the oracle machine computes with it). Browser mode walks pointer,
// touch, keyboard and virtual; jsdom (no layout) keyboard only.
import { areaAxes, type Color, colorAreaContract, makeColor, platforms } from "@rind-ui/core"
import { ColorArea, type ColorAreaRootProps, RindProvider } from "@rind-ui/react"
import { render, screen } from "@testing-library/react"
import axe from "axe-core"
import type { ReactElement } from "react"
import { describe, it } from "vitest"
import { currentRun, testMachine } from "../index"

const inJsdom = navigator.userAgent.includes("jsdom")
const a11y = async () => {
  const { violations } = await axe.run(document.body, {
    rules: { region: { enabled: false }, "color-contrast": { enabled: false } },
  })
  if (violations.length > 0) throw new Error(violations.map((v) => `${v.id}: ${v.help}`).join("\n"))
}

const contract = inJsdom
  ? {
      ...colorAreaContract,
      events: {
        ...colorAreaContract.events,
        "POINTER.DOWN": { skip: "no layout in jsdom: walked in browser mode" },
      },
    }
  : colorAreaContract

function Fixture(props: ColorAreaRootProps) {
  return (
    <form>
      <ColorArea.Root
        aria-label="Fill"
        xName="x"
        yName="y"
        style={{ width: 200, height: 200 }}
        {...props}
      >
        <ColorArea.Background style={{ position: "absolute", inset: 0 }} />
        <ColorArea.Thumb style={{ width: 16, height: 16 }} />
      </ColorArea.Root>
      <button type="reset">Reset</button>
    </form>
  )
}

const withRun = (ui: ReactElement) => (
  <RindProvider
    dir={currentRun()?.direction ?? "ltr"}
    environment={{ platform: currentRun()?.platform ?? platforms.linux }}
  >
    {ui}
  </RindProvider>
)

interface Config {
  readonly name: string
  readonly color: Color
  readonly xChannel?: "hue" | "saturation"
  readonly yChannel?: "saturation" | "brightness"
  readonly readOnly?: boolean
}

const configs: Config[] = [
  { name: "hsb, saturation × brightness", color: makeColor("hsb", [200, 50, 50]) },
  { name: "hsl, saturation × lightness", color: makeColor("hsl", [260, 40, 50]) },
  { name: "rgb, red × green", color: makeColor("rgb", [120, 80, 40]) },
  {
    name: "hue × saturation",
    color: makeColor("hsb", [100, 50, 80]),
    xChannel: "hue",
    yChannel: "saturation",
  },
  { name: "read-only", color: makeColor("hsb", [200, 50, 50]), readOnly: true },
]

for (const cfg of configs) {
  describe(`color area model: ${cfg.name}`, () => {
    let pageCommits = 0
    let oracleCommits = 0
    testMachine(contract, {
      test: it,
      setup: () => {
        pageCommits = 0
        oracleCommits = 0
        return render(
          withRun(
            <Fixture
              defaultValue={cfg.color}
              {...(cfg.xChannel ? { xChannel: cfg.xChannel, yChannel: cfg.yChannel } : {})}
              readOnly={cfg.readOnly === true}
              onValueCommit={() => {
                pageCommits++
              }}
            />,
          ),
        )
      },
      target: () => screen,
      anchor: [{ name: "Fill" }] as never,
      props: {
        value: undefined,
        defaultValue: cfg.color,
        axes: areaAxes(cfg.color.space, cfg.xChannel, cfg.yChannel),
        fallback: makeColor("hsb", [0, 0, 100]),
        disabled: undefined,
        readOnly: cfg.readOnly === true ? true : undefined,
        onValueCommit: () => {
          oracleCommits++
        },
      } as never,
      ...(inJsdom ? { modalities: ["keyboard"] as const } : {}),
      invariants: [
        {
          name: "color-area-commit-count",
          check: async () =>
            pageCommits === oracleCommits
              ? undefined
              : `the page committed ${pageCommits} times, the oracle ${oracleCommits}`,
        },
      ],
      a11y,
    })
  })
}
