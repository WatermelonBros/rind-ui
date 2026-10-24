// Model-based tests (React's, against the Vue parts): the Color Area contract over its axis
// configurations; the commit count matches the oracle's after every step.
import { type Color, makeColor, platforms } from "@rind-ui/core"
import { areaAxes, colorAreaContract } from "@rind-ui/core/internal"
import { currentRun, testMachine } from "@rind-ui/testing"
import { screen } from "@testing-library/dom"
import axe from "axe-core"
import { describe, it } from "vitest"
import { h } from "vue"
import { mount } from "../../fixtures/mount"
import { RindProvider } from "../index"
import { ColorArea } from "./color-area"

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

const fixture = (props: Record<string, unknown>) => () =>
  h(
    RindProvider,
    {
      dir: currentRun()?.direction ?? "ltr",
      environment: { platform: currentRun()?.platform ?? platforms.linux },
    },
    () =>
      h("form", [
        h(
          ColorArea.Root,
          {
            "aria-label": "Fill",
            xName: "x",
            yName: "y",
            style: { width: "200px", height: "200px" },
            ...props,
          },
          () => [
            h(ColorArea.Background, { style: { position: "absolute", inset: 0 } }),
            h(ColorArea.Thumb, { style: { width: "16px", height: "16px" } }),
          ],
        ),
        h("button", { type: "reset" }, "Reset"),
      ]),
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
  describe(`vue color area model: ${cfg.name}`, () => {
    let pageCommits = 0
    let oracleCommits = 0
    testMachine(contract, {
      test: it,
      setup: () => {
        pageCommits = 0
        oracleCommits = 0
        return mount(
          fixture({
            defaultValue: cfg.color,
            ...(cfg.xChannel ? { xChannel: cfg.xChannel, yChannel: cfg.yChannel } : {}),
            readOnly: cfg.readOnly === true,
            onValueCommit: () => {
              pageCommits++
            },
          }),
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
