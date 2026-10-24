// The Reasoning contract model (React's: the user's toggle by every modality and the thinking
// lifecycle as prop steps on a virtual clock) against the Vue parts, and markup parity with
// React.
import { reasoningContract, reasoningMessages } from "@rind-ui/core"
import * as R from "@rind-ui/react"
import { domEnv, testMachine, virtualClock } from "@rind-ui/testing"
import axe from "axe-core"
import { createElement as r } from "react"
import { describe, it } from "vitest"
import { h } from "vue"
import { mount } from "../../fixtures/mount"
import { clientParity, serverParity } from "../../fixtures/parity"
import { Reasoning, RindProvider } from "../index"

const a11y = async () => {
  const { violations } = await axe.run(document.body, {
    rules: { region: { enabled: false }, "color-contrast": { enabled: false } },
  })
  if (violations.length > 0) throw new Error(violations.map((v) => `${v.id}: ${v.help}`).join("\n"))
}

const clock = virtualClock()
const ui = (p: { thinking: boolean }) =>
  h(RindProvider, { environment: { scheduler: clock.scheduler, clock: clock.clock } }, () =>
    h(Reasoning.Root, { thinking: p.thinking, autoCloseDelay: 200 }, () => [
      h(Reasoning.Trigger),
      h(Reasoning.Content, null, () => "The moon pulls the water."),
    ]),
  )

describe("vue reasoning model", () => {
  testMachine(reasoningContract, {
    test: (name: string, fn: () => Promise<void>) => it(name, fn, 20_000),
    setup: () => mount(ui, { thinking: false }),
    rerender: (next: unknown, rendered: { rerender: (p: { thinking: boolean }) => void }) =>
      rendered.rerender({ thinking: (next as { thinking: boolean }).thinking }),
    target: () => domEnv({ advanceClock: (ms) => clock.advance(ms), timeout: 200 }),
    anchor: [],
    props: {
      id: "oracle",
      thinking: false,
      messages: reasoningMessages,
      autoCloseDelay: 200,
    } as never,
    modalities: ["pointer", "keyboard", "virtual"],
    clock,
    a11y,
  } as never)
})

const vue = (p: Record<string, unknown>) => () =>
  h(Reasoning.Root, { id: "why", thinking: false, ...p }, () => [
    h(Reasoning.Trigger),
    h(Reasoning.Content, null, () => "The moon pulls the water."),
  ])
const react = (p: Record<string, unknown>) =>
  r(
    R.Reasoning.Root,
    { id: "why", thinking: false, ...p },
    r(R.Reasoning.Trigger),
    r(R.Reasoning.Content, null, "The moon pulls the water."),
  )

describe("Vue Reasoning matches React", () => {
  it("thinking, closed, open with a duration", async () => {
    for (const p of [{ thinking: true }, {}, { defaultOpen: true, duration: 4 }]) {
      await serverParity(react(p), vue(p))
      await clientParity(react(p), vue(p))
    }
  })
})
