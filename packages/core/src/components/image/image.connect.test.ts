// add-image 2.2: every cell of design §2, named and decorative; 1.2: Image reuses the shared
// status machine, so `alt` cannot affect the status and fallback timing is Avatar's.
import { afterEach, describe, expect, it, vi } from "vitest"
import { createService } from "../../machine/service"
import { avatarMachine } from "../avatar/avatar.machine"
import { imageStatusMachine } from "../image-status/image-status.machine"
import { checkImageAltGiven, checkImgCount, imageConnect } from "./image.connect"
import { imageContract } from "./image.contract"

afterEach(() => vi.restoreAllMocks())

const STATUSES = ["idle", "loading", "loaded", "error"] as const
const api = (status: (typeof STATUSES)[number], ...alt: [string | undefined] | []) =>
  imageConnect({ instance: "i", status, alt: alt.length ? alt[0] : "A red bicycle" })

describe("image connect (design §2)", () => {
  it("named: Root carries the name only in idle and error", () => {
    for (const s of STATUSES) {
      const root = api(s).root()
      const gone = s === "idle" || s === "error"
      expect(root["role"]).toBe(gone ? "img" : undefined)
      expect(root["aria-label"]).toBe(gone ? "A red bicycle" : undefined)
      expect(root["data-decorative"]).toBeUndefined()
      expect(root["data-state"]).toBe(s)
    }
  })

  it("named: the Img keeps alt in every status, hidden only on error or idle without a source", () => {
    for (const s of STATUSES) {
      const img = api(s).img(true)
      expect(img["alt"]).toBe("A red bicycle")
      // idle with a source is the server render: visible, so a lazy image can load.
      expect(img["hidden"]).toBe(s === "error" ? true : undefined)
      expect(img["data-state"]).toBe(s)
    }
    expect(api("idle").img(false)["hidden"]).toBe(true)
  })

  it('Fallback is aria-hidden="true" in every status, named or decorative', () => {
    for (const s of STATUSES) {
      expect(api(s).fallback()["aria-hidden"]).toBe("true")
      expect(api(s, "").fallback()["aria-hidden"]).toBe("true")
    }
  })

  it('decorative (alt=""): no role, no aria-label, data-decorative, Img alt=""', () => {
    for (const s of STATUSES) {
      const root = api(s, "").root()
      expect(root["role"]).toBeUndefined()
      expect(root["aria-label"]).toBeUndefined()
      expect(root["data-decorative"]).toBe("")
      expect(api(s, "").img(true)["alt"]).toBe("")
    }
  })

  it("missing alt: the attribute is omitted, Root is not named, a development error", () => {
    expect(api("loaded", undefined).img(true)["alt"]).toBeUndefined()
    expect(api("error", undefined).root()["role"]).toBeUndefined()
    const error = vi.spyOn(console, "error").mockImplementation(() => {})
    checkImageAltGiven(undefined, "i")
    expect(error).toHaveBeenCalledWith(expect.stringMatching(/no alt.*alt=""/))
    error.mockClear()
    checkImageAltGiven("", "i")
    expect(error).not.toHaveBeenCalled()
  })

  it("more than one Img is a development warning", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    checkImgCount(1)
    expect(warn).not.toHaveBeenCalled()
    checkImgCount(2)
    expect(warn).toHaveBeenCalledWith(expect.stringMatching(/more than one Image.Img/))
  })

  it("no inline styles on any part", () => {
    for (const s of STATUSES) {
      const a = api(s)
      for (const part of [a.root(), a.img(true), a.fallback()])
        expect(part["style"]).toBeUndefined()
    }
  })
})

describe("Image reuses the status machine (1.1, 1.2)", () => {
  it("one machine for Avatar and Image", () => {
    expect(imageContract.machine).toBe(imageStatusMachine)
    expect(avatarMachine).toBe(imageStatusMachine)
  })

  it("fallback timing is Avatar's: the delay applies only while loading", () => {
    vi.useFakeTimers()
    const scheduler = {
      setTimeout: (cb: () => void, ms: number) => setTimeout(cb, ms),
      clearTimeout: (h: unknown) => clearTimeout(h as ReturnType<typeof setTimeout>),
      requestAnimationFrame: (cb: () => void) => setTimeout(cb, 16),
      cancelAnimationFrame: (h: unknown) => clearTimeout(h as ReturnType<typeof setTimeout>),
    }
    const s = createService(imageStatusMachine, { fallbackDelay: 300 }, { scheduler })
    s.start()
    // The image registers at commit, before Root's mount effect (as in React).
    s.send({ type: "IMAGE.MOUNT", hasSource: true, source: 1, settled: "loading" })
    s.send({ type: "ROOT.MOUNT" })
    expect(s.getSnapshot().context.fallbackReady).toBe(false)
    vi.advanceTimersByTime(300)
    expect(s.getSnapshot().context.fallbackReady).toBe(true)
    s.stop()
    vi.useRealTimers()
  })
})
