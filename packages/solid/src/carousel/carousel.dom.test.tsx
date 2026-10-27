/** @jsxImportSource solid-js */
// Carousel's Solid parts through its driver: a named region of slides grouped into pages, the
// ones off the page inert; Prev/Next aria-disabled at the ends; indicators a roving tablist;
// user changes announced, autoplay silent; hover pauses, focus stops. Scrolling needs layout
// (browser engines only): Next scrolls the Viewport, a user's scroll settles the page.
import { getCarousel, recordingAnnouncer, virtualClock } from "@rind-ui/testing"
import axe from "axe-core"
import { For } from "solid-js"
import { describe, expect, it, vi } from "vitest"
import { mount } from "../../fixtures/mount"
import { RindProvider } from "../index"
import { Carousel, type CarouselRootProps } from "./index"

/** Lets mount effects and registrations run (microtasks, no elapsed time). */
const settle = async () => {
  for (let i = 0; i < 4; i++) await Promise.resolve()
}
/** Scrolling needs layout: jsdom has no boxes. */
const jsdom = typeof navigator !== "undefined" && navigator.userAgent.includes("jsdom")

type Props = Partial<CarouselRootProps> & { slides?: number }

function setup(props: Props = {}, env: { reducedMotion?: boolean; real?: boolean } = {}) {
  const clock = virtualClock()
  const rec = recordingAnnouncer()
  const { slides = 4, ...root } = props
  const m = mount(() => (
    <RindProvider
      announcer={rec.announcer}
      environment={
        env.real
          ? { reducedMotion: true }
          : {
              scheduler: clock.scheduler,
              clock: clock.clock,
              reducedMotion: false,
              // A visible page whatever the test browser's tab is (a CI runner's background tab is hidden).
              visibility: { hidden: () => false, subscribe: () => () => {} },
            }
      }
    >
      <Carousel.Root aria-label="Featured" {...root}>
        <Carousel.Viewport style={env.real ? { width: "300px" } : {}}>
          <For each={Array.from({ length: slides }, (_, i) => i)}>
            {(i) => (
              <Carousel.Slide index={i} style={env.real ? { width: "100%", height: "100px" } : {}}>
                Slide {i + 1} <a href={`#s${i}`}>Open</a>
              </Carousel.Slide>
            )}
          </For>
        </Carousel.Viewport>
        <Carousel.Control>
          <Carousel.PrevTrigger>‹</Carousel.PrevTrigger>
          <Carousel.NextTrigger>›</Carousel.NextTrigger>
          <Carousel.AutoplayTrigger>⏯</Carousel.AutoplayTrigger>
        </Carousel.Control>
        <Carousel.IndicatorGroup>
          {(s) => (
            <For each={Array.from({ length: s.pages }, (_, p) => p)}>
              {(p) => <Carousel.Indicator index={p} />}
            </For>
          )}
        </Carousel.IndicatorGroup>
        <Carousel.Status />
      </Carousel.Root>
      <button type="button">Outside</button>
    </RindProvider>
  ))
  const q = (sel: string) => m.host.querySelector<HTMLElement>(sel)
  const qa = (sel: string) => [...m.host.querySelectorAll<HTMLElement>(sel)]
  return {
    ...m,
    q,
    qa,
    log: rec.log,
    advance: (ms: number) => clock.advance(ms),
    tabs: () => qa('[role="tab"]'),
    d: () => getCarousel(document.body, { name: "Featured" }),
  }
}

describe("Solid Carousel", () => {
  it("a named region of slide groups; off-page slides inert; a tablist of pages", async () => {
    const t = setup()
    await settle()
    const region = t.q('[data-part="root"]') as HTMLElement
    expect(region.tagName).toBe("SECTION")
    expect(region.getAttribute("aria-roledescription")).toBe("carousel")
    expect(region.getAttribute("aria-label")).toBe("Featured")
    const slides = t.qa('[data-part="slide"]')
    expect(slides[1]?.getAttribute("aria-label")).toBe("2 of 4")
    expect(slides[1]?.getAttribute("role")).toBe("group")
    expect(slides[0]?.hasAttribute("inert")).toBe(false)
    expect(slides[1]?.hasAttribute("inert")).toBe(true)
    expect(t.tabs()).toHaveLength(4)
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
    expect(t.tabs().map((b) => b.tabIndex)).toEqual([0, -1, -1, -1])
    await t.d().via("keyboard").goTo(2)
    expect(await t.d().page()).toBe(2)
    expect(document.activeElement).toBe(t.tabs()[2])
    expect(t.tabs()[2]?.getAttribute("aria-selected")).toBe("true")
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
    root.dispatchEvent(new PointerEvent("pointerenter", { pointerType: "mouse" }))
    await vi.waitFor(() => expect(root.dataset["autoplay"]).toBe("paused"))
    t.advance(5000)
    expect(await t.d().page()).toBe(1)
    root.dispatchEvent(new PointerEvent("pointerleave", { pointerType: "mouse" }))
    await vi.waitFor(() => expect(root.dataset["autoplay"]).toBe("playing"))
    await t.d().via("pointer").pause()
    expect(await t.d().isPlaying()).toBe(false)
    // The press's focus does not stop it first (else the toggle would restart it).
    expect(onAutoplayChange).toHaveBeenLastCalledWith(false, { reason: "user" })
  })

  it("focus moving in stops autoplay", async () => {
    const t = setup({ autoplay: true, autoplayDelay: 1000 })
    await settle()
    ;(t.q('[data-part="next-trigger"]') as HTMLElement).focus()
    expect(await t.d().isPlaying()).toBe(false)
  })

  it.skipIf(jsdom)("Next scrolls the Viewport and no scroll is reported back", async () => {
    const onPageChange = vi.fn()
    const t = setup({ onPageChange }, { real: true })
    await settle()
    await t.d().next()
    const viewport = t.q('[data-part="viewport"]') as HTMLElement
    await vi.waitFor(() => expect(viewport.scrollLeft).toBe(300))
    expect(await t.d().page()).toBe(1)
    expect(onPageChange.mock.calls.map((c) => c[1].event.type)).toEqual(["NEXT"])
  })

  it.skipIf(jsdom)("a user's scroll settles the page, unannounced", async () => {
    const onPageChange = vi.fn()
    const t = setup({ onPageChange }, { real: true })
    const viewport = t.q('[data-part="viewport"]') as HTMLElement
    await vi.waitFor(() => expect(viewport.querySelectorAll("[data-current]")).toHaveLength(1))
    viewport.scrollTo({ left: 600 })
    await vi.waitFor(async () => expect(await t.d().page()).toBe(2))
    expect(onPageChange.mock.lastCall?.[1].event.type).toBe("SCROLL.END")
    expect(t.log).toEqual([])
  })
})
