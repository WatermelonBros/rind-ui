// The Reasoning contract model (React's: the user's toggle by every modality and the thinking
// lifecycle as prop steps on a virtual clock) against the Svelte parts, and DOM parity with
// React.
import { reasoningContract, reasoningMessages } from "@rind-ui/core"
import * as R from "@rind-ui/react"
import { domEnv, testMachine, virtualClock } from "@rind-ui/testing"
import axe from "axe-core"
import { createElement as r } from "react"
import { describe, it } from "vitest"
import { mount } from "../../fixtures/mount"
import { clientParity } from "../../fixtures/parity"
import Fixture from "../../fixtures/reasoning/reasoning.svelte"

const a11y = async () => {
  const { violations } = await axe.run(document.body, {
    rules: { region: { enabled: false }, "color-contrast": { enabled: false } },
  })
  if (violations.length > 0) throw new Error(violations.map((v) => `${v.id}: ${v.help}`).join("\n"))
}

const clock = virtualClock()
describe("svelte reasoning model", () => {
  testMachine(reasoningContract, {
    test: (name: string, fn: () => Promise<void>) => it(name, fn, 20_000),
    setup: () =>
      mount(Fixture, {
        thinking: false,
        autoCloseDelay: 200,
        scheduler: clock.scheduler,
        clock: clock.clock,
      } as never),
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

const react = (p: Record<string, unknown>) =>
  r(
    R.Reasoning.Root,
    { id: "why", thinking: false, ...p },
    r(R.Reasoning.Trigger),
    r(R.Reasoning.Content, null, "The moon pulls the water."),
  )

describe("Svelte Reasoning matches React", () => {
  it("thinking, closed, open with a duration", async () => {
    for (const p of [{ thinking: true }, {}, { defaultOpen: true, duration: 4 }]) {
      await clientParity(react(p), Fixture, { id: "why", thinking: false, ...p } as never)
    }
  })
})
