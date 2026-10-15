import { afterEach, describe, expect, it, vi } from "vitest"
import type { Announcement, Announcer } from "../env/capabilities"
import { streamAnnouncement } from "./stream"

const scheduler = {
  setTimeout: (fn: () => void, ms: number) => setTimeout(fn, ms),
  clearTimeout: (h: unknown) => clearTimeout(h as number),
  requestAnimationFrame: (fn: () => void) => setTimeout(fn, 16),
  cancelAnimationFrame: (h: unknown) => clearTimeout(h as number),
}
function recorder() {
  const log: Announcement[] = []
  const cancelled: string[] = []
  const announcer: Announcer = {
    announce: (a) => log.push(a),
    prepare: () => () => {},
    cancel: (key) => cancelled.push(key),
  }
  return { log, announcer, cancelled }
}
afterEach(() => {
  vi.useRealTimers()
})

describe("streamed text", () => {
  it("default mode: 'Hel', 'lo', ' there' → exactly one announcement", () => {
    const { log, announcer } = recorder()
    const s = streamAnnouncement(announcer, { key: "m1", locale: "en", scheduler })
    s.push("Hel")
    s.push("lo")
    s.push(" there")
    expect(log).toEqual([])
    s.complete()
    expect(log.map((a) => a.message)).toEqual(["Hello there"])
    expect(log[0]?.priority).toBe("polite")
  })

  it("sentence mode: 'First one. Sec' + 'ond one.' → two sentences, in order", () => {
    const { log, announcer } = recorder()
    const s = streamAnnouncement(announcer, {
      mode: "sentences",
      key: "m1",
      locale: "en",
      scheduler,
    })
    s.push("First one. Sec")
    expect(log.map((a) => a.message)).toEqual(["First one."])
    s.push("ond one.")
    s.complete()
    expect(log.map((a) => a.message)).toEqual(["First one.", "Second one."])
  })

  it("sentence mode flushes a long sentence every 2 s, unkeyed so it keeps its order", () => {
    vi.useFakeTimers()
    const { log, announcer } = recorder()
    const s = streamAnnouncement(announcer, {
      mode: "sentences",
      key: "m1",
      locale: "en",
      scheduler,
    })
    s.push("a very long sentence that keeps")
    vi.advanceTimersByTime(2000)
    expect(log).toEqual([
      { message: "a very long sentence that keeps", priority: "polite", lang: "en" },
    ])
  })

  it("a cancelled stream announces nothing more", () => {
    vi.useFakeTimers()
    const { log, announcer } = recorder()
    const s = streamAnnouncement(announcer, {
      mode: "sentences",
      key: "m1",
      locale: "en",
      scheduler,
    })
    s.push("partial")
    s.cancel()
    s.complete()
    vi.advanceTimersByTime(5000)
    expect(log).toEqual([])
  })
})
