/** @jsxImportSource solid-js */
// Progress: React's contract model against the Solid parts, and markup parity.
import { PENDING_ANNOUNCEMENTS, progressContract, progressMessages } from "@rind-ui/core"
import * as R from "@rind-ui/react"
import { type ConsumerInvariant, installAnnouncementLog, testMachine } from "@rind-ui/testing"
import { screen } from "@testing-library/dom"
import axe from "axe-core"
import { createElement as r } from "react"
import { describe, it } from "vitest"
import { mount } from "../../fixtures/mount"
import { clientParity } from "../../fixtures/parity"
import { Progress, type ProgressRootProps } from "../index"

const a11y = async () => {
  const { violations } = await axe.run(document.body, {
    rules: { region: { enabled: false }, "color-contrast": { enabled: false } },
  })
  if (violations.length > 0) throw new Error(violations.map((v) => `${v.id}: ${v.help}`).join("\n"))
}
type Props = Record<string, unknown>

// JSX reads the props (a store), so a rerender reaches the Progress.
const upload = (p: Props) => (
  <Progress.Root {...(p as ProgressRootProps)}>
    <Progress.Label>Uploading</Progress.Label>
    <Progress.ValueText />
    <Progress.Track>
      <Progress.Indicator />
    </Progress.Track>
  </Progress.Root>
)
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
  describe(`solid progress model: ${name}`, () => {
    testMachine(progressContract, {
      test: it,
      setup: () => mount(upload, { ...start }),
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

describe("Solid Progress matches React", () => {
  it("bars, indeterminate, labelled by aria-label, ring", async () => {
    for (const p of [
      { value: 40 },
      { value: null },
      { value: 100 },
      { value: 0, orientation: "vertical" },
    ]) {
      await clientParity(reactUpload(p), () => upload(p))
    }
    const named = { value: 20, "aria-label": "Sync" }
    await clientParity(r(R.Progress.Root, named as never), () => (
      <Progress.Root {...(named as ProgressRootProps)} />
    ))
    const ring = (p: Props) => (
      <Progress.Root {...(p as ProgressRootProps)}>
        <Progress.Circle>
          <Progress.CircleTrack />
          <Progress.CircleIndicator />
        </Progress.Circle>
      </Progress.Root>
    )
    const reactRing = (p: Props) =>
      r(
        R.Progress.Root,
        p as never,
        r(R.Progress.Circle, null, r(R.Progress.CircleTrack), r(R.Progress.CircleIndicator)),
      )
    const props = { value: 30, "aria-label": "Ring" }
    await clientParity(reactRing(props), () => ring(props))
  })
})
