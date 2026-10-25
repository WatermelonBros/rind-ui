// The Reasoning contract model (React's: the user's toggle by every modality and the thinking
// lifecycle as input steps on a virtual clock) against the Angular parts, and markup parity
// with React.
import { Component, input } from "@angular/core"
import { reasoningContract, reasoningMessages } from "@rind-ui/core"
import * as R from "@rind-ui/react"
import { domEnv, testMachine, virtualClock } from "@rind-ui/testing"
import axe from "axe-core"
import { createElement as r } from "react"
import { describe, it } from "vitest"
import { mount } from "../../fixtures/mount"
import { both } from "../../fixtures/parity"
import { RindProvider } from "../provider"
import { Reasoning } from "./index"

const a11y = async () => {
  const { violations } = await axe.run(document.body, {
    rules: { region: { enabled: false }, "color-contrast": { enabled: false } },
  })
  if (violations.length > 0) throw new Error(violations.map((v) => `${v.id}: ${v.help}`).join("\n"))
}

const clock = virtualClock()

@Component({
  selector: "rind-f",
  imports: [RindProvider, Reasoning],
  template: `<ng-container rindProvider [environment]="env">
    <div rindReasoningRoot [thinking]="thinking()" [autoCloseDelay]="200">
      <button rindReasoningTrigger></button>
      <div rindReasoningContent>The moon pulls the water.</div>
    </div>
  </ng-container>`,
})
class Model {
  readonly thinking = input(false)
  readonly env = { scheduler: clock.scheduler, clock: clock.clock }
}

describe("angular reasoning model", () => {
  testMachine(reasoningContract, {
    test: (name: string, fn: () => Promise<void>) => it(name, fn, 20_000),
    setup: () => mount(Model, { thinking: false }),
    rerender: (
      next: unknown,
      rendered: { rerender: (p: { thinking: boolean }) => Promise<void> },
    ) => rendered.rerender({ thinking: (next as { thinking: boolean }).thinking }),
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

/** The configuration the next fixture renders. */
let current: { thinking?: boolean; defaultOpen?: boolean; duration?: number } = {}

@Component({
  selector: "rind-f",
  imports: [Reasoning],
  template: `<div
    rindReasoningRoot
    id="why"
    [thinking]="p.thinking ?? false"
    [defaultOpen]="p.defaultOpen"
    [duration]="p.duration"
  >
    <button rindReasoningTrigger></button>
    <div rindReasoningContent>The moon pulls the water.</div>
  </div>`,
})
class Fixture {
  readonly p = current
}

const react = (p: Record<string, unknown>) =>
  r(
    R.Reasoning.Root,
    { id: "why", thinking: false, ...p },
    r(R.Reasoning.Trigger),
    r(R.Reasoning.Content, null, "The moon pulls the water."),
  )

describe("Angular Reasoning matches React", () => {
  for (const p of [{ thinking: true }, {}, { defaultOpen: true, duration: 4 }]) {
    it(`thinking, closed, open with a duration ${JSON.stringify(p)}`, async () => {
      current = p
      await both(react(p), Fixture)
    })
  }
})
