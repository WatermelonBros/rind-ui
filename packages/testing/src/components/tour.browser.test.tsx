// Tour scenarios that need layout (openspec add-tour 6.2): the cutout on screen, the spotlight
// variables and shield, scrolling with scroll-padding, a replaced and a lost target, stacking,
// a centred step after an anchored one, and no polling once placed.
import { Tour, type TourStepDef, type UseTourProps } from "@rind-ui/react"
import { cleanup, render, screen } from "@testing-library/react"
import { type ReactNode, useState } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { userEvent } from "vitest/browser"
import { getTour } from "../index"

afterEach(() => {
  cleanup()
  document.documentElement.style.scrollPaddingTop = ""
  window.scrollTo(0, 0)
})

const part = (name: string) =>
  document.querySelector<HTMLElement>(`[data-scope="tour"][data-part="${name}"]`)
const step = () => part("content")?.getAttribute("data-step") ?? null
const shownStep = async (id: string) => vi.waitFor(() => expect(step()).toBe(id))
const placed = async () =>
  vi.waitFor(() => expect(part("positioner")?.hasAttribute("data-placing")).toBe(false))
const byId = (id: string) => () => document.getElementById(id)
const px = (el: HTMLElement | null, name: string) =>
  Number.parseFloat(el?.style.getPropertyValue(name) ?? "NaN")

function Card({ children }: { readonly children?: ReactNode }) {
  return (
    <Tour.Portal>
      <Tour.Backdrop />
      <Tour.Spotlight />
      <Tour.Positioner>
        <Tour.Content style={{ width: 200, background: "white" }}>
          <Tour.Arrow />
          <Tour.Title />
          {children}
          <Tour.Actions>
            {(actions) =>
              actions.map((a) => <Tour.ActionTrigger key={String(a.action)} action={a} />)
            }
          </Tour.Actions>
          <Tour.CloseTrigger />
        </Tour.Content>
      </Tour.Positioner>
    </Tour.Portal>
  )
}

const nav = [{ action: "prev" as const }, { action: "next" as const }]

function App({ children, ...props }: Partial<UseTourProps> & { readonly children?: ReactNode }) {
  return (
    <div>
      {children}
      <Tour.Root steps={[]} {...props}>
        <Tour.Trigger>Take the tour</Tour.Trigger>
        <Card />
      </Tour.Root>
    </div>
  )
}

const box = (id: string, style: React.CSSProperties) => (
  <div id={id} style={{ position: "fixed", ...style }}>
    {id}
  </div>
)

describe("spotlight and backdrop", () => {
  it("cuts a padded, rounded hole around a 100 × 40 box at (200, 300)", async () => {
    const steps: TourStepDef[] = [{ id: "a", title: "A", target: byId("t") }]
    render(<App steps={steps}>{box("t", { left: 200, top: 300, width: 100, height: 40 })}</App>)
    await getTour(screen, { name: "Take the tour" }).start()
    await placed()
    const spot = part("spotlight")
    await vi.waitFor(() => expect(px(spot, "--rind-tour-spotlight-x")).toBe(192))
    expect(px(spot, "--rind-tour-spotlight-y")).toBe(292)
    expect(px(spot, "--rind-tour-spotlight-width")).toBe(116)
    expect(px(spot, "--rind-tour-spotlight-height")).toBe(56)
    const clip = part("backdrop")?.style.getPropertyValue("clip-path") ?? ""
    expect(clip).toContain("evenodd")
    // The browser serialises the path with spaces between commands and numbers.
    expect(clip).toContain("M 200 292 H 300 A 8 8 0 0 1 308 300")
    expect(part("backdrop")?.getAttribute("aria-hidden")).toBe("true")
    expect(part("spotlight")?.getAttribute("aria-hidden")).toBe("true")
  })

  it("a centred step after an anchored one has no opening, also after scrolling (shepherd#444)", async () => {
    const steps: TourStepDef[] = [
      { id: "a", title: "A", target: byId("t"), actions: nav },
      { id: "b", title: "B", actions: nav },
    ]
    render(
      <App steps={steps}>
        <div style={{ height: 3000 }}>{box("t", { left: 20, top: 20, width: 50, height: 50 })}</div>
      </App>,
    )
    const t = getTour(screen, { name: "Take the tour" })
    await t.start()
    await placed()
    await t.next()
    await shownStep("b")
    window.scrollTo(0, 400)
    await vi.waitFor(() =>
      expect(part("backdrop")?.style.getPropertyValue("clip-path")).toMatch(
        /^path\(evenodd, "M 0 0 H [\d.]+ V [\d.]+ H 0 Z"\)$/,
      ),
    )
    expect(part("spotlight")).toBeNull()
  })

  it("stacking: backdrop below spotlight below positioner (ark#4162)", async () => {
    render(
      <App steps={[{ id: "a", title: "A", target: byId("t") }]}>
        {box("t", { left: 10, top: 10, width: 40, height: 40 })}
      </App>,
    )
    await getTour(screen, { name: "Take the tour" }).start()
    await placed()
    const index = (name: string) => Number(part(name)?.style.getPropertyValue("--layer-index"))
    await vi.waitFor(() => expect(index("backdrop")).toBeLessThan(index("spotlight")))
    expect(index("spotlight")).toBeLessThan(index("positioner"))
  })

  it("the backdrop never blocks pointer events on the page", async () => {
    render(<App steps={[{ id: "a", title: "A" }]} />)
    await getTour(screen, { name: "Take the tour" }).start()
    expect(getComputedStyle(part("backdrop") as HTMLElement).pointerEvents).toBe("none")
  })

  it("after the last placement no frame callback of the tour runs (no polling loop)", async () => {
    render(
      <App steps={[{ id: "a", title: "A", target: byId("t") }]}>
        {box("t", { left: 10, top: 10, width: 40, height: 40 })}
      </App>,
    )
    await getTour(screen, { name: "Take the tour" }).start()
    await placed()
    // Let the first-placement focus and paint settle, then count new frame requests.
    await vi.waitFor(() => expect(document.activeElement).toBe(part("content")))
    // Drive five frames with the original function, counting what anyone else requests.
    const original = window.requestAnimationFrame.bind(window)
    const raf = vi.spyOn(window, "requestAnimationFrame")
    for (let i = 0; i < 5; i++) await new Promise<number>((r) => original(r))
    expect(raf).not.toHaveBeenCalled()
    raf.mockRestore()
  })
})

describe("target interaction and tracking", () => {
  it("the shield swallows presses on the target; the target is not inert", async () => {
    const onClick = vi.fn()
    render(
      <App steps={[{ id: "a", title: "A", target: byId("t"), preventTargetInteraction: true }]}>
        <button
          type="button"
          id="t"
          style={{ position: "fixed", left: 40, top: 200, width: 120, height: 40 }}
          onClick={onClick}
        >
          Delete
        </button>
      </App>,
    )
    await getTour(screen, { name: "Take the tour" }).start()
    await placed()
    expect(part("spotlight")?.hasAttribute("data-shield")).toBe(true)
    await vi.waitFor(() => expect(px(part("spotlight"), "--rind-tour-spotlight-x")).toBe(32))
    await userEvent.click(screen.getByRole("button", { name: "Delete" }), { force: true })
    expect(onClick).not.toHaveBeenCalled()
    expect(document.getElementById("t")?.closest("[inert]")).toBeNull()
    expect(step()).toBe("a")
  })

  it("follows a re-rendered target (shepherd#580) and goes back to preparing when it is removed", async () => {
    function Swap() {
      const [key, setKey] = useState(0)
      const [shown, setShown] = useState(true)
      return (
        <>
          <button type="button" onClick={() => setKey((k) => k + 1)}>
            Replace
          </button>
          <button type="button" onClick={() => setShown(false)}>
            Remove
          </button>
          {shown ? (
            <div
              key={key}
              id="t"
              style={{ position: "fixed", left: 100 + key * 200, top: 100, width: 50, height: 50 }}
            />
          ) : null}
        </>
      )
    }
    render(
      <App steps={[{ id: "a", title: "A", target: byId("t"), timeout: 60_000 }]}>
        <Swap />
      </App>,
    )
    await getTour(screen, { name: "Take the tour" }).start()
    await placed()
    await userEvent.click(screen.getByRole("button", { name: "Replace" }))
    await vi.waitFor(() => expect(px(part("spotlight"), "--rind-tour-spotlight-x")).toBe(292))
    expect(document.getElementById("t")?.getAttribute("data-rind-tour-target")).not.toBeNull()
    await userEvent.click(screen.getByRole("button", { name: "Remove" }))
    await vi.waitFor(() => expect(part("backdrop")?.getAttribute("data-phase")).toBe("preparing"))
    expect(part("content")).toBeNull()
  })

  it("scrolls the target into view honouring scroll-padding (driver.js#580)", async () => {
    document.documentElement.style.scrollPaddingTop = "80px"
    render(
      <App steps={[{ id: "a", title: "A", target: byId("far") }]}>
        <div style={{ height: 2000 }} />
        <div id="far" style={{ height: 40 }}>
          Far
        </div>
        <div style={{ height: 2000 }} />
      </App>,
    )
    await getTour(screen, { name: "Take the tour" }).start()
    await vi.waitFor(() =>
      expect(document.getElementById("far")?.getBoundingClientRect().top).toBeGreaterThanOrEqual(
        80,
      ),
    )
    const top = document.getElementById("far")?.getBoundingClientRect().top ?? 0
    expect(top).toBeLessThan(window.innerHeight)
  })

  it("a sticky card over a target that fills the viewport stays inside it", async () => {
    render(
      <App
        steps={[
          { id: "a", title: "A", target: byId("big"), side: "left", align: "start", sticky: true },
        ]}
      >
        {box("big", { inset: 0 })}
      </App>,
    )
    await getTour(screen, { name: "Take the tour" }).start()
    await placed()
    // Tracking settles the card inside the viewport (shifted over its target).
    await vi.waitFor(() => {
      const r = part("content")?.getBoundingClientRect()
      expect(r?.left).toBeGreaterThanOrEqual(0)
      expect(r?.top).toBeGreaterThanOrEqual(0)
      expect(r?.right).toBeLessThanOrEqual(window.innerWidth)
    })
  })
})

describe("spotlight motion and timing", () => {
  it("transitions on a step change only, never on scroll or resize", async () => {
    // The theme's rule, scoped to the marker the tour sets for one step change.
    const style = document.createElement("style")
    style.textContent =
      '[data-part="spotlight"][data-step-changing]{transition:left 80ms linear,top 80ms linear}'
    document.head.append(style)
    try {
      const steps: TourStepDef[] = [
        { id: "a", title: "A", target: byId("t1"), actions: nav },
        { id: "b", title: "B", target: byId("t2"), actions: nav },
      ]
      render(
        <App steps={steps}>
          <div style={{ height: 3000 }}>
            {box("t1", { left: 20, top: 20, width: 40, height: 40 })}
            {box("t2", { left: 300, top: 200, width: 40, height: 40 })}
          </div>
        </App>,
      )
      const t = getTour(screen, { name: "Take the tour" })
      await t.start()
      await placed()
      const spot = () => part("spotlight") as HTMLElement
      // The first step of a run does not animate in.
      expect(spot().hasAttribute("data-step-changing")).toBe(false)
      await t.next()
      await shownStep("b")
      await vi.waitFor(() => expect(spot().getAnimations().length).toBeGreaterThan(0))
      expect(spot().hasAttribute("data-step-changing")).toBe(true)
      // The step change runs to its end (a condition, with a deadline), which ends the marker.
      await vi.waitFor(() => expect(spot().hasAttribute("data-step-changing")).toBe(false))
      expect(spot().getAnimations()).toHaveLength(0)
      // A scroll after it: the spotlight follows its target without animating.
      const target = document.getElementById("t2") as HTMLElement
      target.style.top = "260px"
      window.dispatchEvent(new Event("scroll"))
      await vi.waitFor(() => expect(px(spot(), "--rind-tour-spotlight-y")).toBe(252))
      expect(spot().getAnimations()).toHaveLength(0)
      target.style.top = "300px"
      window.dispatchEvent(new Event("resize"))
      await vi.waitFor(() => expect(px(spot(), "--rind-tour-spotlight-y")).toBe(292))
      expect(spot().getAnimations()).toHaveLength(0)
    } finally {
      style.remove()
    }
  })

  it("prepareTimeout defaults to 5000 ms (fake timers, no real time)", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] })
    try {
      const onMissingTarget = vi.fn()
      render(
        <App
          onMissingTarget={onMissingTarget}
          steps={[
            { id: "gone", title: "Gone", target: () => document.getElementById("nope") },
            { id: "next", title: "Next" },
          ]}
        />,
      )
      // No vi.waitFor before the advance: it moves fake timers by itself.
      await userEvent.click(screen.getByRole("button", { name: "Take the tour" }))
      vi.advanceTimersByTime(4999)
      expect(onMissingTarget).not.toHaveBeenCalled()
      vi.advanceTimersByTime(1)
      expect(onMissingTarget).toHaveBeenCalledWith({ stepId: "gone", policy: "skip" })
      await shownStep("next")
    } finally {
      vi.useRealTimers()
    }
  })
})
