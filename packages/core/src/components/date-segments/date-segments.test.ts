// date-segments scenarios that the pure model decides (task 1.4); the machine's own
// scenarios (commit points, focus, controlled values) are in date-field.machine.test.ts.

import {
  CalendarDate,
  CalendarDateTime,
  createCalendar,
  GregorianCalendar,
  parseZonedDateTime,
} from "@internationalized/date"
import { describe, expect, it } from "vitest"
import {
  type DateGranularity,
  type DateSegmentType,
  type Draft,
  dateValidity,
  defaultValueText,
  draftOf,
  edgeEntry,
  isSeparator,
  limits,
  monthName,
  parsePaste,
  planDigit,
  planName,
  type SegmentFormat,
  type SegmentOptions,
  segmentFormat,
  segmentName,
  shapeOf,
  stepEntry,
  stepZonedHour,
  toValue,
} from "./index"

const gregorian = new GregorianCalendar()
const fmt = (locale: string, o: Partial<SegmentOptions> = {}): SegmentFormat =>
  segmentFormat({
    locale,
    calendar: gregorian,
    granularity: "day",
    timeZone: "UTC",
    showTimeZone: false,
    forceLeadingZeros: false,
    bc: false,
    ...o,
  })
const order = (f: SegmentFormat) => f.editable.join(" ")

/** Types `chars` into `type` from an empty buffer; the last plan and the draft after it. */
function typeInto(type: DateSegmentType, chars: string, d: Draft, f: SegmentFormat) {
  let buffer = ""
  let draft = d
  const plans = []
  for (const c of chars) {
    const plan = planDigit(type, c, buffer, draft, f)
    plans.push(plan)
    if (plan.kind !== "accept") continue
    buffer = plan.buffer
    draft = { ...draft, [type]: plan.entry }
  }
  return { plans, draft, buffer }
}

const date = (g: DateGranularity = "day") => ({ granularity: g })

describe("Segment List", () => {
  it("day-first locale: en-GB is day, month, year separated by /", () => {
    const f = fmt("en-GB")
    expect(order(f)).toBe("day month year")
    expect(f.segments.filter((s) => s.type === "literal").map((s) => s.text)).toEqual(["/", "/"])
  })

  it("locale change recomputes the order (reka-ui#1127)", () => {
    expect(order(fmt("en-GB"))).toBe("day month year")
    expect(order(fmt("en-US"))).toBe("month day year")
  })

  it("a hidden zone leaves no bracket or trailing literal (reka-ui#2356)", () => {
    const f = fmt("zh-TW", { granularity: "minute", timeZone: "Asia/Taipei", showTimeZone: false })
    const last = f.segments[f.segments.length - 1]
    expect(f.segments.some((s) => s.type === "timeZoneName")).toBe(false)
    expect(last?.type === "literal" ? last.text.replace(/[⁦-⁩]/g, "") : "").toBe("")
    const shown = fmt("zh-TW", {
      granularity: "minute",
      timeZone: "Asia/Taipei",
      showTimeZone: true,
    })
    expect(shown.segments.some((s) => s.type === "timeZoneName")).toBe(true)
  })

  it("minute granularity in 24-hour German has no day period", () => {
    expect(order(fmt("de-DE", date("minute")))).toBe("day month year hour minute")
  })

  it("12-hour en-US has a day period; the time run is isolated", () => {
    const f = fmt("en-US", date("minute"))
    expect(order(f)).toBe("month day year hour minute dayPeriod")
    const text = f.segments.map((s) => s.text || `[${s.type}]`).join("")
    expect(text).toMatch(/⁦\[hour\]:\[minute\]⁩/)
  })

  it("eras: japanese shows an editable era; buddhist (one era) none; gregorian only BC", () => {
    expect(order(fmt("ja-JP-u-ca-japanese", { calendar: createCalendar("japanese") }))).toBe(
      "era year month day",
    )
    expect(order(fmt("th-TH", { calendar: createCalendar("buddhist") }))).toBe("day month year")
    expect(order(fmt("en-US"))).toBe("month day year")
    expect(order(fmt("en-US", { bc: true }))).toContain("era")
  })

  it("persian calendar and arab digits render in the locale's numbering system", () => {
    const fa = fmt("fa-IR", { calendar: createCalendar("persian") })
    expect(fa.numberingSystem).toBe("arabext")
    expect(fa.number("month", 7)).toBe("۷")
    expect(fmt("ar-EG").number("day", 14)).toBe("١٤")
  })
})

describe("Segment Names And Values", () => {
  it('month: "month", value text "10 – October"', () => {
    const f = fmt("en-US")
    const d = draftOf(new CalendarDate(2026, 10, 14), f)
    expect(segmentName("month", "en-US")).toBe("month")
    expect(d.month?.value).toBe(10)
    expect(defaultValueText("month", d.month, d, f)).toBe("10 – October")
    expect(defaultValueText("day", undefined, d, f)).toBeNull()
  })

  it("script subtag respected (zag#3154): sr-Latn-RS names are Latin", () => {
    expect(segmentName("month", "sr-Latn-RS")).toMatch(/^[a-zA-Zčćšžđ ]+$/)
    expect(monthName(10, {}, fmt("sr-Latn-RS"))).toMatch(/^[a-zA-Zčćšžđ ]+$/)
  })

  it("the hour's value text carries the day period", () => {
    const f = fmt("en-US", date("minute"))
    const d = draftOf(new CalendarDateTime(2026, 10, 14, 15, 5), f)
    expect(defaultValueText("hour", d.hour, d, f)).toBe("3 PM")
  })
})

describe("Partial Values And Limits", () => {
  it("day 31 before the month (react-spectrum#3256, react-spectrum#9586, bits-ui#1899)", () => {
    const f = fmt("en-GB")
    expect(limits("day", {}, f).max).toBe(31)
    const { plans, draft } = typeInto("day", "31", {}, f)
    expect(draft.day).toEqual({ value: 31, text: "31" })
    expect(plans.at(-1)).toMatchObject({ kind: "accept", advance: true })
  })

  it("leap day stays 29 while the year is typed (react-spectrum#5965)", () => {
    const f = fmt("en-US")
    let d: Draft = { month: { value: 2, text: "02" }, day: { value: 29, text: "29" } }
    for (const typed of ["2", "20", "202", "2024"]) {
      d = { ...d, year: { value: Number(typed), text: typed } }
      expect(d.day?.value).toBe(29)
    }
    const shape = shapeOf(new CalendarDate(2026, 1, 1))
    expect(toValue(d, f, shape, new CalendarDate(2026, 1, 1), null).value?.toString()).toBe(
      "2024-02-29",
    )
  })

  it("once complete the day's limit is the month's length", () => {
    const f = fmt("en-US")
    const d = draftOf(new CalendarDate(2026, 2, 10), f)
    expect(limits("day", d, f).max).toBe(28)
  })

  it("japanese year limit follows the era's length", () => {
    const f = fmt("ja-JP-u-ca-japanese", { calendar: createCalendar("japanese") })
    const showa = f.eras.findIndex((e) => e.id === "showa")
    expect(limits("year", { era: { value: showa, text: "" } }, f).max).toBe(64)
  })
})

describe("Typing And Auto-Advance", () => {
  const f = fmt("en-US")

  it("leading zero shown and advancing (react-spectrum#6004, react-spectrum#8637)", () => {
    const { plans } = typeInto("month", "01", {}, f)
    expect(plans[0]).toMatchObject({
      kind: "accept",
      advance: false,
      entry: { text: "0", value: null },
    })
    expect(plans[1]).toMatchObject({
      kind: "accept",
      advance: true,
      entry: { text: "01", value: 1 },
    })
  })

  it("year with a leading zero (react-spectrum#9952): 0202 advances, the fifth digit is ignored", () => {
    const { plans, draft } = typeInto("year", "02026", {}, f)
    expect(draft.year).toEqual({ value: 202, text: "0202" })
    expect(plans[3]).toMatchObject({ advance: true })
    expect(plans[4]).toEqual({ kind: "ignore" })
  })

  it("retyping a filled segment (react-spectrum#8366, reka-ui#2567): a new buffer replaces it", () => {
    const filled = draftOf(new CalendarDate(2026, 10, 14), f)
    expect(typeInto("year", "1990", filled, f).draft.year?.value).toBe(1990)
  })

  it("full-width digits (react-spectrum#3739): １２ is 12", () => {
    expect(typeInto("month", "１２", {}, f).draft.month?.value).toBe(12)
  })

  it("non-numeric text is rejected (bits-ui#1988)", () => {
    const { plans, draft } = typeInto("day", "abc12345", {}, f)
    expect(plans.slice(0, 3).every((p) => p.kind === "reject")).toBe(true)
    expect(draft.day?.text).toBe("12")
  })

  it('a value over the limit restarts from the digit: month "1","3" is 3', () => {
    const { draft } = typeInto("month", "13", {}, f)
    expect(draft.month?.value).toBe(3)
  })

  it("12-hour hours are typed 1–12 and 12 is stored as 0", () => {
    const h = fmt("en-US", date("minute"))
    expect(typeInto("hour", "12", {}, h).draft.hour).toEqual({ value: 0, text: "12" })
    expect(typeInto("hour", "2", {}, h).plans[0]).toMatchObject({ advance: true })
  })

  it('zero alone in 12-hour: "0" waits for a digit and alone stands for 12', () => {
    const h = fmt("en-US", date("minute"))
    const { draft, plans } = typeInto("hour", "0", {}, h)
    expect(plans[0]).toMatchObject({ advance: false })
    expect(draft.hour?.value).toBe(0)
    expect(typeInto("hour", "05", {}, h).draft.hour?.value).toBe(5)
  })

  it("separators (react-spectrum#5364): / - . : space and the locale's literals", () => {
    for (const c of ["/", "-", ".", ":", " "]) expect(isSeparator(c, f)).toBe(true)
    expect(isSeparator("1", f)).toBe(false)
    expect(isSeparator("年", fmt("ja-JP"))).toBe(false)
    expect(isSeparator("、", fmt("ar-EG", date("minute")))).toBe(false)
    expect(isSeparator("،", fmt("ar-EG", date("minute")))).toBe(true)
  })

  it("arab digits typed as Latin or Arabic", () => {
    const ar = fmt("ar-EG")
    expect(typeInto("day", "١4", {}, ar).draft.day).toEqual({ value: 14, text: "١٤" })
  })
})

describe("Day Period And Era Typing", () => {
  it('Korean day period (react-spectrum#5832): "오후" is PM, "오" alone is ambiguous', () => {
    const ko = fmt("ko-KR", { ...date("minute"), hourCycle: 12 })
    expect(planName("dayPeriod", "오", ko)).toEqual({ kind: "partial", buffer: "오" })
    expect(planName("dayPeriod", "오후", ko)).toEqual({ kind: "match", value: 1 })
  })

  it("a 12-hour locale that formats no day period still gets one (react-spectrum#10833)", () => {
    expect(order(fmt("fr-CM", { ...date("minute"), hourCycle: 12 }))).toMatch(/minute dayPeriod/)
  })

  it('a lowercase "p" is PM in every locale (reka-ui#980)', () => {
    expect(planName("dayPeriod", "p", fmt("en-US", date("minute")))).toEqual({
      kind: "match",
      value: 1,
    })
    expect(planName("dayPeriod", "A", fmt("ko-KR", { ...date("minute"), hourCycle: 12 }))).toEqual({
      kind: "match",
      value: 0,
    })
  })

  it("era by the start of its name", () => {
    const ja = fmt("ja-JP-u-ca-japanese", { calendar: createCalendar("japanese") })
    const reiwa = ja.eras.findIndex((e) => e.id === "reiwa")
    expect(planName("era", ja.eras[reiwa]?.name.slice(0, 1) ?? "", ja)).toEqual({
      kind: "match",
      value: reiwa,
    })
    expect(planName("era", "x", ja)).toEqual({ kind: "reject" })
  })
})

describe("Stepping Keys", () => {
  const f = fmt("en-US", date("second"))

  it("wrap without carry (react-spectrum#6590): second 59 → 00, minute unchanged", () => {
    const d = draftOf(new CalendarDateTime(2026, 10, 14, 9, 30, 59), f)
    expect(stepEntry("second", d, 1, f)).toEqual({ value: 0, text: "00" })
    expect(d.minute?.value).toBe(30)
  })

  it("Home/End on a 12-hour hour: 12 and 11", () => {
    expect(edgeEntry("hour", {}, "min", f).text).toBe("12")
    expect(edgeEntry("hour", {}, "max", f).text).toBe("11")
  })

  it("page steps wrap", () => {
    const d = draftOf(new CalendarDateTime(2026, 10, 14, 9, 50), f)
    expect(stepEntry("minute", d, 15, f).value).toBe(5)
  })

  it("month step across DST keeps the wall clock (react-spectrum#10776)", () => {
    const value = parseZonedDateTime("2026-10-14T09:44[Europe/Lisbon]")
    const z = fmt("en-US", { ...date("minute"), timeZone: "Europe/Lisbon", showTimeZone: true })
    const d = draftOf(value, z)
    const stepped = { ...d, month: stepEntry("month", d, 1, z) }
    const next = toValue(stepped, z, shapeOf(value), value, value).value
    expect(next?.toString()).toBe("2026-11-14T09:44:00+00:00[Europe/Lisbon]")
  })

  it("zoned hours step through both occurrences of a repeated hour", () => {
    const z = fmt("en-US", { ...date("minute"), hourCycle: 24, timeZone: "Europe/Lisbon" })
    const first = parseZonedDateTime("2026-10-25T01:30+01:00[Europe/Lisbon]")
    const second = stepZonedHour(first, 1, z)
    expect(second.toString()).toBe("2026-10-25T01:30:00+00:00[Europe/Lisbon]")
    // The draft of either shows 01:30; the conversion keeps the occurrence it came from.
    const d = draftOf(second, z)
    expect(toValue(d, z, shapeOf(second), second, second).value?.toString()).toBe(second.toString())
  })

  it("a minute edit in the second occurrence of a repeated hour keeps that occurrence", () => {
    const z = fmt("en-US", { ...date("minute"), hourCycle: 24, timeZone: "Europe/Lisbon" })
    const second = parseZonedDateTime("2026-10-25T01:30+00:00[Europe/Lisbon]")
    const d = draftOf(second, z)
    const edited = { ...d, minute: { value: 45, text: "45" } }
    expect(toValue(edited, z, shapeOf(second), second, second).value?.toString()).toBe(
      "2026-10-25T01:45:00+00:00[Europe/Lisbon]",
    )
  })
})

describe("Validity", () => {
  const f = fmt("en-US")
  const base = new CalendarDate(2026, 1, 1)
  const shape = shapeOf(base)

  it("impossible date kept and reported (react-spectrum#9624)", () => {
    const d: Draft = {
      month: { value: 2, text: "02" },
      day: { value: 31, text: "31" },
      year: { value: 2026, text: "2026" },
    }
    const c = toValue(d, f, shape, base, null)
    expect(c).toEqual({ state: "impossible", value: null })
    expect(dateValidity(c.state, c.value, {})).toBe("impossible")
    expect(d.day?.text).toBe("31")
  })

  it("any partial clear is invalid (react-spectrum#9958)", () => {
    const full = draftOf(new CalendarDate(2026, 10, 14), f)
    for (const cleared of ["month", "day"] as const) {
      const { [cleared]: _, ...rest } = full
      const c = toValue(rest, f, shape, base, null)
      expect(dateValidity(c.state, c.value, { required: true })).toBe("incomplete")
    }
  })

  it("all empty: valid unless required", () => {
    const c = toValue({}, f, shape, base, null)
    expect(dateValidity(c.state, c.value, {})).toBeNull()
    expect(dateValidity(c.state, c.value, { required: true })).toBe("valueMissing")
  })

  it("unavailable typed date (react-spectrum#4848) and range errors", () => {
    const saturday = new CalendarDate(2026, 10, 17)
    const weekend = (d: { compare(o: never): number }) =>
      d instanceof CalendarDate && [0, 6].includes(d.toDate("UTC").getUTCDay())
    expect(dateValidity("complete", saturday, { isDateUnavailable: weekend as never })).toBe(
      "unavailable",
    )
    expect(dateValidity("complete", saturday, { minValue: new CalendarDate(2027, 1, 1) })).toBe(
      "rangeUnderflow",
    )
    expect(dateValidity("complete", saturday, { maxValue: new CalendarDate(2026, 1, 1) })).toBe(
      "rangeOverflow",
    )
  })

  it("minimum does not rewrite other segments (zag#3070)", () => {
    const d: Draft = {
      month: { value: 2, text: "02" },
      day: { value: 22, text: "22" },
      year: { value: 1, text: "1" },
    }
    const c = toValue(d, f, shape, base, null)
    expect(dateValidity(c.state, c.value, { minValue: new CalendarDate(2000, 1, 1) })).toBe(
      "rangeUnderflow",
    )
    expect([d.month?.text, d.day?.text]).toEqual(["02", "22"])
  })
})

describe("Paste And Copy", () => {
  it("an ISO date pasted into an en-GB field (react-spectrum#5285, reka-ui#1897)", () => {
    const f = fmt("en-GB")
    const base = new CalendarDate(2026, 1, 1)
    const v = parsePaste("2026-10-14", f, shapeOf(base), base)
    expect(v?.toString()).toBe("2026-10-14")
    expect(f.format(new Date(Date.UTC(2026, 9, 14)))).toBe("14/10/2026")
  })

  it("the locale's own format: 14.10.2026 in de-DE", () => {
    const base = new CalendarDate(2026, 1, 1)
    expect(parsePaste("14.10.2026", fmt("de-DE"), shapeOf(base), base)?.toString()).toBe(
      "2026-10-14",
    )
  })

  it("a 12-hour date-time in en-US, and other text ignored", () => {
    const f = fmt("en-US", date("minute"))
    const base = new CalendarDateTime(2026, 1, 1, 0, 0)
    expect(parsePaste("10/14/2026, 3:05 PM", f, shapeOf(base), base)?.toString()).toBe(
      "2026-10-14T15:05:00",
    )
    expect(parsePaste("next friday", f, shapeOf(base), base)).toBeNull()
    expect(parsePaste("2026-10-14", f, shapeOf(base), base)).toBeNull()
  })

  it("arab digits in the ar-EG format", () => {
    const base = new CalendarDate(2026, 1, 1)
    expect(parsePaste("١٤/١٠/٢٠٢٦", fmt("ar-EG"), shapeOf(base), base)?.toString()).toBe(
      "2026-10-14",
    )
  })
})

describe("purity", () => {
  it("runs in Node with no DOM", () => {
    expect(typeof document).toBe("undefined")
  })
})
