// Carousel's Angular parts through its driver: a named region of slides grouped into pages, the
// ones off the page inert; Prev/Next aria-disabled at the ends; indicators a roving tablist;
// user changes announced, autoplay silent; hover pauses, focus stops. Scrolling needs layout
// (browser engines only): Next scrolls the Viewport, a user's scroll settles the page.
import { Component } from "@angular/core"
import { getCarousel, recordingAnnouncer, virtualClock } from "@rind-ui/testing"
import axe from "axe-core"
import { describe, expect, it, vi } from "vitest"
import { mount } from "../../fixtures/mount"
import { provideRind } from "../provider"
import { Carousel } from "./index"

/** Scrolling needs layout: jsdom has no boxes. */
const jsdom = typeof navigator !== "undefined" && navigator.userAgent.includes("jsdom")

interface Cfg {
  slides: number[]
  slidesPerPage: number
  loop: boolean
  autoplay: boolean | undefined
  autoplayDelay: number | undefined
  real: boolean
  pages: (p: number, type: string, reason: unknown) => void
  autoplays: (playing: boolean, reason: string) => void
}
/** The fixture's configuration, for the next mount. */
let current: Cfg

@Component({
  selector: "rind-f",
  imports: [Carousel],
  template: `<section
      rindCarouselRoot
      aria-label="Featured"
      #c="rindCarouselRoot"
      [slidesPerPage]="cfg.slidesPerPage"
      [loop]="cfg.loop"
      [autoplay]="cfg.autoplay"
      [autoplayDelay]="cfg.autoplayDelay"
      (pageChangeDetails)="cfg.pages($event.page, $event.details.event.type, reasonOf($event.details.event))"
      (autoplayChange)="cfg.autoplays($event.playing, $event.reason)"
    >
      <div rindCarouselViewport [style.width]="cfg.real ? '300px' : null">
        @for (i of cfg.slides; track i) {
          <div
            rindCarouselSlide
            [index]="i"
            [style.width]="cfg.real ? '100%' : null"
            [style.height]="cfg.real ? '100px' : null"
          >Slide {{ i + 1 }} <a [href]="'#s' + i">Open</a></div>
        }
      </div>
      <div rindCarouselControl>
        <button rindCarouselPrevTrigger>‹</button>
        <button rindCarouselNextTrigger>›</button>
        <button rindCarouselAutoplayTrigger>⏯</button>
      </div>
      <div rindCarouselIndicatorGroup>
        @for (p of range(c.state().pages); track p) {
          <button rindCarouselIndicator [index]="p"></button>
        }
      </div>
      <span rindCarouselStatus></span>
    </section>
    <button type="button">Outside</button>`,
})
class Tree {
  readonly cfg = current
  readonly range = (n: number) => Array.from({ length: n }, (_, i) => i)
  readonly reasonOf = (e: object) => ("reason" in e ? e.reason : undefined)
}

async function setup(
  p: Partial<Pick<Cfg, "slidesPerPage" | "loop" | "autoplay" | "autoplayDelay" | "real">> & {
    slides?: number
  } = {},
) {
  const clock = virtualClock()
  const rec = recordingAnnouncer()
  const pages: { page: number; type: string; reason: unknown }[] = []
  const autoplays: { playing: boolean; reason: string }[] = []
  current = {
    slides: Array.from({ length: p.slides ?? 4 }, (_, i) => i),
    slidesPerPage: p.slidesPerPage ?? 1,
    loop: p.loop ?? false,
    autoplay: p.autoplay,
    autoplayDelay: p.autoplayDelay,
    real: p.real ?? false,
    pages: (page, type, reason) => pages.push({ page, type, reason }),
    autoplays: (playing, reason) => autoplays.push({ playing, reason }),
  }
  const m = await mount(Tree, {}, [
    provideRind({
      announcer: rec.announcer,
      environment: p.real
        ? { reducedMotion: true }
        : {
            scheduler: clock.scheduler,
            clock: clock.clock,
            reducedMotion: false,
            // A visible page whatever the test browser's tab is (a CI runner's background tab is hidden).
            visibility: { hidden: () => false, subscribe: () => () => {} },
          },
    }),
  ])
  const stable = () => m.rerender({})
  await stable()
  const q = (sel: string) => m.host.querySelector<HTMLElement>(sel)
  const qa = (sel: string) => [...m.host.querySelectorAll<HTMLElement>(sel)]
  return {
    ...m,
    stable,
    q,
    qa,
    pages,
    autoplays,
    log: rec.log,
    advance: async (ms: number) => {
      clock.advance(ms)
      await stable()
    },
    tabs: () => qa('[role="tab"]'),
    d: () => getCarousel(document.body, { name: "Featured" }),
  }
}

describe("Angular Carousel", () => {
  it("a named region of slide groups; off-page slides inert; a tablist of pages", async () => {
    const t = await setup()
    const region = t.q('[data-part="root"]') as HTMLElement
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
    const t = await setup()
    await t.d().next()
    expect(await t.d().page()).toBe(1)
    expect(t.log.at(-1)).toMatchObject({ message: "Slide 2 of 4", priority: "polite" })
    expect(t.pages.at(-1)?.reason).toBe("trigger")
    await t.d().prev()
    await t.d().prev()
    expect(await t.d().page()).toBe(0)
  })

  it("loop: Prev on the first page goes to the last", async () => {
    const t = await setup({ loop: true })
    expect(t.q('[data-part="prev-trigger"]')?.hasAttribute("aria-disabled")).toBe(false)
    await t.d().prev()
    expect(await t.d().page()).toBe(3)
  })

  it("indicators: one tab stop; arrows select and move the focus", async () => {
    const t = await setup()
    expect(t.tabs().map((b) => b.tabIndex)).toEqual([0, -1, -1, -1])
    await t.d().via("keyboard").goTo(2)
    await t.stable()
    expect(await t.d().page()).toBe(2)
    expect(document.activeElement).toBe(t.tabs()[2])
    expect(t.tabs()[2]?.getAttribute("aria-selected")).toBe("true")
    await t.d().via("pointer").goTo(0)
    expect(await t.d().page()).toBe(0)
  })

  it("slidesPerPage groups slides into pages", async () => {
    const t = await setup({ slides: 5, slidesPerPage: 2 })
    expect(await t.d().pageCount()).toBe(3)
    expect(t.qa('[data-part="slide"][data-current]').map((s) => s.dataset["index"])).toEqual([
      "0",
      "1",
    ])
  })

  it("autoplay advances silently, pauses on hover, and the trigger stops it", async () => {
    const t = await setup({ autoplay: true, autoplayDelay: 1000 })
    expect(await t.d().isPlaying()).toBe(true)
    expect(t.q('[data-part="autoplay-trigger"]')?.getAttribute("aria-label")).toBe(
      "Stop automatic slide show",
    )
    await t.advance(1000)
    expect(await t.d().page()).toBe(1)
    expect(t.log).toEqual([])
    const root = t.q('[data-part="root"]') as HTMLElement
    root.dispatchEvent(new PointerEvent("pointerenter", { pointerType: "mouse" }))
    await vi.waitFor(async () => {
      await t.stable()
      expect(root.dataset["autoplay"]).toBe("paused")
    })
    await t.advance(5000)
    expect(await t.d().page()).toBe(1)
    root.dispatchEvent(new PointerEvent("pointerleave", { pointerType: "mouse" }))
    await vi.waitFor(async () => {
      await t.stable()
      expect(root.dataset["autoplay"]).toBe("playing")
    })
    await t.d().via("pointer").pause()
    expect(await t.d().isPlaying()).toBe(false)
    // The press's focus does not stop it first (else the toggle would restart it).
    expect(t.autoplays.at(-1)).toEqual({ playing: false, reason: "user" })
  })

  it("focus moving in stops autoplay", async () => {
    const t = await setup({ autoplay: true, autoplayDelay: 1000 })
    ;(t.q('[data-part="next-trigger"]') as HTMLElement).focus()
    await t.stable()
    expect(await t.d().isPlaying()).toBe(false)
  })

  it.skipIf(jsdom)("Next scrolls the Viewport and no scroll is reported back", async () => {
    const t = await setup({ real: true })
    await t.d().next()
    const viewport = t.q('[data-part="viewport"]') as HTMLElement
    await vi.waitFor(() => expect(viewport.scrollLeft).toBe(300))
    expect(await t.d().page()).toBe(1)
    expect(t.pages.map((c) => c.type)).toEqual(["NEXT"])
  })

  it.skipIf(jsdom)("a user's scroll settles the page, unannounced", async () => {
    const t = await setup({ real: true })
    const viewport = t.q('[data-part="viewport"]') as HTMLElement
    await vi.waitFor(() => expect(viewport.querySelectorAll("[data-current]")).toHaveLength(1))
    viewport.scrollTo({ left: 600 })
    await vi.waitFor(async () => expect(await t.d().page()).toBe(2))
    expect(t.pages.at(-1)?.type).toBe("SCROLL.END")
    expect(t.log).toEqual([])
  })
})
