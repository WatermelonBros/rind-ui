// Carousel's Vue parts: a named region of slide groups, off-page slides inert; Prev/Next at the
// ends; indicators a roving tablist; user changes announced, autoplay silent; the autoplay
// trigger's press stops it; v-model:page; markup parity with React. Scrolling: React browser suite.
import * as R from "@rind-ui/react"
import { getCarousel, recordingAnnouncer, virtualClock } from "@rind-ui/testing"
import { createElement as r } from "react"
import { describe, expect, it } from "vitest"
import { h, nextTick, ref } from "vue"
import { mount } from "../../fixtures/mount"
import { clientParity, serverParity } from "../../fixtures/parity"
import { Carousel, RindProvider } from "../index"

const gallery = (root: Record<string, unknown> = {}, slides = 4) =>
  h(Carousel.Root, { "aria-label": "Featured", ...root }, () => [
    h(Carousel.Viewport, null, () =>
      Array.from({ length: slides }, (_, i) => i).map((i) =>
        h(Carousel.Slide, { key: i, index: i }, () => `Slide ${i + 1}`),
      ),
    ),
    h(Carousel.Control, null, () => [
      h(Carousel.PrevTrigger, null, () => "‹"),
      h(Carousel.NextTrigger, null, () => "›"),
      h(Carousel.AutoplayTrigger, null, () => "⏯"),
    ]),
    h(Carousel.IndicatorGroup, null, {
      default: ({ pages }: { pages: number }) =>
        Array.from({ length: pages }, (_, p) => p).map((p) =>
          h(Carousel.Indicator, { key: p, index: p }),
        ),
    }),
    h(Carousel.Status),
  ])

function setup(root: Record<string, unknown> = {}, slides = 4) {
  const clock = virtualClock()
  const rec = recordingAnnouncer()
  const m = mount(() =>
    h(
      RindProvider,
      {
        announcer: rec.announcer,
        environment: { scheduler: clock.scheduler, clock: clock.clock, reducedMotion: false },
      },
      () => gallery(root, slides),
    ),
  )
  const q = (sel: string) => m.host.querySelector<HTMLElement>(sel)
  return {
    ...m,
    q,
    log: rec.log,
    advance: async (ms: number) => {
      clock.advance(ms)
      await nextTick()
    },
    d: () => getCarousel(document.body, { name: "Featured" }),
  }
}

describe("Vue Carousel", () => {
  it("a named region of slide groups; off-page slides inert; a tablist of pages", async () => {
    const t = setup()
    await nextTick()
    await nextTick()
    expect(t.q('[data-part="root"]')?.getAttribute("role")).toBe("region")
    const slides = [...t.host.querySelectorAll('[data-part="slide"]')]
    expect(slides[1]?.getAttribute("aria-label")).toBe("2 of 4")
    expect(slides[1]?.hasAttribute("inert")).toBe(true)
    expect(t.host.querySelectorAll('[role="tab"]')).toHaveLength(4)
    expect(await t.d().statusText()).toBe("1 / 4")
  })

  it("Next and Prev move a page, announced; the indicators' arrows move the focus", async () => {
    const t = setup()
    await nextTick()
    await nextTick()
    await t.d().next()
    expect(await t.d().page()).toBe(1)
    expect(t.log.at(-1)).toMatchObject({ message: "Slide 2 of 4" })
    await t.d().via("keyboard").goTo(3)
    expect(await t.d().page()).toBe(3)
    expect(document.activeElement?.getAttribute("data-index")).toBe("3")
  })

  it("autoplay advances silently; the trigger's press stops it", async () => {
    const t = setup({ autoplay: true, autoplayDelay: 1000 })
    await nextTick()
    await nextTick()
    expect(await t.d().isPlaying()).toBe(true)
    await t.advance(1000)
    expect(await t.d().page()).toBe(1)
    expect(t.log).toEqual([])
    await t.d().via("pointer").pause()
    expect(await t.d().isPlaying()).toBe(false)
  })

  it("v-model:page follows Next", async () => {
    const page = ref(0)
    const m = mount(() =>
      h(RindProvider, null, () =>
        gallery({ page: page.value, "onUpdate:page": (p: number) => (page.value = p) }),
      ),
    )
    await nextTick()
    await nextTick()
    await getCarousel(m.host).next()
    expect(page.value).toBe(1)
  })

  it("matches React's markup, server and client", async () => {
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
    const vue = () =>
      h(Carousel.Root, { "aria-label": "Featured", slideCount: 2 }, () => [
        h(Carousel.Viewport, null, () => [
          h(Carousel.Slide, { index: 0 }, () => "A"),
          h(Carousel.Slide, { index: 1 }, () => "B"),
        ]),
        h(Carousel.NextTrigger, null, () => "›"),
        h(Carousel.IndicatorGroup, null, () => [
          h(Carousel.Indicator, { index: 0 }),
          h(Carousel.Indicator, { index: 1 }),
        ]),
        h(Carousel.Status),
      ])
    await serverParity(react, vue)
    await clientParity(react, vue)
  })
})
