// Carousel's Svelte parts: a named region of slide groups, off-page slides inert; Next announced;
// the indicators' arrows move the focus; autoplay silent and stopped by its trigger's press;
// bind:page; DOM parity with React. Scrolling: the React browser suite.
import * as R from "@rind-ui/react"
import { getCarousel, recordingAnnouncer, virtualClock } from "@rind-ui/testing"
import { createElement as r } from "react"
import { flushSync } from "svelte"
import { describe, expect, it, vi } from "vitest"
import Gallery from "../../fixtures/carousel/gallery.svelte"
import { mount } from "../../fixtures/mount"
import { clientParity } from "../../fixtures/parity"

const settle = async () => {
  await Promise.resolve()
  flushSync()
}

function setup(root: Record<string, unknown> = {}) {
  const clock = virtualClock()
  const rec = recordingAnnouncer()
  const m = mount(Gallery, {
    root,
    provider: {
      announcer: rec.announcer,
      environment: { scheduler: clock.scheduler, clock: clock.clock, reducedMotion: false },
    },
  } as never)
  const q = (sel: string) => m.host.querySelector<HTMLElement>(sel)
  return {
    ...m,
    q,
    log: rec.log,
    advance: (ms: number) => {
      clock.advance(ms)
      flushSync()
    },
    d: () => getCarousel(document.body, { name: "Featured" }),
  }
}

describe("Svelte Carousel", () => {
  it("a named region of slide groups; off-page slides inert; a tablist of pages", async () => {
    const t = setup()
    await settle()
    expect(t.q('[data-part="root"]')?.getAttribute("role")).toBe("region")
    const slides = [...t.host.querySelectorAll('[data-part="slide"]')]
    expect(slides[1]?.getAttribute("aria-label")).toBe("2 of 4")
    expect(slides[1]?.hasAttribute("inert")).toBe(true)
    expect(t.host.querySelectorAll('[role="tab"]')).toHaveLength(4)
    expect(await t.d().statusText()).toBe("1 / 4")
  })

  it("Next moves a page, announced; the indicators' arrows move the focus", async () => {
    const t = setup()
    await settle()
    await t.d().next()
    expect(await t.d().page()).toBe(1)
    expect(t.log.at(-1)).toMatchObject({ message: "Slide 2 of 4" })
    await t.d().via("keyboard").goTo(3)
    expect(await t.d().page()).toBe(3)
    expect(document.activeElement?.getAttribute("data-index")).toBe("3")
  })

  it("autoplay advances silently; the trigger's press stops it", async () => {
    const t = setup({ autoplay: true, autoplayDelay: 1000 })
    await settle()
    expect(await t.d().isPlaying()).toBe(true)
    t.advance(1000)
    expect(await t.d().page()).toBe(1)
    expect(t.log).toEqual([])
    await t.d().via("pointer").pause()
    expect(await t.d().isPlaying()).toBe(false)
  })

  it("bind:page follows Next", async () => {
    const onBound = vi.fn()
    const m = mount(Gallery, { onBound } as never)
    await settle()
    await getCarousel(m.host).next()
    flushSync()
    expect(onBound).toHaveBeenLastCalledWith(1)
  })

  it("matches React's DOM", async () => {
    const react = r(
      R.Carousel.Root,
      { "aria-label": "Featured", slideCount: 2 },
      r(
        R.Carousel.Viewport,
        { key: "v" },
        r(R.Carousel.Slide, { key: 0, index: 0 }, "A"),
        r(R.Carousel.Slide, { key: 1, index: 1 }, "B"),
      ),
      r(R.Carousel.NextTrigger, { key: "n" }, "›"),
      r(
        R.Carousel.IndicatorGroup,
        { key: "g" },
        r(R.Carousel.Indicator, { key: 0, index: 0 }),
        r(R.Carousel.Indicator, { key: 1, index: 1 }),
      ),
      r(R.Carousel.Status, { key: "s" }),
    )
    await clientParity(react, Gallery, { full: false } as never)
  })
})
