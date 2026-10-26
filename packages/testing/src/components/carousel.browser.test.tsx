// Carousel (React) in a real browser (scrolling needs layout): Next scrolls the Viewport to the
// page's first slide; a user's scroll settles the page (reason "scroll", not announced).
import { Carousel, RindProvider } from "@rind-ui/react"
import { render } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { getCarousel, recordingAnnouncer } from "../index"

function setup(onPageChange = vi.fn()) {
  const rec = recordingAnnouncer()
  render(
    <RindProvider announcer={rec.announcer} environment={{ reducedMotion: true }}>
      <Carousel.Root aria-label="Featured" onPageChange={onPageChange}>
        <Carousel.Viewport style={{ width: 300 }}>
          {[0, 1, 2, 3].map((i) => (
            <Carousel.Slide key={i} index={i} style={{ width: "100%", height: 100 }}>
              Slide {i + 1}
            </Carousel.Slide>
          ))}
        </Carousel.Viewport>
        <Carousel.NextTrigger>Next</Carousel.NextTrigger>
      </Carousel.Root>
    </RindProvider>,
  )
  const viewport = document.querySelector('[data-part="viewport"]') as HTMLElement
  return { onPageChange, log: rec.log, viewport, d: () => getCarousel(document.body) }
}

describe("React Carousel scroll", () => {
  it("Next scrolls the Viewport to the next page and no scroll is reported back", async () => {
    const t = setup()
    await t.d().next()
    await vi.waitFor(() => expect(t.viewport.scrollLeft).toBe(300))
    expect(await t.d().page()).toBe(1)
    expect(t.onPageChange.mock.calls.map((c) => c[1].event.type)).toEqual(["NEXT"])
  })

  it("a user's scroll settles the page, unannounced", async () => {
    const t = setup()
    await vi.waitFor(() => expect(t.viewport.querySelectorAll("[data-current]")).toHaveLength(1))
    t.viewport.scrollTo({ left: 600 })
    await vi.waitFor(async () => expect(await t.d().page()).toBe(2))
    expect(t.onPageChange.mock.lastCall?.[1].event.type).toBe("SCROLL.END")
    expect(t.log).toEqual([])
  })
})
