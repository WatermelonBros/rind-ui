// Model-based tests (add-reasoning 3.1): the user's toggle by every modality and the thinking
// lifecycle as prop steps on a virtual clock (a short auto-close delay: the runner waits out
// the longest delay in its no-change checks); the disclosure trait,
// the generic invariants and axe after every step.
import { reasoningContract, reasoningMessages } from "@rind-ui/core"
import { Reasoning, RindProvider } from "@rind-ui/react"
import { render } from "@testing-library/react"
import axe from "axe-core"
import { describe, it } from "vitest"
import { domEnv, testMachine, virtualClock } from "../index"

const a11y = async () => {
  const { violations } = await axe.run(document.body, {
    rules: { region: { enabled: false }, "color-contrast": { enabled: false } },
  })
  if (violations.length > 0) throw new Error(violations.map((v) => `${v.id}: ${v.help}`).join("\n"))
}

const clock = virtualClock()
const ui = (thinking: boolean) => (
  <RindProvider environment={{ scheduler: clock.scheduler, clock: clock.clock }}>
    <Reasoning.Root thinking={thinking} autoCloseDelay={200}>
      <Reasoning.Trigger />
      <Reasoning.Content>The moon pulls the water.</Reasoning.Content>
    </Reasoning.Root>
  </RindProvider>
)

describe("reasoning model", () => {
  testMachine(reasoningContract, {
    // axe after every step of three-step paths: longer than the default 5 s in jsdom.
    test: (name: string, fn: () => Promise<void>) => it(name, fn, 20_000),
    setup: () => render(ui(false)),
    rerender: (next: unknown, rendered: ReturnType<typeof render>) =>
      rendered.rerender(ui((next as { thinking: boolean }).thinking)),
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
