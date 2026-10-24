/** @jsxImportSource solid-js */
// Meter: React's contract model against the Solid parts, and markup parity.
import { meterContract, meterZone, resolveRangeValue } from "@rind-ui/core"
import * as R from "@rind-ui/react"
import { allowRindWarning, type ConsumerInvariant, testMachine } from "@rind-ui/testing"
import { screen } from "@testing-library/dom"
import axe from "axe-core"
import { createElement as r } from "react"
import { beforeEach, describe, it } from "vitest"
import { mount } from "../../fixtures/mount"
import { clientParity } from "../../fixtures/parity"
import { Meter, type MeterRootProps } from "../index"

const a11y = async () => {
  const { violations } = await axe.run(document.body, {
    rules: { region: { enabled: false }, "color-contrast": { enabled: false } },
  })
  if (violations.length > 0) throw new Error(violations.map((v) => `${v.id}: ${v.help}`).join("\n"))
}
type Props = Record<string, unknown>

// JSX reads the props (a store), so a rerender reaches the Meter.
const disk = (p: Props) => (
  <Meter.Root {...(p as MeterRootProps)}>
    <Meter.Label>Disk</Meter.Label>
    <Meter.ValueText />
    <Meter.Track>
      <Meter.Indicator />
    </Meter.Track>
  </Meter.Root>
)
const reactDisk = (props: Props) =>
  r(
    R.Meter.Root,
    props as never,
    r(R.Meter.Label, null, "Disk"),
    r(R.Meter.ValueText),
    r(R.Meter.Track, null, r(R.Meter.Indicator)),
  )

// The model's $props steps set values outside the range on purpose.
beforeEach(() => allowRindWarning(/meter: value \d+ is outside/))

function zones(start: Props): ConsumerInvariant<typeof meterContract> {
  return {
    name: "meter-zone",
    check: async ({ env, props }) => {
      const now = { ...start, value: props["value"] as number } as Parameters<
        typeof meterZone
      >[1] & {
        value: number
      }
      const want = meterZone(resolveRangeValue(now), now) ?? null
      for (const part of ["root", "track", "indicator", "value-text", "label"] as const) {
        const got = await env.part(part).attr("data-zone")
        if (got !== want) return `${part} data-zone=${got}, expected ${want}`
      }
      return undefined
    },
  }
}

function meterVariant(name: string, props: Props) {
  describe(`solid meter model: ${name}`, () => {
    testMachine(meterContract, {
      test: it,
      setup: () => mount(disk, { ...props }),
      rerender: (next, rendered) => rendered.rerender(next as unknown as Props),
      target: () => screen,
      anchor: [{ name: "Disk" }],
      props: {
        value: props["value"],
        min: props["min"],
        max: props["max"],
        low: props["low"],
        high: props["high"],
        optimum: props["optimum"],
      } as never,
      invariants: [zones(props)],
      a11y,
      modalities: ["pointer"],
    })
  })
}
const t = { low: 20, high: 80 }
for (const [where, optimum] of [
  ["below", 0],
  ["between", 50],
  ["above", 100],
] as const) {
  for (const value of [10, 50, 90])
    meterVariant(`optimum ${where}, value ${value}`, { value, ...t, optimum })
}
meterVariant("no thresholds", { value: 30 })
meterVariant("custom range and units", {
  value: 3,
  min: 0,
  max: 5,
  formatOptions: { style: "unit", unit: "gigabyte" },
})
meterVariant("vertical", { value: 70, orientation: "vertical", ...t, optimum: 100 })

describe("Solid Meter matches React", () => {
  it("bars, zones, custom range, vertical", async () => {
    for (const p of [
      { value: 50, ...t, optimum: 100 },
      { value: 3, min: 0, max: 5 },
      { value: 70, orientation: "vertical" },
    ]) {
      await clientParity(reactDisk(p), () => disk(p))
    }
  })
})
