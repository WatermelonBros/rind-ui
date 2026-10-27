// Carousel (React) through its driver (spec carousel): a named region of slides grouped into
// pages, the ones off the page inert; Prev/Next aria-disabled at the ends; indicators a roving
// tablist; user changes announced, autoplay silent; hover pauses, focus stops; server HTML and
// hydration. Scrolling needs layout: carousel.browser.test.tsx.
import { Carousel, type CarouselRootProps, RindProvider } from "@rind-ui/react"
import { act, render, screen } from "@testing-library/react"
import axe from "axe-core"
import { StrictMode } from "react"
import { hydrateRoot } from "react-dom/client"
import { renderToString } from "react-dom/server"
import { afterEach, describe, expect, it, vi } from "vitest"
import { getCarousel, recordingAnnouncer, virtualClock } from "../index"

afterEach(() => vi.restoreAllMocks())

function Gallery({ slides = 4, ...props }: Partial<CarouselRootProps> & { slides?: number }) {
  return (
    <Carousel.Root aria-label="Featured" {...props}>
      <Carousel.Viewport>
        {Array.from({ length: slides }, (_, i) => i).map((i) => (
          <Carousel.Slide key={i} index={i}>
            Slide {i + 1} <a href={`#s${i}`}>Open</a>
          </Carousel.Slide>
        ))}
      </Carousel.Viewport>
      <Carousel.Control>
        <Carousel.PrevTrigger>‹</Carousel.PrevTrigger>
        <Carousel.NextTrigger>›</Carousel.NextTrigger>
        <Carousel.AutoplayTrigger>⏯</Carousel.AutoplayTrigger>
      </Carousel.Control>
      <Carousel.IndicatorGroup>
        {({ pages }) =>
          Array.from({ length: pages }, (_, p) => p).map((p) => (
            <Carousel.Indicator key={p} index={p} />
          ))
        }
      </Carousel.IndicatorGroup>
      <Carousel.Status />
    </Carousel.Root>
  )
}

function setup(props: Parameters<typeof Gallery>[0] = {}) {
  const clock = virtualClock()
  const rec = recordingAnnouncer()
  const r = render(
    <RindProvider
      announcer={rec.announcer}
      environment={{
        scheduler: clock.scheduler,
        clock: clock.clock,
        reducedMotion: false,
        // A visible page, whatever the test browser's tab is: a hidden page pauses autoplay
        // (its own test), and a CI runner's background tab is hidden.
        visibility: { hidden: () => false, subscribe: () => () => {} },
      }}
    >
      <Gallery {...props} />
      <button type="button">Outside</button>
    </RindProvider>,
  )
  const q = (sel: string) => r.container.querySelector<HTMLElement>(sel)
  const qa = (sel: string) => [...r.container.querySelectorAll<HTMLElement>(sel)]
  return {
    host: r.container,
    q,
    qa,
    log: rec.log,
    advance: (ms: number) => act(() => clock.advance(ms)),
    d: () => getCarousel(document.body, { name: "Featured" }),
  }
}

const settle = () => act(async () => {})

describe("React Carousel", () => {
  it("a named region of slide groups; off-page slides inert; a tablist of pages", async () => {
    const t = setup()
    await settle()
    const region = screen.getByRole("region", { name: "Featured" })
    expect(region.getAttribute("aria-roledescription")).toBe("carousel")
    const slides = t.qa('[data-part="slide"]')
    expect(slides[1]?.getAttribute("aria-label")).toBe("2 of 4")
    expect(slides[1]?.getAttribute("role")).toBe("group")
    expect(slides[0]?.hasAttribute("inert")).toBe(false)
    expect(slides[1]?.hasAttribute("inert")).toBe(true)
    expect(screen.getAllByRole("tab")).toHaveLength(4)
    expect(await t.d().pageCount()).toBe(4)
    expect(await t.d().statusText()).toBe("1 / 4")
    expect(t.q('[data-part="prev-trigger"]')?.getAttribute("aria-disabled")).toBe("true")
    const { violations } = await axe.run(t.host, {
      rules: { region: { enabled: false }, "color-contrast": { enabled: false } },
    })
    expect(violations.map((v) => v.id)).toEqual([])
  })

  it("Next and Prev move a page, announced; at the ends they do nothing unless loop", async () => {
    const onPageChange = vi.fn()
    const t = setup({ onPageChange })
    await settle()
    await t.d().next()
    expect(await t.d().page()).toBe(1)
    expect(t.log.at(-1)).toMatchObject({ message: "Slide 2 of 4", priority: "polite" })
    expect(onPageChange.mock.lastCall?.[1].event.reason).toBe("trigger")
    await t.d().prev()
    await t.d().prev()
    expect(await t.d().page()).toBe(0)
  })

  it("loop: Prev on the first page goes to the last", async () => {
    const t = setup({ loop: true })
    await settle()
    expect(t.q('[data-part="prev-trigger"]')?.hasAttribute("aria-disabled")).toBe(false)
    await t.d().prev()
    expect(await t.d().page()).toBe(3)
  })

  it("indicators: one tab stop; arrows select and move the focus", async () => {
    const t = setup()
    await settle()
    const tabs = screen.getAllByRole("tab")
    expect(tabs.map((b) => b.tabIndex)).toEqual([0, -1, -1, -1])
    await t.d().via("keyboard").goTo(2)
    expect(await t.d().page()).toBe(2)
    expect(document.activeElement).toBe(screen.getAllByRole("tab")[2])
    expect(screen.getAllByRole("tab")[2]?.getAttribute("aria-selected")).toBe("true")
    await t.d().via("pointer").goTo(0)
    expect(await t.d().page()).toBe(0)
  })

  it("slidesPerPage groups slides into pages", async () => {
    const t = setup({ slides: 5, slidesPerPage: 2 })
    await settle()
    expect(await t.d().pageCount()).toBe(3)
    expect(t.qa('[data-part="slide"][data-current]').map((s) => s.dataset["index"])).toEqual([
      "0",
      "1",
    ])
  })

  it("autoplay advances silently, pauses on hover, and the trigger stops it", async () => {
    const onAutoplayChange = vi.fn()
    const t = setup({ autoplay: true, autoplayDelay: 1000, onAutoplayChange })
    await settle()
    expect(await t.d().isPlaying()).toBe(true)
    expect(t.q('[data-part="autoplay-trigger"]')?.getAttribute("aria-label")).toBe(
      "Stop automatic slide show",
    )
    t.advance(1000)
    expect(await t.d().page()).toBe(1)
    expect(t.log).toEqual([])
    const root = t.q('[data-part="root"]') as HTMLElement
    act(() => {
      root.dispatchEvent(new PointerEvent("pointerover", { bubbles: true, pointerType: "mouse" }))
    })
    await vi.waitFor(() => expect(root.dataset["autoplay"]).toBe("paused"))
    t.advance(5000)
    expect(await t.d().page()).toBe(1)
    act(() => {
      root.dispatchEvent(new PointerEvent("pointerout", { bubbles: true, pointerType: "mouse" }))
    })
    await vi.waitFor(() => expect(root.dataset["autoplay"]).toBe("playing"))
    await t.d().via("pointer").pause()
    expect(await t.d().isPlaying()).toBe(false)
    // The press's focus does not stop it first (else the toggle would restart it).
    expect(onAutoplayChange).toHaveBeenLastCalledWith(false, { reason: "user" })
  })

  it("focus moving in stops autoplay", async () => {
    const t = setup({ autoplay: true, autoplayDelay: 1000 })
    await settle()
    act(() => (t.q('[data-part="next-trigger"]') as HTMLElement).focus())
    expect(await t.d().isPlaying()).toBe(false)
  })

  it("server HTML (slideCount) hydrates without a warning", async () => {
    const tree = (
      <StrictMode>
        <RindProvider>
          <Gallery slideCount={4} />
        </RindProvider>
      </StrictMode>
    )
    const container = document.createElement("div")
    container.innerHTML = renderToString(tree)
    expect(container.querySelectorAll('[role="tab"]')).toHaveLength(4)
    document.body.append(container)
    // This test drives React with act(): say so, whatever another file in the same page set.
    ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
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
