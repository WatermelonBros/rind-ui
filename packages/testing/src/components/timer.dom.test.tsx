// Timer (React) through its driver (spec timer): anatomy and role=timer, a disabled trigger
// keeps focus, toggle and completion on a virtual clock, server HTML and hydration.
import { RindProvider, Timer, type TimerRootProps } from "@rind-ui/react"
import { act, render, screen } from "@testing-library/react"
import { userEvent } from "@testing-library/user-event"
import { StrictMode } from "react"
import { hydrateRoot } from "react-dom/client"
import { renderToString } from "react-dom/server"
import { afterEach, describe, expect, it, vi } from "vitest"
import { getTimer, recordingAnnouncer, virtualClock } from "../index"

afterEach(() => vi.restoreAllMocks())

function Countdown(props: Partial<TimerRootProps>) {
  return (
    <Timer.Root countdown startMs={65_000} {...props}>
      <Timer.Area>
        <Timer.Item type="minutes">
          <Timer.ItemValue />
          <Timer.ItemLabel>min</Timer.ItemLabel>
        </Timer.Item>
        <Timer.Separator>:</Timer.Separator>
        <Timer.Item type="seconds">
          <Timer.ItemValue />
        </Timer.Item>
      </Timer.Area>
      <Timer.Control>
        <Timer.ActionTrigger action="toggle">{({ label }) => label}</Timer.ActionTrigger>
        <Timer.ActionTrigger action="pause" />
        <Timer.ActionTrigger action="reset">Reset</Timer.ActionTrigger>
      </Timer.Control>
    </Timer.Root>
  )
}

function setup(node: React.ReactNode) {
  const clock = virtualClock()
  const rec = recordingAnnouncer()
  render(
    <RindProvider
      announcer={rec.announcer}
      environment={{ scheduler: clock.scheduler, clock: clock.clock }}
    >
      {node}
    </RindProvider>,
  )
  const advance = (ms: number) => act(() => clock.advance(ms))
  return { log: rec.log, advance }
}

const part = (name: string) => document.querySelector(`[data-scope="timer"][data-part="${name}"]`)

describe("timer anatomy", () => {
  it("one role=timer named by the duration in words; units in two digits; separator hidden", async () => {
    setup(<Countdown />)
    const area = screen.getByRole("timer")
    expect(area.getAttribute("aria-label")).toBe("1 minute, 5 seconds")
    expect(area.getAttribute("aria-atomic")).toBe("true")
    expect(await getTimer(screen).text()).toBe("01min:05")
    expect(part("separator")?.getAttribute("aria-hidden")).toBe("true")
    expect(part("root")?.hasAttribute("data-countdown")).toBe(true)
    for (const el of document.querySelectorAll('[data-scope="timer"]')) {
      expect(el.getAttribute("data-state")).toBe("idle")
    }
    expect(document.querySelector('[data-part="item-value"]')?.getAttribute("data-type")).toBe(
      "minutes",
    )
  })

  it("triggers are buttons named by their content; the default is the action's word", () => {
    setup(<Countdown />)
    expect(screen.getByRole("button", { name: "Start" }).getAttribute("type")).toBe("button")
    expect(document.querySelector('[data-action="pause"]')?.textContent).toBe("Pause")
    expect(screen.getByRole("button", { name: "Reset" })).toBeTruthy()
  })
})

describe("timer actions", () => {
  it("toggle runs, pauses and resumes on the virtual clock; its label follows", async () => {
    const onStateChange = vi.fn()
    const { advance } = setup(<Countdown onStateChange={onStateChange} />)
    const d = getTimer(screen)
    await d.toggle()
    expect(await d.state()).toBe("running")
    expect(document.querySelector('[data-action="toggle"]')?.textContent).toBe("Pause")
    advance(3000)
    expect(await d.text()).toBe("01min:02")
    await d.toggle()
    expect(await d.state()).toBe("paused")
    advance(5000)
    expect(await d.text()).toBe("01min:02")
    expect(document.querySelector('[data-action="toggle"]')?.textContent).toBe("Resume")
    expect(onStateChange.mock.calls.map((c) => c[0])).toEqual(["running", "paused"])
  })

  it("a trigger whose action does nothing is aria-disabled, stays focusable and keeps focus", async () => {
    setup(<Countdown />)
    const user = userEvent.setup()
    const pause = document.querySelector('[data-action="pause"]') as HTMLButtonElement
    expect(pause.getAttribute("aria-disabled")).toBe("true")
    expect(pause.disabled).toBe(false)
    expect(pause.hasAttribute("hidden")).toBe(false)
    await user.click(pause)
    expect(document.activeElement).toBe(pause)
    expect(await getTimer(screen).state()).toBe("idle")
    await user.keyboard("{Enter}")
    expect(document.activeElement).toBe(pause)
    expect(await getTimer(screen).state()).toBe("idle")
  })

  it("completion announces Time's up once, politely; reset goes back to the start", async () => {
    const onComplete = vi.fn()
    const { log, advance } = setup(<Countdown startMs={2000} onComplete={onComplete} />)
    const d = getTimer(screen)
    await d.toggle()
    advance(2000)
    expect(await d.state()).toBe("completed")
    expect(await d.text()).toBe("00min:00")
    expect(onComplete).toHaveBeenCalledTimes(1)
    expect(log.map((a) => [a.message, a.priority])).toEqual([["Time's up", "polite"]])
    expect(document.querySelector('[data-action="toggle"]')?.textContent).toBe("Start")
    await d.reset()
    expect(await d.state()).toBe("idle")
    expect(await d.text()).toBe("00min:02")
  })
})

describe("timer server rendering", () => {
  it("server HTML hydrates without a warning", async () => {
    const tree = (
      <StrictMode>
        <RindProvider>
          <Countdown />
        </RindProvider>
      </StrictMode>
    )
    const container = document.createElement("div")
    container.innerHTML = renderToString(tree)
    expect(container.querySelector('[role="timer"]')?.getAttribute("aria-label")).toBe(
      "1 minute, 5 seconds",
    )
    document.body.append(container)
    const error = vi.spyOn(console, "error").mockImplementation(() => {})
    let root: ReturnType<typeof hydrateRoot> | undefined
    await act(async () => {
      root = hydrateRoot(container, tree, { onRecoverableError: (e) => error(String(e)) })
    })
    expect(error.mock.calls).toEqual([])
    await act(async () => root?.unmount())
    container.remove()
  })
})
