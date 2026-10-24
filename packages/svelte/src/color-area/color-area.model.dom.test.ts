// Model-based tests (React's, against the Svelte parts): the Color Area contract over its axis
// configurations; the commit count matches the oracle's after every step.
import { type Color, makeColor } from "@rind-ui/core"
import { areaAxes, colorAreaContract } from "@rind-ui/core/internal"
import { testMachine } from "@rind-ui/testing"
import { screen } from "@testing-library/dom"
import axe from "axe-core"
import { describe, it } from "vitest"
import Area from "../../fixtures/color/area.svelte"
import { mount } from "../../fixtures/mount"

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
  describe(`svelte color area model: ${cfg.name}`, () => {
    let pageCommits = 0
    let oracleCommits = 0
    testMachine(contract, {
      test: it,
      setup: () => {
        pageCommits = 0
        oracleCommits = 0
        return mount(Area, {
          root: {
            defaultValue: cfg.color,
            ...(cfg.xChannel ? { xChannel: cfg.xChannel, yChannel: cfg.yChannel } : {}),
            readOnly: cfg.readOnly === true,
            onValueCommit: () => {
              pageCommits++
            },
          },
        } as never)
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
