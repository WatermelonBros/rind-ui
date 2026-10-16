import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { Announcer } from "../env/capabilities"
import { domEnvironment } from "../env/dom-environment"
import { isKeptVisible, KEEP_VISIBLE_SELECTOR } from "./keep-visible"
import { ANNOUNCEMENTS, liveAnnouncer } from "./live-announcer"

const inBrowser = !navigator.userAgent.includes("jsdom")
const RESETS = Symbol.for("rind-ui.resets")
const resetAll = () => {
  for (const reset of (Reflect.get(globalThis, RESETS) as Set<() => void> | undefined) ?? [])
    reset()
}

/** The environment with timers and frames on (fake) setTimeout. */
function env() {
  const base = domEnvironment()
  return {
    ...base,
    scheduler: {
      // fake-time: the fake scheduler under test (vi.useFakeTimers)
      setTimeout: (fn: () => void, ms: number) => setTimeout(fn, ms),
      clearTimeout: (h: unknown) => clearTimeout(h as number),
      // fake-time: the fake scheduler under test (vi.useFakeTimers)
      requestAnimationFrame: (fn: () => void) => setTimeout(fn, 16),
      cancelAnimationFrame: (h: unknown) => clearTimeout(h as number),
    },
  }
}
const polite = () => document.querySelector('[data-live-announcer] [aria-live="polite"]')
const assertive = () => document.querySelector('[data-live-announcer] [aria-live="assertive"]')
const texts = (region: Element | null) => Array.from(region?.children ?? [], (c) => c.textContent)

let announcer: Announcer
beforeEach(() => {
  vi.useFakeTimers()
  resetAll()
  announcer = liveAnnouncer(env())
})
afterEach(() => {
  vi.useRealTimers()
  resetAll()
  document.body.innerHTML = ""
})

describe("keep-visible rule", () => {
  it("covers the announcer, rind-ui top layers and live regions, and their ancestors", () => {
    document.body.innerHTML =
      '<div id="a"><div data-live-announcer></div></div><div id="b" role="status"></div><div id="c"><p aria-live="polite"></p></div><div id="d"></div>'
    for (const id of ["a", "b", "c"])
      expect(isKeptVisible(document.getElementById(id) as Element)).toBe(true)
    expect(isKeptVisible(document.getElementById("d") as Element)).toBe(false)
    expect(KEEP_VISIBLE_SELECTOR).toContain("[data-rind-top-layer]")
  })
})

describe("regions", () => {
  it("prepare() creates one polite and one assertive region per document, once", () => {
    announcer.prepare()
    liveAnnouncer(env()).prepare()
    expect(document.querySelectorAll("[data-live-announcer]")).toHaveLength(1)
    const container = document.querySelector("[data-live-announcer]") as HTMLElement
    expect(container.hasAttribute("data-rind-top-layer")).toBe(true)
    expect(polite()?.getAttribute("role")).toBe("log")
    expect(polite()?.getAttribute("aria-relevant")).toBe("additions")
    expect(assertive()).not.toBeNull()
  })

  it("first toast in the same task as mount: regions first, text in a later frame (RA#5191)", () => {
    announcer.prepare()
    announcer.announce({ message: "Saved" })
    expect(polite()).not.toBeNull()
    expect(texts(polite())).toEqual([])
    vi.advanceTimersByTime(16)
    expect(texts(polite())).toEqual(["Saved"])
  })

  it("created outside an inert subtree (RA#3559)", () => {
    document.body.innerHTML =
      '<div inert id="app"><main>page</main></div><div role="dialog">modal</div>'
    announcer.prepare()
    const container = document.querySelector("[data-live-announcer]") as HTMLElement
    expect(container.closest("[inert]")).toBeNull()
    expect(container.closest("[aria-hidden=true]")).toBeNull()
  })
})

describe("messages", () => {
  it("'Copied' twice, two seconds apart: two announcements", () => {
    announcer.announce({ message: "Copied" })
    vi.advanceTimersByTime(2000)
    announcer.announce({ message: "Copied" })
    vi.advanceTimersByTime(16)
    expect(texts(polite())).toEqual(["Copied", "Copied"])
  })

  it("keyed result counts within 300 ms: only the last is announced", () => {
    announcer.announce({ message: "12 results", key: "count" })
    vi.advanceTimersByTime(100)
    announcer.announce({ message: "5 results", key: "count" })
    vi.advanceTimersByTime(100)
    announcer.announce({ message: "3 results", key: "count" })
    vi.advanceTimersByTime(600)
    expect(texts(polite())).toEqual(["3 results"])
  })

  it("message nodes are removed after 7 s", () => {
    announcer.announce({ message: "Gone soon" })
    vi.advanceTimersByTime(16)
    expect(texts(polite())).toEqual(["Gone soon"])
    vi.advanceTimersByTime(7000)
    expect(texts(polite())).toEqual([])
  })

  it("assertive messages go to the assertive region", () => {
    announcer.announce({ message: "Failed", priority: "assertive" })
    vi.advanceTimersByTime(16)
    expect(texts(assertive())).toEqual(["Failed"])
    expect(texts(polite())).toEqual([])
  })

  it("each message carries the announcing component's lang", () => {
    document.documentElement.lang = "en"
    announcer.announce({ message: "Copiato", lang: "it-IT" })
    vi.advanceTimersByTime(16)
    expect(polite()?.firstElementChild?.getAttribute("lang")).toBe("it-IT")
    document.documentElement.removeAttribute("lang")
  })

  it("dropped while the document is hidden, never spoken later", () => {
    const hidden = vi.spyOn(document, "hidden", "get").mockReturnValue(true)
    announcer.announce({ message: "Background" })
    hidden.mockRestore()
    vi.advanceTimersByTime(10_000)
    expect(texts(polite())).toEqual([])
  })

  it("the regions never move, even while a modal is open", () => {
    announcer.prepare()
    const container = document.querySelector("[data-live-announcer]") as HTMLElement
    const parent = container.parentElement
    document.body.insertAdjacentHTML(
      "beforeend",
      '<div role="dialog" aria-modal="true">modal</div>',
    )
    announcer.announce({ message: "Hello" })
    vi.advanceTimersByTime(16)
    expect(container.parentElement).toBe(parent)
    expect(document.querySelectorAll("[data-live-announcer]")).toHaveLength(1)
  })
})

describe("ariaNotify backend", () => {
  it("supported: calls ariaNotify with the priority and inserts nothing", () => {
    const calls: unknown[] = []
    const proto = HTMLElement.prototype as HTMLElement & { ariaNotify?: unknown }
    const had = "ariaNotify" in proto
    const original = proto.ariaNotify
    proto.ariaNotify = function (this: HTMLElement, message: string, options: unknown) {
      calls.push([message, options, this.lang])
    }
    const notify = liveAnnouncer(env(), { backend: "aria-notify" })
    notify.announce({ message: "Saved", lang: "de-DE" })
    notify.announce({ message: "Error", priority: "assertive" })
    vi.advanceTimersByTime(16)
    expect(calls).toEqual([
      ["Saved", { priority: "normal" }, "de-DE"],
      // A message without lang does not inherit the previous one's.
      ["Error", { priority: "high" }, ""],
    ])
    expect(texts(polite())).toEqual([])
    if (had) proto.ariaNotify = original
    else delete proto.ariaNotify
  })

  it.runIf(!("ariaNotify" in HTMLElement.prototype))(
    "unsupported: falls back to the live regions",
    () => {
      const notify = liveAnnouncer(env(), { backend: "aria-notify" })
      notify.announce({ message: "Saved" })
      vi.advanceTimersByTime(16)
      expect(texts(polite())).toEqual(["Saved"])
    },
  )
})

describe.runIf(inBrowser)("in a real browser", () => {
  it("both regions exist before the first text mutation", async () => {
    vi.useRealTimers()
    const order: string[] = []
    const observer = new MutationObserver((records) => {
      for (const r of records) {
        for (const n of Array.from(r.addedNodes)) {
          if (n instanceof HTMLElement && n.hasAttribute("data-live-announcer"))
            order.push("regions")
          else if (n.textContent) order.push("text")
        }
      }
    })
    observer.observe(document.body, { childList: true, subtree: true })
    const real = liveAnnouncer(domEnvironment())
    real.prepare()
    real.announce({ message: "First" })
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
    observer.disconnect()
    expect(order).toEqual(["regions", "text"])
  })

  it("regions are outside a simulated inert body sibling (RA#3559, RX#1820)", () => {
    document.body.innerHTML = '<div id="app">page</div>'
    const real = liveAnnouncer(domEnvironment())
    real.prepare()
    // A hide-outside operation honouring the keep-visible rule.
    for (const child of Array.from(document.body.children)) {
      if (!isKeptVisible(child)) child.setAttribute("inert", "")
    }
    const container = document.querySelector("[data-live-announcer]") as HTMLElement
    expect(container.closest("[inert]")).toBeNull()
    expect(document.getElementById("app")?.hasAttribute("inert")).toBe(true)
  })
})

describe("review round 1", () => {
  it("sentence streams speak in order: a 2 s flush is not overtaken by the sentence completing it", async () => {
    const { streamAnnouncement } = await import("../a11y/stream")
    const e = env()
    const announcer = liveAnnouncer(e)
    const s = streamAnnouncement(announcer, {
      mode: "sentences",
      key: "s",
      locale: "en",
      scheduler: e.scheduler,
    })
    s.push("A very long first sent")
    vi.advanceTimersByTime(2000)
    s.push("ence ends. Then more")
    vi.advanceTimersByTime(5000)
    // The trailing partial is flushed 2 s later, after the sentence it follows.
    expect(texts(polite())).toEqual(["A very long first sent", "ence ends.", "Then more"])
  })

  it("a cancelled stream does not speak its pending completion", async () => {
    const { streamAnnouncement } = await import("../a11y/stream")
    const e = env()
    const s = streamAnnouncement(liveAnnouncer(e), {
      key: "s",
      locale: "en",
      scheduler: e.scheduler,
    })
    s.push("Hello")
    s.complete()
    s.cancel()
    vi.advanceTimersByTime(5000)
    expect(texts(polite())).toEqual([])
  })

  it("the testing log records what is spoken, not superseded keyed requests", () => {
    const log: unknown[] = []
    const previous: unknown = Reflect.get(globalThis, ANNOUNCEMENTS)
    Reflect.set(globalThis, ANNOUNCEMENTS, log)
    const announcer = liveAnnouncer(env())
    for (const m of ["12 results", "5 results", "3 results"])
      announcer.announce({ message: m, key: "c" })
    vi.advanceTimersByTime(1000)
    expect(log.map((x) => (x as { message: string }).message)).toEqual(["3 results"])
    Reflect.set(globalThis, ANNOUNCEMENTS, previous)
  })
})
