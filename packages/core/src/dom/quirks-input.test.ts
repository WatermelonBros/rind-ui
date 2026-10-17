import { CalendarDate, GregorianCalendar } from "@internationalized/date"
import { describe, expect, it } from "vitest"
import { dateFieldConnect } from "../components/date-field/date-field.connect"
import { formatFor } from "../components/date-field/date-field.machine"
import { dateFieldMessages } from "../components/date-field/date-field.messages"
import { draftOf } from "../components/date-segments"
import { mergeFieldProps } from "../components/shared/field-control"
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

// The Date Field's segments are the same element (add-date-field A.2): gated by the entry.
describe("ios-vo-spinbutton-input: date segments", () => {
  const segments = (platform: (typeof platforms)[keyof typeof platforms]) => {
    const value = new CalendarDate(2026, 10, 14)
    const props = {
      placeholderValue: value,
      locale: "en-US",
      calendar: new GregorianCalendar(),
      id: "d",
    }
    const format = formatFor(props, value)
    const api = dateFieldConnect({
      instance: "d",
      format,
      draft: draftOf(value, format),
      value,
      defaultValue: value,
      kind: "date",
      granularity: "day",
      active: null,
      modality: "keyboard",
      composing: false,
      field: mergeFieldProps({ role: "group", labelable: false }, null),
      labelledBy: "label",
      required: false,
      messages: dateFieldMessages,
      plainTextbox: quirkActive("ios-vo-spinbutton-input", { platform }),
      embedded: false,
      dir: "ltr",
    })
    return api
      .segments()
      .filter((s) => s.editable)
      .map((s) => api.segment(s))
  }

  it("Date segment on iPhone: no spinbutton role or value attributes", () => {
    for (const s of segments(platforms.ios)) {
      expect([s["role"], s["aria-valuenow"], s["aria-valuemin"], s["aria-valuemax"]]).toEqual([
        undefined,
        undefined,
        undefined,
        undefined,
      ])
    }
  })

  it("Date segment on macOS: spinbuttons", () => {
    expect(segments(platforms.apple).map((s) => s["role"])).toEqual([
      "spinbutton",
      "spinbutton",
      "spinbutton",
    ])
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
