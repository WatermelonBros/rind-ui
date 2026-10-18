// Range mode's pair (date-field spec "Range Mode — Derived Value", "Ends Never Edit Each Other",
// "Range Validity", "Time Ends And Overnight", "Controlled Value, Clear And Reset").
import { CalendarDate, CalendarDateTime, isWeekend, Time } from "@internationalized/date"
import { describe, expect, it, vi } from "vitest"
import { createService } from "../../machine/service"
import { validityFlags } from "../date-segments"
import { dateFieldMessages } from "./date-field.messages"
import { deriveRange } from "./date-range"
import { type DateRangeFieldProps, dateRangeFieldMachine } from "./date-range.machine"

const d = (m: number, day: number) => new CalendarDate(2026, m, day)
const VALID = validityFlags(null)
const end = (value: CalendarDate | Time | null, message = "") => ({
  value,
  message,
  flags: message ? validityFlags("impossible") : VALID,
})
const derive = (a: ReturnType<typeof end>, b: ReturnType<typeof end>, rules = {}) =>
  deriveRange(a, b, rules, dateFieldMessages)

describe("deriveRange", () => {
  it("both ends in order: the range; equal ends are valid", () => {
    expect(derive(end(d(10, 14)), end(d(10, 16))).value).toEqual({
      start: d(10, 14),
      end: d(10, 16),
    })
    expect(derive(end(d(10, 14)), end(d(10, 14))).message).toBe("")
  })

  it("partial entry is null and incomplete, named by the empty end", () => {
    const r = derive(end(d(10, 14)), end(null))
    expect(r.value).toBeNull()
    expect(r.message).toBe("End date: Enter a complete date")
    expect(r.invalidEdge).toBe("end")
  })

  it("an end's own problem comes first, prefixed (react-spectrum#3328)", () => {
    expect(derive(end(null, "Enter a valid date"), end(d(10, 1))).message).toBe(
      "Start date: Enter a valid date",
    )
  })

  it("inverted range kept as invalid (zag#3186)", () => {
    const r = derive(end(d(6, 20)), end(d(6, 10)))
    expect(r.value).toBeNull()
    expect(r.message).toBe("End date must be on or after the start date")
    expect(r.invalidEdge).toBe("end")
  })

  it("a range over an unavailable day (react-spectrum#5302), unless non-contiguous", () => {
    const isDateUnavailable = (x: { year: number; month: number; day: number }) =>
      isWeekend(x as CalendarDate, "en-US")
    expect(derive(end(d(10, 12)), end(d(10, 16)), { isDateUnavailable }).message).toBe("")
    expect(derive(end(d(10, 12)), end(d(10, 21)), { isDateUnavailable }).message).toBe(
      "The range includes an unavailable date",
    )
    expect(
      derive(end(d(10, 12)), end(d(10, 21)), { isDateUnavailable, allowsNonContiguousRanges: true })
        .message,
    ).toBe("")
  })

  it("empty pair: valid unless required", () => {
    expect(derive(end(null), end(null)).message).toBe("")
    expect(derive(end(null), end(null), { required: true }).flags.valueMissing).toBe(true)
  })

  it("times: strict by default; overnight allowed", () => {
    const strict = derive(end(new Time(22)), end(new Time(6)))
    expect(strict.message).toBe("End time must be after the start time")
    const night = derive(end(new Time(22)), end(new Time(6)), { allowsOvernight: true })
    expect(night.value).toEqual({ start: new Time(22), end: new Time(6) })
    expect(night.overnight).toBe(true)
  })
})

function make(over: Partial<DateRangeFieldProps> = {}) {
  const onValueChange = vi.fn()
  let props: DateRangeFieldProps = { messages: dateFieldMessages, onValueChange, ...over }
  const s = createService(dateRangeFieldMachine, props as never, {} as never)
  s.start()
  return {
    s,
    onValueChange,
    ctx: () => s.getSnapshot().context,
    commit: (edge: "START" | "END", value: CalendarDate | CalendarDateTime | null) =>
      s.send({ type: `${edge}.COMMIT`, value, reason: "SEGMENT.COMMIT" } as never),
    setProps: (p: Partial<DateRangeFieldProps>) => {
      props = { ...props, ...p }
      s.setProps(props as never)
    },
  }
}

describe("dateRangeFieldMachine", () => {
  it("end typed first, then the start: one change (zag#2809)", () => {
    const m = make()
    m.commit("END", d(10, 20))
    expect(m.onValueChange).not.toHaveBeenCalled()
    m.commit("START", d(10, 12))
    expect(m.onValueChange).toHaveBeenCalledTimes(1)
    expect(m.onValueChange.mock.calls[0]?.[0]).toEqual({ start: d(10, 12), end: d(10, 20) })
  })

  it("an inverted end leaves the start untouched (bits-ui#1348)", () => {
    const m = make({ defaultValue: { start: d(5, 5), end: d(5, 10) } })
    m.commit("END", d(5, 1))
    expect(m.ctx().startValue).toEqual(d(5, 5))
    expect(m.onValueChange.mock.calls.at(-1)?.[0]).toBeNull()
  })

  it("each end keeps its own type", () => {
    const m = make({
      defaultValue: {
        start: new CalendarDateTime(2026, 10, 1, 9, 0),
        end: new CalendarDateTime(2026, 10, 3, 9, 0),
      },
    })
    m.commit("END", new CalendarDateTime(2026, 10, 5, 9, 0))
    const v = m.onValueChange.mock.calls[0]?.[0] as { start: CalendarDateTime }
    expect(v.start).toEqual(new CalendarDateTime(2026, 10, 1, 9, 0))
  })

  it("a parent's null clears both ends (reka-ui#1939, #1891, bits-ui#391)", () => {
    const m = make({ value: { start: d(10, 1), end: d(10, 3) } })
    m.setProps({ value: null })
    expect(m.ctx().startValue).toBeNull()
    expect(m.ctx().endValue).toBeNull()
    expect(m.onValueChange).not.toHaveBeenCalled()
  })

  it("a parent applying the pair's own null keeps the typed ends", () => {
    const m = make({ value: { start: d(10, 1), end: d(10, 3) } })
    m.commit("END", d(9, 1))
    expect(m.onValueChange.mock.calls.at(-1)?.[0]).toBeNull()
    m.setProps({ value: null })
    expect(m.ctx().startValue).toEqual(d(10, 1))
    expect(m.ctx().endValue).toEqual(d(9, 1))
  })

  it("CLEAR clears both ends; RESET restores the default range", () => {
    const m = make({ defaultValue: { start: d(10, 1), end: d(10, 3) } })
    m.s.send({ type: "CLEAR" })
    expect(m.ctx().startValue).toBeNull()
    expect(m.onValueChange.mock.calls.at(-1)?.[0]).toBeNull()
    m.s.send({ type: "RESET" })
    expect(m.ctx().endValue).toEqual(d(10, 3))
  })
})
