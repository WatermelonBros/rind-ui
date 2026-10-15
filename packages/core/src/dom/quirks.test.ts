import { describe, expect, it } from "vitest"
import { platforms, withEngine } from "./platform"
import { quirkActive, quirks } from "./quirks"

describe("quirks registry", () => {
  // Gated by the injected platform: Safari on macOS, Chrome on macOS, Windows (RA PR #10503).
  it.each([
    ["Safari on macOS", platforms.apple, true, true],
    ["Safari on iOS", platforms.ios, true, true],
    ["Chrome on macOS", withEngine(platforms.apple, "blink"), false, true],
    ["Windows", platforms.windows, false, false],
  ] as const)(
    "%s: vo-activedescendant %s, vo-section-entry %s",
    (_name, platform, active, section) => {
      expect(quirkActive("vo-activedescendant", { platform })).toBe(active)
      expect(quirkActive("vo-section-entry", { platform })).toBe(section)
    },
  )

  it("every entry has a link, a test path and a removal condition", () => {
    for (const q of quirks) {
      expect(q.links.length).toBeGreaterThan(0)
      expect(q.test).toMatch(/\.test\.tsx?$/)
      expect(q.removeWhen).not.toBe("")
    }
  })
})
