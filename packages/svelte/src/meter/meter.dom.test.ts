// Meter and Progress: React's contract models against the Vue parts, and markup parity.
import {
  meterContract,
  meterZone,
  PENDING_ANNOUNCEMENTS,
  progressContract,
  progressMessages,
  resolveRangeValue,
} from "@rind-ui/core"
import * as R from "@rind-ui/react"
import {
  allowRindWarning,
  type ConsumerInvariant,
  installAnnouncementLog,
  testMachine,
} from "@rind-ui/testing"
import { screen } from "@testing-library/dom"
import axe from "axe-core"
import { createElement as r } from "react"
import { beforeEach, describe, it } from "vitest"
import Disk from "../../fixtures/meter/disk.svelte"
import Upload from "../../fixtures/meter/upload.svelte"
import { mount } from "../../fixtures/mount"
import { clientParity } from "../../fixtures/parity"

const a11y = async () => {
  const { violations } = await axe.run(document.body, {
    rules: { region: { enabled: false }, "color-contrast": { enabled: false } },
  })
  if (violations.length > 0) throw new Error(violations.map((v) => `${v.id}: ${v.help}`).join("\n"))
}
type Props = Record<string, unknown>

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
  describe(`svelte meter model: ${name}`, () => {
    testMachine(meterContract, {
      test: it,
      setup: () => mount(Disk, { ...props } as never),
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

const reactUpload = (props: Props) =>
  r(
    R.Progress.Root,
    props as never,
    r(R.Progress.Label, null, "Uploading"),
    r(R.Progress.ValueText),
    r(R.Progress.Track, null, r(R.Progress.Indicator)),
  )
const pending = () => (Reflect.get(globalThis, PENDING_ANNOUNCEMENTS) as number | undefined) ?? 0
function completionCount(): ConsumerInvariant<typeof progressContract> {
  let seen = 0
  let last: number | null = null
  return {
    name: "progress-announces-completion",
    check: async ({ env, props }) => {
      await env.until(
        async () => pending(),
        (n) => n === 0,
      )
      const now = installAnnouncementLog().length
      const value = (props["value"] as number | null | undefined) ?? null
      if (value !== 100) {
        seen = now
        last = value
        return undefined
      }
      const expected = props["announceCompletion"] === true && (last === null || last < 100) ? 1 : 0
      const grew = now - seen
      seen = now
      last = value
      return grew === expected ? undefined : `announced ${grew} times, expected ${expected}`
    },
  }
}
function progressVariant(name: string, start: Props) {
  describe(`svelte progress model: ${name}`, () => {
    testMachine(progressContract, {
      test: it,
      setup: () => mount(Upload, { ...start } as never),
      rerender: (next, rendered) => rendered.rerender(next as unknown as Props),
      target: () => screen,
      anchor: [{ name: "Uploading" }],
      props: {
        value: start["value"],
        min: 0,
        max: 100,
        announceCompletion: start["announceCompletion"],
        messages: progressMessages,
        id: "oracle",
      } as never,
      invariants: [completionCount()],
      a11y,
      modalities: ["pointer"],
    })
  })
}
progressVariant("40 → max, announcing", { value: 40, announceCompletion: true })
progressVariant("40 → max, silent", { value: 40 })
progressVariant("indeterminate → max, announcing", { value: null, announceCompletion: true })
progressVariant("zero → max, vertical", { value: 0, orientation: "vertical" })

describe("Svelte Meter and Progress match React", () => {
  it("bars, zones, indeterminate, labelled by aria-label, ring", async () => {
    for (const p of [
      { value: 50, ...t, optimum: 100 },
      { value: 3, min: 0, max: 5 },
      { value: 70, orientation: "vertical" },
    ]) {
      await clientParity(reactDisk(p), Disk, p as never)
    }
    for (const p of [
      { value: 40 },
      { value: null },
      { value: 100 },
      { value: 0, orientation: "vertical" },
    ]) {
      await clientParity(reactUpload(p), Upload, p as never)
    }
    const reactRing = (p: Props) =>
      r(
        R.Progress.Root,
        p as never,
        r(R.Progress.Circle, null, r(R.Progress.CircleTrack), r(R.Progress.CircleIndicator)),
      )
    await clientParity(reactRing({ value: 30, "aria-label": "Ring" }), Upload, {
      value: 30,
      "aria-label": "Ring",
      ring: true,
    } as never)
  })
})
