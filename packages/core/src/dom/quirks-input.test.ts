import { describe, expect, it } from "vitest"
import { platforms } from "./platform"
import { quirkActive } from "./quirks"

// Manual device check for ios-vo-spinbutton-input: docs/accessibility/manual-protocol.md.
describe("ios-vo-spinbutton-input", () => {
  it.each([
    ["iOS", platforms.ios, true],
    ["macOS", platforms.apple, false],
    ["Android", platforms.android, false],
  ] as const)("%s: %s", (_name, platform, active) => {
    expect(quirkActive("ios-vo-spinbutton-input", { platform })).toBe(active)
  })
})

describe("keypad-decimal-separator", () => {
  it.each([
    ["iOS", platforms.ios, true],
    ["Android", platforms.android, true],
    ["Windows", platforms.windows, false],
  ] as const)("%s: %s", (_name, platform, active) => {
    expect(quirkActive("keypad-decimal-separator", { platform })).toBe(active)
  })

  // Test-only stand-in: the real mapping belongs to add-number-input.
  function toFieldDecimal(inserted: string, locale: string): string {
    const decimal = new Intl.NumberFormat(locale)
      .formatToParts(1.5)
      .find((part) => part.type === "decimal")?.value
    return inserted === "." && decimal ? decimal : inserted
  }

  // The insertion recorded from a device keypad is ".".
  it.each([
    ["it-IT", ","],
    ["en-US", "."],
  ])('maps a keypad "." into a %s field as %s', (locale, expected) => {
    expect(toFieldDecimal(".", locale)).toBe(expected)
  })
})
