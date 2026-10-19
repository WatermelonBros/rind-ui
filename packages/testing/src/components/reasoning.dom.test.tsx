// Reasoning through its driver (spec reasoning): the disclosure, the live lifecycle on a
// virtual clock, mount silence, the user's toggle, focus inside, the duration, announcements.
import { Reasoning, type ReasoningRootProps, RindProvider } from "@rind-ui/react"
import { act, render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { getReasoning, recordingAnnouncer, virtualClock } from "../index"

function setup(initial: Partial<ReasoningRootProps> = {}) {
  const rec = recordingAnnouncer()
  const clock = virtualClock()
  const tree = (p: Partial<ReasoningRootProps>) => (
    <RindProvider
      announcer={rec.announcer}
      environment={{ scheduler: clock.scheduler, clock: clock.clock }}
    >
      <Reasoning.Root thinking={false} {...p}>
        <Reasoning.Trigger />
        <Reasoning.Content>
          The user asks about tides. <a href="#moon">The moon</a> pulls the water.
        </Reasoning.Content>
      </Reasoning.Root>
    </RindProvider>
  )
  let current = initial
  const view = render(tree(current))
  const update = (next: Partial<ReasoningRootProps>) => {
    current = { ...current, ...next }
    view.rerender(tree(current))
  }
  return {
    d: getReasoning(screen),
    update,
    advance: (ms: number) => act(() => clock.advance(ms)),
    said: () => rec.log.map((a) => a.message),
  }
}

describe("reasoning", () => {
  it("live: opens, says Thinking…, then Thought for 12 seconds, closes after a second", async () => {
    const { d, update, advance, said } = setup()
    update({ thinking: true })
    expect(await d.isOpen()).toBe(true)
    expect(await d.triggerText()).toBe("Thinking…")
    expect(screen.getByText(/tides/).closest("[aria-busy]")).toBeTruthy()
    await advance(11_200)
    update({ thinking: false })
    expect(await d.triggerText()).toBe("Thought for 12 seconds")
    await advance(1000)
    expect(await d.isOpen()).toBe(false)
    expect(said()).toEqual(["Thinking…", "Thought for 12 seconds"])
  })

  it("an old message stays closed and silent", async () => {
    const { d, said } = setup({ thinking: false, duration: 4 })
    expect(await d.isOpen()).toBe(false)
    expect(await d.triggerText()).toBe("Thought for 4 seconds")
    expect(screen.getByRole("button").getAttribute("aria-controls")).toBeNull()
    expect(said()).toEqual([])
  })

  it("the user's toggle wins over the auto-close", async () => {
    const { d, update, advance } = setup()
    update({ thinking: true })
    await d.toggle()
    await d.toggle()
    update({ thinking: false })
    await advance(5000)
    expect(await d.isOpen()).toBe(true)
  })

  it("focus inside the content blocks the auto-close", async () => {
    const { d, update, advance } = setup()
    update({ thinking: true })
    act(() => screen.getByRole("link", { name: "The moon" }).focus())
    update({ thinking: false })
    await advance(2000)
    expect(await d.isOpen()).toBe(true)
  })
})
