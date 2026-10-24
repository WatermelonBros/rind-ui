// Meter and Progress: React's contract models against the Angular parts, and markup parity.
import { Component, input } from "@angular/core"
import {
  meterContract,
  meterZone,
  PENDING_ANNOUNCEMENTS,
  progressContract,
  progressMessages,
  type RangeOrientation,
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
import { mount } from "../../fixtures/mount"
import { both, clientParity } from "../../fixtures/parity"
import { Progress } from "../progress/progress"
import { Meter } from "./meter"

const a11y = async () => {
  const { violations } = await axe.run(document.body, {
    rules: { region: { enabled: false }, "color-contrast": { enabled: false } },
  })
  if (violations.length > 0) throw new Error(violations.map((v) => `${v.id}: ${v.help}`).join("\n"))
}
type Props = Record<string, unknown>

/** The inputs the next fixture starts with (a server render cannot set inputs). */
let current: Props = {}
const start = <T>(key: string, fallback: T) => (key in current ? (current[key] as T) : fallback)

@Component({
  selector: "rind-f",
  imports: [Meter],
  template: `<div
    rindMeterRoot
    [value]="value()"
    [min]="min()"
    [max]="max()"
    [low]="low()"
    [high]="high()"
    [optimum]="optimum()"
    [orientation]="orientation()"
    [formatOptions]="formatOptions()"
  >
    <span rindMeterLabel>Disk</span><span rindMeterValueText></span>
    <div rindMeterTrack><div rindMeterIndicator></div></div>
  </div>`,
})
class Disk {
  readonly value = input(start("value", 0))
  readonly min = input<number | undefined>(start("min", undefined))
  readonly max = input<number | undefined>(start("max", undefined))
  readonly low = input<number | undefined>(start("low", undefined))
  readonly high = input<number | undefined>(start("high", undefined))
  readonly optimum = input<number | undefined>(start("optimum", undefined))
  readonly orientation = input<RangeOrientation>(start("orientation", "horizontal"))
  readonly formatOptions = input<Intl.NumberFormatOptions | undefined>(
    start("formatOptions", undefined),
  )
}
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

function zones(begin: Props): ConsumerInvariant<typeof meterContract> {
  return {
    name: "meter-zone",
    check: async ({ env, props }) => {
      const now = { ...begin, value: props["value"] as number } as Parameters<
        typeof meterZone
      >[1] & { value: number }
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
  describe(`angular meter model: ${name}`, () => {
    testMachine(meterContract, {
      test: it,
      setup: () => mount(Disk, props),
      rerender: (next, rendered) => rendered.rerender({ value: (next as { value: number }).value }),
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

@Component({
  selector: "rind-f",
  imports: [Progress],
  template: `<div
    rindProgressRoot
    [value]="value()"
    [orientation]="orientation()"
    [announceCompletion]="announceCompletion()"
  >
    <span rindProgressLabel>Uploading</span><span rindProgressValueText></span>
    <div rindProgressTrack><div rindProgressIndicator></div></div>
  </div>`,
})
class Upload {
  readonly value = input<number | null>(start("value", null))
  readonly orientation = input<RangeOrientation>(start("orientation", "horizontal"))
  readonly announceCompletion = input<boolean | undefined>(start("announceCompletion", undefined))
}
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
function progressVariant(name: string, begin: Props) {
  describe(`angular progress model: ${name}`, () => {
    testMachine(progressContract, {
      test: it,
      setup: () => mount(Upload, begin),
      rerender: (next, rendered) =>
        rendered.rerender({ value: (next as { value: number | null }).value ?? null }),
      target: () => screen,
      anchor: [{ name: "Uploading" }],
      props: {
        value: begin["value"],
        min: 0,
        max: 100,
        announceCompletion: begin["announceCompletion"],
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

@Component({
  selector: "rind-f",
  imports: [Progress],
  template: `<div rindProgressRoot [value]="20" aria-label="Sync"></div>`,
})
class Named {}
@Component({
  selector: "rind-f",
  imports: [Progress],
  template: `<div rindProgressRoot [value]="30" aria-label="Ring">
    <svg rindProgressCircle><circle rindProgressCircleTrack /><circle rindProgressCircleIndicator /></svg>
  </div>`,
})
class Ring {}

describe("Angular Meter and Progress match React", () => {
  it("bars, zones, indeterminate, labelled by aria-label, ring", async () => {
    for (const p of [
      { value: 50, ...t, optimum: 100 },
      { value: 3, min: 0, max: 5 },
      { value: 70, orientation: "vertical" },
    ]) {
      current = p
      await both(reactDisk(p), Disk)
    }
    for (const p of [
      { value: 40 },
      { value: null },
      { value: 100 },
      { value: 0, orientation: "vertical" },
    ]) {
      current = p
      await both(reactUpload(p), Upload)
    }
    current = {}
    await clientParity(r(R.Progress.Root, { value: 20, "aria-label": "Sync" } as never), Named)
    await both(
      r(
        R.Progress.Root,
        { value: 30, "aria-label": "Ring" } as never,
        r(R.Progress.Circle, null, r(R.Progress.CircleTrack), r(R.Progress.CircleIndicator)),
      ),
      Ring,
    )
  })
})
