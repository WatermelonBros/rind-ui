// image-loading-status and Avatar fallback timing in Node (task 1.2): a fake image (the
// events a registered <img> sends) and vitest's fake timers behind the scheduler.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { ImageSettled } from "../../dom/image-status"
import { createService } from "../../machine/service"
import {
  fallbackVisible,
  type ImageStatus,
  type ImageStatusProps,
  imageStatusMachine,
} from "./image-status.machine"

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

const scheduler = {
  // fake-time: the fake scheduler under test (vi.useFakeTimers)
  setTimeout: (cb: () => void, ms: number) => setTimeout(cb, ms),
  clearTimeout: (h: unknown) => clearTimeout(h as ReturnType<typeof setTimeout>),
  // fake-time: the fake scheduler under test (vi.useFakeTimers)
  requestAnimationFrame: (cb: () => void) => setTimeout(cb, 16),
  cancelAnimationFrame: (h: unknown) => clearTimeout(h as ReturnType<typeof setTimeout>),
}

function avatar(props: ImageStatusProps = {}) {
  const calls: [ImageStatus, string][] = []
  const s = createService(
    imageStatusMachine,
    { ...props, onStatusChange: (status, d) => calls.push([status, d.reason]) },
    { scheduler },
  )
  let source = 0
  const image = {
    mount: (settled: ImageSettled | "none") =>
      s.send({
        type: "IMAGE.MOUNT",
        hasSource: settled !== "none",
        source: ++source,
        settled: settled === "none" ? "loading" : settled,
      }),
    change: (settled: ImageSettled | "none") =>
      s.send({
        type: "IMAGE.SOURCE",
        hasSource: settled !== "none",
        source: ++source,
        settled: settled === "none" ? "loading" : settled,
      }),
    load: (of = source) => s.send({ type: "IMAGE.LOAD", source: of }),
    error: (of = source) => s.send({ type: "IMAGE.ERROR", source: of }),
    decoded: (status: "loaded" | "error") => s.send({ type: "IMAGE.SETTLED", status, source }),
    unmount: () => s.send({ type: "IMAGE.UNMOUNT" }),
  }
  const status = () => s.getSnapshot().state as ImageStatus
  const fallback = () => fallbackVisible(status(), s.getSnapshot().context.fallbackReady)
  return { s, image, calls, status, fallback }
}

describe("status values", () => {
  it("load succeeds: loading → loaded, one callback with reason IMAGE.LOAD", () => {
    const a = avatar()
    a.image.mount("loading")
    a.s.start()
    a.calls.length = 0
    a.image.load()
    expect(a.status()).toBe("loaded")
    expect(a.calls).toEqual([["loaded", "IMAGE.LOAD"]])
  })

  it("no source: idle", () => {
    const a = avatar()
    a.image.mount("none")
    expect(a.status()).toBe("idle")
    expect(a.calls).toEqual([])
  })

  it("starts idle with no callback for the creation", () => {
    const a = avatar()
    a.s.start()
    expect(a.status()).toBe("idle")
    expect(a.calls).toEqual([])
  })
})

describe("images settled before hydration", () => {
  it("cached image: loaded at registration, no loading callback (data URL too)", () => {
    const a = avatar()
    a.image.mount("loaded")
    expect(a.status()).toBe("loaded")
    expect(a.calls).toEqual([["loaded", "IMAGE.MOUNT"]])
  })

  it("ambiguous complete image: decode() decides (SVG without size → loaded)", () => {
    const a = avatar()
    a.image.mount("loading")
    a.image.decoded("loaded")
    expect(a.status()).toBe("loaded")
  })

  it("broken image finished before hydration: decode() rejects → error", () => {
    const a = avatar()
    a.image.mount("loading")
    a.image.decoded("error")
    expect(a.status()).toBe("error")
  })
})

describe("source changes and removal", () => {
  it("src removed (radix#1767, bits-ui#88): idle, fallback back", () => {
    const a = avatar()
    a.image.mount("loaded")
    a.image.change("none")
    expect(a.status()).toBe("idle")
    a.s.send({ type: "ROOT.MOUNT" })
    expect(a.fallback()).toBe(true)
  })

  it("image unmounted: idle", () => {
    const a = avatar()
    a.image.mount("loaded")
    a.image.unmount()
    expect(a.status()).toBe("idle")
  })

  it("retry by changing the source (radix#2892): error → loading → loaded", () => {
    const a = avatar()
    a.image.mount("loading")
    a.image.error()
    expect(a.status()).toBe("error")
    a.image.change("loading")
    expect(a.status()).toBe("loading")
    a.image.load()
    expect(a.status()).toBe("loaded")
  })

  it("events of a replaced source are dropped", () => {
    const a = avatar()
    a.image.mount("loading")
    const old = 1
    a.image.change("loading")
    a.image.error(old)
    a.image.load(old)
    expect(a.status()).toBe("loading")
  })

  it("load after the service stopped (bits-ui#2050) changes nothing", () => {
    const a = avatar()
    a.image.mount("loading")
    a.s.start()
    a.s.stop()
    a.image.load()
    expect(a.status()).toBe("loading")
  })
})

describe("fallback visibility", () => {
  it("no delay: the fallback shows in every status but loaded", () => {
    const a = avatar()
    expect(a.fallback()).toBe(true)
    a.image.mount("loading")
    expect(a.fallback()).toBe(true)
    a.image.load()
    expect(a.fallback()).toBe(false)
  })

  it("no image waits for nothing (base-ui#5988): shown after the first commit", () => {
    const a = avatar({ fallbackDelay: 1000 })
    a.image.mount("none")
    expect(a.fallback()).toBe(false) // the server render and the first client render
    a.s.start()
    a.s.send({ type: "ROOT.MOUNT" })
    expect(a.fallback()).toBe(true)
  })

  it("failed image does not wait for the delay (base-ui#5988)", () => {
    const a = avatar({ fallbackDelay: 1000 })
    a.image.mount("loading")
    a.s.start()
    a.s.send({ type: "ROOT.MOUNT" })
    vi.advanceTimersByTime(50)
    expect(a.fallback()).toBe(false)
    a.image.error()
    expect(a.fallback()).toBe(true)
  })

  it("fast load hides nothing: delay 300, load at 100", () => {
    const a = avatar({ fallbackDelay: 300 })
    a.image.mount("loading")
    a.s.start()
    a.s.send({ type: "ROOT.MOUNT" })
    vi.advanceTimersByTime(100)
    expect(a.fallback()).toBe(false)
    a.image.load()
    vi.advanceTimersByTime(500)
    expect(a.fallback()).toBe(false)
  })

  it("slow load: the fallback shows after the delay", () => {
    const a = avatar({ fallbackDelay: 300 })
    a.image.mount("loading")
    a.s.start()
    vi.advanceTimersByTime(299)
    expect(a.fallback()).toBe(false)
    vi.advanceTimersByTime(1)
    expect(a.fallback()).toBe(true)
  })

  it("once shown, a source change never re-hides it with the delay", () => {
    const a = avatar({ fallbackDelay: 300 })
    a.image.mount("loading")
    a.s.start()
    a.image.error()
    expect(a.fallback()).toBe(true)
    a.image.change("loading")
    expect(a.fallback()).toBe(true)
  })

  it("transparent image: no fallback once loaded", () => {
    const a = avatar()
    a.image.mount("loaded")
    expect(a.fallback()).toBe(false)
  })
})
