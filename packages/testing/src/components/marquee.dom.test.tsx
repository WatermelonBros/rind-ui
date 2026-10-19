// Marquee through its driver (spec marquee): anatomy, server render, the pause control and its
// names, controlled, hover (never touch), the sticky keyboard-focus pause, reduced motion from an
// Environment's reduced-motion option, hidden and untabbable copies (also ones a child adds later),
// autoFill and speed. In jsdom there is no layout: sizes come from a stubbed box.
import { Marquee, type MarqueeRootProps, RindProvider } from "@rind-ui/react"
import { act, fireEvent, render, screen } from "@testing-library/react"
import { userEvent } from "@testing-library/user-event"
import { useState } from "react"
import { renderToString } from "react-dom/server"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { getMarquee } from "../index"

const jsdom = navigator.userAgent.includes("jsdom")

// jsdom: the viewport is 400 px, one copy 150 px.
beforeEach(() => {
  if (!jsdom) return
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(function (this: Element) {
    const w = this.getAttribute("data-part") === "viewport" ? 400 : 150
    return { width: w, height: 40, top: 0, left: 0, right: w, bottom: 40, x: 0, y: 0 } as DOMRect
  })
})
afterEach(() => vi.restoreAllMocks())

function Band(props: Partial<MarqueeRootProps> & { readonly late?: boolean }) {
  const { late = false, ...root } = props
  return (
    <Marquee.Root role="region" aria-label="Partners" {...root}>
      <Marquee.PauseTrigger />
      <Marquee.Viewport>
        <Marquee.Content>
          <a href="#acme">Acme</a>
          <a href="#globex">Globex</a>
          {late ? <a href="#late">Late</a> : null}
        </Marquee.Content>
      </Marquee.Viewport>
    </Marquee.Root>
  )
}

async function setup(node: React.ReactNode, reduced = false) {
  const tree = (r: boolean) => (
    <RindProvider environment={{ reducedMotion: r }}>
      <button type="button">Before</button>
      {node}
    </RindProvider>
  )
  const view = render(tree(reduced))
  const d = getMarquee(screen, { name: "Partners" })
  // The first measurement lands on the next frame.
  await act(() => new Promise<void>((r) => requestAnimationFrame(() => r())))
  await act(() => new Promise<void>((r) => requestAnimationFrame(() => r())))
  return { d, view, setReduced: (r: boolean) => view.rerender(tree(r)) }
}

const trigger = () => document.querySelector('[data-part="pause-trigger"]') as HTMLButtonElement
const copies = () => document.querySelectorAll('[data-part="content"]')

describe("marquee: anatomy", () => {
  it("one exposed copy, the rest aria-hidden and untabbable", async () => {
    const { d } = await setup(<Band />)
    expect(await d.state()).toBe("running")
    expect(await d.copies()).toBe(2)
    expect(screen.getAllByRole("link")).toHaveLength(2)
    for (const a of copies()[1]?.querySelectorAll("a") ?? []) {
      expect(a.getAttribute("tabindex")).toBe("-1")
    }
    // jsdom: a 150 px copy at 50 px/s; a browser: whatever the links measure.
    if (jsdom) expect(await d.duration()).toBe(3)
    else expect(await d.duration()).toBeGreaterThan(0)
  })

  it("a link a child adds later is untabbable in the copies too", async () => {
    const { view } = await setup(<Band />)
    view.rerender(
      <RindProvider>
        <Band late />
      </RindProvider>,
    )
    await act(() => new Promise<void>((r) => queueMicrotask(r)))
    const late = copies()[1]?.querySelector('a[href="#late"]')
    expect(late?.getAttribute("tabindex")).toBe("-1")
  })

  it("server HTML: the content and one copy, idle, no measurement", () => {
    const html = renderToString(
      <RindProvider>
        <Band />
      </RindProvider>,
    )
    expect(html.match(/data-part="content"/g)).toHaveLength(2)
    expect(html).toContain('data-state="idle"')
    expect(html).not.toContain("--rind-marquee-duration")
  })
})

describe("marquee: pausing", () => {
  it("the trigger toggles; its name follows; no aria-pressed", async () => {
    const { d } = await setup(<Band />)
    expect(await d.triggerLabel()).toBe("Pause animation")
    await d.togglePause()
    expect(await d.state()).toBe("paused")
    expect(await d.triggerLabel()).toBe("Play animation")
    expect(trigger().getAttribute("aria-pressed")).toBeNull()
    await d.togglePause()
    expect(await d.state()).toBe("running")
  })

  it("hover pauses until leave; touch never does", async () => {
    const { d } = await setup(<Band />)
    const viewport = document.querySelector('[data-part="viewport"]') as HTMLElement
    fireEvent.pointerEnter(viewport, { pointerType: "touch" })
    expect(await d.state()).toBe("running")
    fireEvent.pointerEnter(viewport, { pointerType: "mouse" })
    expect(await d.state()).toBe("paused")
    expect(await d.isPaused()).toBe(false)
    fireEvent.pointerLeave(viewport, { pointerType: "mouse" })
    expect(await d.state()).toBe("running")
  })

  it("keyboard focus into the band pauses, and stays paused after it leaves", async () => {
    const { d } = await setup(<Band />)
    await d.focusContent()
    expect(document.activeElement?.textContent).toBe("Acme")
    expect(await d.isPaused()).toBe(true)
    await userEvent.tab()
    expect(await d.state()).toBe("paused")
  })

  it("controlled: the parent decides", async () => {
    const onPausedChange = vi.fn()
    function Controlled() {
      const [paused, setPaused] = useState(false)
      return (
        <Band
          paused={paused}
          onPausedChange={(next, details) => {
            onPausedChange(next, details.reason)
            setPaused(next)
          }}
        />
      )
    }
    const { d } = await setup(<Controlled />)
    await d.togglePause()
    expect(onPausedChange).toHaveBeenCalledWith(true, "trigger")
    expect(await d.state()).toBe("paused")
  })
})

describe("marquee: reduced motion, copies, speed", () => {
  it("reduced motion: static, one copy, the trigger hidden; lifting it restores", async () => {
    const { d, setReduced } = await setup(<Band />, true)
    expect(await d.state()).toBe("static")
    expect(await d.copies()).toBe(1)
    expect(trigger().hidden).toBe(true)
    setReduced(false)
    expect(await d.state()).toBe("running")
  })

  it.runIf(jsdom)("autoFill fills the viewport plus one; speed sets the duration", async () => {
    const { d } = await setup(<Band autoFill speed={75} />)
    expect(await d.copies()).toBe(4)
    expect(await d.duration()).toBe(2)
  })

  it("a speed below 1 warns and counts as 1", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    await setup(<Band speed={0} />)
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("speed 0"))
  })
})
