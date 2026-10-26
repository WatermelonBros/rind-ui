import { describe, expect, it, vi } from "vitest"
import { platforms } from "../../dom/platform"
import type { Announcement } from "../../env"
import { createService } from "../../machine/service"
import { carouselConnect, carouselIndicatorKeyEvent } from "./carousel.connect"
import { carouselContract } from "./carousel.contract"
import { type CarouselProps, carouselMachine, stepPage } from "./carousel.machine"
import { carouselMessages } from "./carousel.messages"
import { carouselMeta } from "./carousel.meta"
import { firstSlideOf, pageCount, slideOnPage } from "./carousel.pages"

describe("carousel pages", () => {
  it("pages of a page, or of a move", () => {
    expect(pageCount({ slides: 5, perPage: 2 })).toBe(3)
    expect(pageCount({ slides: 5, perPage: 2, perMove: 1 })).toBe(4)
    expect(pageCount({ slides: 0 })).toBe(1)
    expect(firstSlideOf({ slides: 5, perPage: 2 }, 2)).toBe(3)
    expect(slideOnPage({ slides: 5, perPage: 2 }, 4, 2)).toBe(true)
  })

  it("steps wrap only with loop", () => {
    expect(stepPage(2, 1, 3, false)).toBeNull()
    expect(stepPage(2, 1, 3, true)).toBe(0)
    expect(stepPage(0, -1, 3, true)).toBe(2)
  })
})

/** A virtual clock and scheduler: `advance(ms)` runs every timeout that falls due. */
function make(over: Partial<CarouselProps> = {}, reduced = false) {
  let now = 0
  let timers: { at: number; fn: () => void; id: number }[] = []
  let seq = 0
  const announced: Announcement[] = []
  let hiddenListener: ((hidden: boolean) => void) | null = null
  const scrollToPage = vi.fn()
  const env = {
    clock: { now: () => now },
    scheduler: {
      setTimeout: (fn: () => void, ms: number) => {
        const id = ++seq
        timers.push({ at: now + ms, fn, id })
        return id as never
      },
      clearTimeout: (h: unknown) => {
        timers = timers.filter((t) => t.id !== h)
      },
      requestAnimationFrame: () => 0 as never,
      cancelAnimationFrame: () => {},
    },
    announcer: {
      announce: (a: Announcement) => {
        announced.push(a)
      },
      prepare: () => () => {},
      cancel: () => {},
    },
    locale: { locale: () => "en-US", dir: () => "ltr" as const, subscribe: () => () => {} },
    motion: { reducedMotion: () => reduced, subscribeReducedMotion: () => () => {} },
    visibility: {
      hidden: () => false,
      subscribe: (l: (hidden: boolean) => void) => {
        hiddenListener = l
        return () => {}
      },
    },
    scrollToPage,
  }
  const onPageChange = vi.fn()
  const props: CarouselProps = { id: "c", slideCount: 4, onPageChange, ...over }
  const s = createService(carouselMachine, props, env)
  s.start()
  const advance = (ms: number) => {
    const end = now + ms
    for (;;) {
      const due = timers.filter((t) => t.at <= end).sort((a, b) => a.at - b.at)[0]
      if (!due) break
      now = due.at
      timers = timers.filter((t) => t !== due)
      due.fn()
    }
    now = end
  }
  return {
    s,
    advance,
    announced,
    scrollToPage,
    onPageChange,
    page: () => s.view(props).values.page,
    state: () => s.getSnapshot().state,
    hide: (h: boolean) => hiddenListener?.(h),
  }
}

describe("carousel navigation", () => {
  it("next scrolls and announces; the end without loop stays", () => {
    const t = make()
    t.s.send({ type: "NEXT", reason: "trigger" })
    expect(t.page()).toBe(1)
    expect(t.scrollToPage).toHaveBeenCalledWith(1, true)
    expect(t.announced.map((a) => a.message)).toEqual(["Slide 2 of 4"])
    t.s.send({ type: "GO", page: 3, reason: "indicator" })
    t.s.send({ type: "NEXT", reason: "trigger" })
    expect(t.page()).toBe(3)
  })

  it("a settled scroll sets the page silently, without scrolling back", () => {
    const t = make()
    t.s.send({ type: "SCROLL.START" })
    t.s.send({ type: "SCROLL.END", page: 2 })
    expect(t.page()).toBe(2)
    expect(t.scrollToPage).not.toHaveBeenCalled()
    expect(t.announced).toHaveLength(0)
  })

  it("a new slide count clamps the page", () => {
    const t = make({ defaultPage: 3 })
    t.s.send({ type: "COUNT", slides: 2 })
    expect(t.page()).toBe(1)
  })
})

describe("carousel autoplay", () => {
  it("off by default", () => {
    const t = make()
    t.advance(10_000)
    expect([t.state(), t.page()]).toEqual(["stopped", 0])
  })

  it("advances silently on the clock, stops at the end without loop", () => {
    const t = make({ autoplay: true, autoplayDelay: 1000 })
    expect(t.state()).toBe("playing")
    t.advance(1000)
    expect(t.page()).toBe(1)
    t.advance(2000)
    expect(t.page()).toBe(3)
    t.advance(1000)
    expect(t.state()).toBe("stopped")
    expect(t.announced).toHaveLength(0)
  })

  it("hover pauses with the remaining time", () => {
    const t = make({ autoplay: true, autoplayDelay: 5000 })
    t.advance(3000)
    t.s.send({ type: "HOLD", hold: "hover" })
    expect(t.state()).toBe("paused")
    t.advance(10_000)
    expect(t.page()).toBe(0)
    t.s.send({ type: "RELEASE", hold: "hover" })
    t.advance(1999)
    expect(t.page()).toBe(0)
    t.advance(1)
    expect(t.page()).toBe(1)
  })

  it("a hidden page pauses; focus stops for good", () => {
    const t = make({ autoplay: true })
    t.hide(true)
    expect(t.state()).toBe("paused")
    t.hide(false)
    expect(t.state()).toBe("playing")
    t.s.send({ type: "STOP", reason: "focus" })
    t.advance(20_000)
    expect([t.state(), t.page()]).toEqual(["stopped", 0])
  })

  it("a user navigation restarts the delay", () => {
    const t = make({ autoplay: true, autoplayDelay: 1000, loop: true })
    t.advance(900)
    t.s.send({ type: "NEXT", reason: "trigger" })
    t.advance(900)
    expect(t.page()).toBe(1)
    t.advance(100)
    expect(t.page()).toBe(2)
  })

  it("never with reduced motion", () => {
    const t = make({ autoplay: true }, true)
    t.s.send({ type: "PLAY", reason: "user" })
    expect(t.state()).toBe("stopped")
  })
})

const env = { platform: platforms.linux } as unknown as Parameters<typeof carouselConnect>[1] // only platform is read
const api = (over: Partial<Parameters<typeof carouselConnect>[0]> = {}) =>
  carouselConnect(
    {
      instance: "c",
      state: "paused",
      page: 3,
      pages: 4,
      slides: 4,
      slidesPerPage: 1,
      slidesPerMove: "page",
      loop: false,
      orientation: "horizontal",
      spacing: "16px",
      delay: 5000,
      scrolling: true,
      messages: carouselMessages,
      ariaLabel: "Products",
      ids: { viewport: "v", slide: (i) => `s${i}` },
      ...over,
    },
    env,
  )
const b = { tag: "button", focused: true, modality: "keyboard" as const }
const dataKeys = (p: Record<string, unknown>) =>
  Object.keys(p)
    .filter((k) => k.startsWith("data-") && p[k] !== undefined)
    .sort()

describe("carousel connect", () => {
  it("named region, slide groups, hidden slides inert", () => {
    expect(api().root()).toMatchObject({ role: "region", "aria-roledescription": "carousel" })
    expect(api().slide(1)).toMatchObject({
      "aria-label": "2 of 4",
      inert: true,
      "aria-hidden": "true",
    })
    expect(api().slide(3)["inert"]).toBeUndefined()
  })

  it("Next stays focusable at the end; indicators rove", () => {
    expect(api().nextTrigger(b)).toMatchObject({ "aria-disabled": "true", "data-disabled": "" })
    expect(api().indicator(3, b)).toMatchObject({
      role: "tab",
      "aria-selected": "true",
      tabindex: 0,
    })
    expect(api().indicator(0, b)["tabindex"]).toBe(-1)
    expect(api({ state: "stopped" }).autoplayTrigger(b)["aria-label"]).toBe(
      "Start automatic slide show",
    )
  })

  it("indicator keys wrap", () => {
    const k = (key: string) =>
      carouselIndicatorKeyEvent(
        { key, shift: false, alt: false, ctrl: false, meta: false, composing: false } as never,
        { page: 3, pages: 4, orientation: "horizontal", dir: "ltr" },
      )
    expect(k("ArrowRight")).toEqual({ type: "GO", page: 0, reason: "keyboard" })
    expect(k("Home")).toEqual({ type: "GO", page: 0, reason: "keyboard" })
  })

  it("meta matches the code", () => {
    const a = api({ page: 0 })
    const parts = {
      root: a.root(),
      viewport: a.viewport(),
      slide: a.slide(0, { inView: true }),
      control: a.control(),
      "prev-trigger": a.prevTrigger(b),
      "next-trigger": api({ page: 3 }).nextTrigger(b),
      "indicator-group": a.indicatorGroup(),
      indicator: a.indicator(0, b),
      "autoplay-trigger": a.autoplayTrigger(b),
      status: a.status(),
    }
    for (const [part, props] of Object.entries(parts)) {
      const meta = carouselMeta.dataAttributes[part as keyof typeof carouselMeta.dataAttributes]
      expect(Object.keys(meta).sort(), part).toEqual(dataKeys(props))
    }
    expect(carouselMeta.contract.queries).toEqual(Object.keys(carouselContract.queries))
    expect(Object.keys(carouselMeta.states)).toEqual(Object.keys(carouselMachine.def.states))
  })
})
