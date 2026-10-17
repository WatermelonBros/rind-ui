// Model-based tests (add-meter 5.1): from a value in each region × an optimum below, between
// and above (and without thresholds), the prop step moves the value to 90, across `high`; the
// generic invariants (`valued`), the zone invariant and axe run after every step (RS#6627).
import { meterContract, meterZone, resolveRangeValue } from "@rind-ui/core"
import { Meter, type MeterRootProps } from "@rind-ui/react"
import { render, screen } from "@testing-library/react"
import axe from "axe-core"
import { describe, it } from "vitest"
import { type ConsumerInvariant, testMachine } from "../index"

const a11y = async () => {
  const { violations } = await axe.run(document.body, {
    rules: { region: { enabled: false }, "color-contrast": { enabled: false } },
  })
  if (violations.length > 0) throw new Error(violations.map((v) => `${v.id}: ${v.help}`).join("\n"))
}

function Disk(props: MeterRootProps) {
  return (
    <Meter.Root {...props}>
      <Meter.Label>Disk</Meter.Label>
      <Meter.ValueText />
      <Meter.Track>
        <Meter.Indicator />
      </Meter.Track>
    </Meter.Root>
  )
}

/** Every part carries the HTML algorithm's zone (none without thresholds). */
function zones(start: MeterRootProps): ConsumerInvariant<typeof meterContract> {
  return {
    name: "meter-zone",
    check: async ({ env, props }) => {
      const now = { ...start, value: props["value"] as number }
      const want = meterZone(resolveRangeValue(now), now) ?? null
      for (const part of ["root", "track", "indicator", "value-text", "label"] as const) {
        const got = await env.part(part).attr("data-zone")
        if (got !== want) return `${part} data-zone=${got}, expected ${want}`
      }
      return undefined
    },
  }
}

function variant(name: string, props: MeterRootProps) {
  describe(`meter model: ${name}`, () => {
    testMachine(meterContract, {
      test: it,
      setup: () => render(<Disk {...props} />),
      rerender: (next, rendered) =>
        rendered.rerender(<Disk {...props} {...(next as unknown as MeterRootProps)} />),
      target: () => screen,
      anchor: [{ name: "Disk" }],
      props: {
        value: props.value,
        min: props.min,
        max: props.max,
        low: props.low,
        high: props.high,
        optimum: props.optimum,
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
    variant(`optimum ${where}, value ${value}`, { value, ...t, optimum })
}
variant("no thresholds", { value: 30 })
variant("custom range and units", {
  value: 3,
  min: 0,
  max: 5,
  formatOptions: { style: "unit", unit: "gigabyte" },
})
variant("vertical", { value: 70, orientation: "vertical", ...t, optimum: 100 })
