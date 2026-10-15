import { afterEach, describe, expect, it, vi } from "vitest"
import { motionPreference } from "./motion"

function fakeMatchMedia(initial: boolean) {
  const listeners = new Set<(e: { matches: boolean }) => void>()
  const query = {
    matches: initial,
    addEventListener: (_: string, l: (e: { matches: boolean }) => void) => listeners.add(l),
    removeEventListener: (_: string, l: (e: { matches: boolean }) => void) => listeners.delete(l),
  }
  vi.stubGlobal("matchMedia", () => query)
  return {
    change(matches: boolean) {
      query.matches = matches
      for (const l of listeners) l({ matches })
    },
    listeners,
  }
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("motionPreference", () => {
  it("follows prefers-reduced-motion and notifies changes at runtime", () => {
    const media = fakeMatchMedia(false)
    const motion = motionPreference()
    expect(motion.reducedMotion()).toBe(false)
    const seen: boolean[] = []
    const off = motion.subscribeReducedMotion((r) => seen.push(r))
    media.change(true)
    expect(seen).toEqual([true])
    expect(motion.reducedMotion()).toBe(true)
    off()
    expect(media.listeners.size).toBe(0)
  })

  it("an override wins and never reads matchMedia", () => {
    const spy = vi.fn()
    vi.stubGlobal("matchMedia", spy)
    expect(motionPreference(true).reducedMotion()).toBe(true)
    expect(spy).not.toHaveBeenCalled()
  })

  it("on the server (no matchMedia) motion is not reduced", () => {
    expect(motionPreference().reducedMotion()).toBe(false)
  })
})
