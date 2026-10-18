// The Date Field machine in Node (task 2.2): commit points, auto-advance, Backspace,
// steps, paste, controlled values, reset, locale changes, boundary and draft hints.

import {
  CalendarDate,
  CalendarDateTime,
  type DateValue,
  GregorianCalendar,
  parseZonedDateTime,
} from "@internationalized/date"
import { describe, expect, it, vi } from "vitest"
import { recordingFormInput } from "../../dom/hidden-input"
import { platforms } from "../../dom/platform"
import { createService } from "../../machine/service"
import type { DateSegmentType } from "../date-segments"
import { dateFieldKey } from "./date-field.connect"
import {
  type DateFieldEvent,
  type DateFieldProps,
  dateFieldMachine,
  formValueOf,
  type SegmentNavigation,
} from "./date-field.machine"

const gregorian = new GregorianCalendar()

function make(over: Partial<DateFieldProps> = {}, navigation?: SegmentNavigation) {
  const onValueChange = vi.fn()
  const onBoundary = vi.fn()
  const onDraftChange = vi.fn()
  const focused: DateSegmentType[] = []
  const rec = recordingFormInput()
  let props: DateFieldProps = {
    onValueChange,
    onBoundary,
    onDraftChange,
    focusSegment: (t) => focused.push(t),
    placeholderValue: new CalendarDate(2026, 10, 17),
    locale: "en-US",
    calendar: gregorian,
    id: "d",
    ...over,
  }
  const s = createService(
    dateFieldMachine,
    props as never,
    {
      formInput: rec.capability,
      navigation,
    } as never,
  )
  s.start()
  const send = (e: DateFieldEvent) => s.send(e as never)
  const snap = () => s.getSnapshot()
  const api = {
    s,
    rec,
    focused,
    onValueChange,
    onBoundary,
    onDraftChange,
    send,
    value: () => (s.view(props as never).values.value ?? null) as DateValue | null,
    state: () => snap().state,
    active: () => snap().context.active,
    text: (t: DateSegmentType) => snap().context.draft[t]?.text ?? "",
    texts: () =>
      (["month", "day", "year", "hour", "minute", "dayPeriod"] as const)
        .map((t) => snap().context.draft[t]?.text ?? "_")
        .join(" "),
    focus: (segment: DateSegmentType) =>
      send({ type: "SEGMENT.FOCUS", segment, modality: "keyboard" }),
    /** Typed into the focused segment, one key at a time (focus follows the requests). */
    type: (chars: string) => {
      for (const c of chars) {
        const segment = snap().context.active
        if (!segment) throw new Error("no focused segment")
        send({ type: "INPUT", segment, data: c })
        const now = snap().context.active
        // The adapter's focus request arriving as a DOM focus.
        if (now && now !== segment)
          send({ type: "SEGMENT.FOCUS", segment: now, modality: "keyboard" })
      }
    },
    key: (type: "INCREASE" | "DECREASE" | "PAGE_PREV" | "PAGE_NEXT" | "FIRST" | "LAST") =>
      send({ type, segment: snap().context.active ?? "month", modality: "keyboard" }),
    backspace: () => send({ type: "BACKSPACE", segment: snap().context.active ?? "month" }),
    blur: () => send({ type: "SEGMENT.BLUR", related: "outside" }),
    tabTo: (segment: DateSegmentType) => {
      send({ type: "SEGMENT.BLUR", related: "segment" })
      send({ type: "SEGMENT.FOCUS", segment, modality: "keyboard" })
    },
    setProps: (p: Partial<DateFieldProps>) => {
      props = { ...props, ...p }
      s.setProps(props as never)
    },
  }
  return api
}

describe("Commit Points", () => {
  it("typing a year emits once, with the whole date", () => {
    const f = make()
    f.focus("month")
    f.type("1014")
    expect(f.active()).toBe("year")
    expect(f.onValueChange).not.toHaveBeenCalled()
    f.type("2026")
    expect(f.onValueChange).toHaveBeenCalledTimes(1)
    expect(f.value()?.toString()).toBe("2026-10-14")
    expect(f.onValueChange.mock.lastCall?.[0].toString()).toBe("2026-10-14")
  })

  it("typing inside a segment never commits; leaving does", () => {
    const f = make({ defaultValue: new CalendarDate(2026, 10, 14) })
    f.focus("year")
    f.type("19")
    expect(f.onValueChange).not.toHaveBeenCalled()
    f.blur()
    // "19" is year 19: a real date, committed on blur.
    expect(f.value()?.toString()).toBe("0019-10-14")
    expect(f.state()).toBe("idle")
  })

  it("time-only changes are not swallowed (zag#3117)", () => {
    const f = make({
      defaultValue: new CalendarDateTime(2026, 10, 14, 9, 30),
      granularity: "minute",
    })
    f.focus("minute")
    f.type("45")
    expect(f.value()?.toString()).toBe("2026-10-14T09:45:00")
  })

  it("the hidden input follows each change, dispatching for user changes only", () => {
    const f = make()
    f.focus("month")
    f.type("10142026")
    expect(f.rec.calls.at(-1)).toEqual({ value: { value: "2026-10-14" }, dispatch: true })
    f.send({ type: "RESET" })
    expect(f.value()).toBeNull()
  })

  it("keystroke not lost on advance (react-spectrum#10683): the completing digit is in", () => {
    const f = make({ defaultValue: new CalendarDate(2026, 10, 14) })
    f.focus("day")
    f.type("2")
    f.type("5")
    f.blur()
    expect(f.value()?.toString()).toBe("2026-10-25")
  })
})

describe("Typing, advance and boundaries", () => {
  it("leading zero keeps focus, the second digit advances", () => {
    const f = make()
    f.focus("month")
    f.type("0")
    expect([f.text("month"), f.active()]).toEqual(["0", "month"])
    f.type("1")
    expect([f.text("month"), f.active()]).toEqual(["01", "day"])
  })

  it('a separator advances (react-spectrum#5364): "3" "/" in the month', () => {
    const f = make()
    f.focus("month")
    f.type("3/")
    expect([f.text("month"), f.active()]).toEqual(["3", "day"])
  })

  it("the last segment does not overwrite (reka-ui#2002) and reports the boundary", () => {
    const f = make()
    f.focus("month")
    f.type("10142026")
    expect(f.onBoundary).toHaveBeenCalledWith({ direction: "next", reason: "advance" })
    expect(f.active()).toBe("year")
    f.type("7")
    expect(f.text("year")).toBe("2026")
  })

  it("year typed with a leading zero shows 0202 after leaving (react-spectrum#9952)", () => {
    const f = make()
    f.focus("year")
    f.type("0202")
    f.blur()
    expect(f.text("year")).toBe("0202")
  })

  it("retyping a filled segment replaces it (react-spectrum#8366)", () => {
    const f = make({ defaultValue: new CalendarDate(2026, 10, 14) })
    f.focus("year")
    f.type("1990")
    expect(f.value()?.toString()).toBe("1990-10-14")
  })

  it("RTL does not change auto-advance: format order (reka-ui#2812)", () => {
    const f = make()
    f.focus("month")
    f.type("2")
    expect(f.active()).toBe("day")
  })

  it("day period by a lowercase letter (reka-ui#980)", () => {
    const f = make({
      defaultValue: new CalendarDateTime(2026, 10, 14, 9, 30),
      granularity: "minute",
    })
    f.focus("dayPeriod")
    f.type("p")
    expect(f.value()?.toString()).toBe("2026-10-14T21:30:00")
  })

  it("korean day period after the composition ends (react-spectrum#5832)", () => {
    const f = make({
      defaultValue: new CalendarDateTime(2026, 10, 14, 9, 30),
      granularity: "minute",
      locale: "ko-KR",
      hourCycle: 12,
    })
    f.focus("dayPeriod")
    f.send({ type: "COMPOSITION.START" })
    expect(f.state()).toBe("composing")
    f.key("INCREASE")
    expect(f.value()?.toString()).toBe("2026-10-14T09:30:00")
    f.send({ type: "COMPOSITION.END", segment: "dayPeriod", text: "오후" })
    expect(f.state()).toBe("editing")
    expect(f.value()?.toString()).toBe("2026-10-14T21:30:00")
  })
})

describe("Stepping", () => {
  it("an empty segment takes the placeholder's part first; steps commit at once", () => {
    const f = make({ defaultValue: new CalendarDate(2026, 10, 14) })
    f.focus("month")
    f.key("INCREASE")
    expect(f.value()?.toString()).toBe("2026-11-14")
    const g = make()
    g.focus("month")
    g.key("INCREASE")
    expect(g.text("month")).toBe("10")
    expect(g.value()).toBeNull()
  })

  it("Enter is no step key (reka-ui#1993): the keydown path leaves it to the browser", () => {
    const k = (key: string) => ({
      key,
      code: "",
      shift: false,
      alt: false,
      ctrl: false,
      meta: false,
      repeat: false,
      composing: false,
    })
    const o = { dir: "ltr", platform: platforms.windows, selectAll: false } as const
    // Implicit submission: no machine event, so nothing prevents the browser's default.
    expect(dateFieldKey(k("Enter"), "minute", o)).toBeNull()
    expect(dateFieldKey(k("ArrowUp"), "minute", o)).toMatchObject({ type: "INCREASE" })
  })

  it("one form-value normaliser, truncated to the granularity", () => {
    const t = new CalendarDateTime(2026, 10, 14, 9, 30, 15)
    expect(formValueOf(t, "minute")).toBe("2026-10-14T09:30")
    expect(formValueOf(t, "hour")).toBe("2026-10-14T09:00")
    expect(formValueOf(t, "second")).toBe("2026-10-14T09:30:15")
    expect(formValueOf(new CalendarDateTime(2026, 10, 14, 9, 30), "second")).toBe(
      "2026-10-14T09:30",
    )
    expect(formValueOf(new CalendarDate(2026, 12, 31), "minute", "datetime")).toBe(
      "2026-12-31T00:00",
    )
    expect(formValueOf(new CalendarDate(2026, 12, 31))).toBe("2026-12-31")
    expect(formValueOf(null)).toBe("")
  })

  it("the hidden input gets the truncated value at minute granularity", () => {
    const f = make({
      defaultValue: new CalendarDateTime(2026, 10, 14, 9, 30, 15),
      granularity: "minute",
    })
    f.focus("minute")
    f.key("INCREASE")
    expect(f.rec.calls.at(-1)?.value).toEqual({ value: "2026-10-14T09:31" })
  })

  it("month step across DST keeps 09:44 (react-spectrum#10776)", () => {
    const f = make({
      defaultValue: parseZonedDateTime("2026-10-14T09:44[Europe/Lisbon]"),
      granularity: "minute",
    })
    f.focus("month")
    f.key("INCREASE")
    expect(f.value()?.toString()).toBe("2026-11-14T09:44:00+00:00[Europe/Lisbon]")
  })

  it("read-only: steps and typing change nothing", () => {
    const f = make({ defaultValue: new CalendarDate(2026, 10, 14), readOnly: true })
    f.focus("month")
    f.key("INCREASE")
    f.type("1")
    expect(f.value()?.toString()).toBe("2026-10-14")
    expect(f.onValueChange).not.toHaveBeenCalled()
  })
})

describe("Backspace And Clearing", () => {
  it("deleting the year keeps the rest (reka-ui#1639); the value becomes null", () => {
    const f = make({ defaultValue: new CalendarDate(2026, 10, 14) })
    f.focus("year")
    for (let i = 0; i < 4; i++) f.backspace()
    expect(f.texts().startsWith("10 14 _")).toBe(true)
    expect(f.value()).toBeNull()
    // The form value follows at once (react-spectrum#9801).
    expect(f.rec.calls.at(-1)?.value).toEqual({ value: "" })
  })

  it("back to the previous segment (reka-ui#1758)", () => {
    const f = make({ defaultValue: new CalendarDate(2026, 10, 14) })
    f.focus("day")
    f.backspace()
    f.backspace()
    expect(f.active()).toBe("day")
    f.backspace()
    expect(f.active()).toBe("month")
    expect(f.text("month")).toBe("10")
  })

  it("Backspace in the first empty segment reports the boundary and clears nothing", () => {
    const f = make()
    f.focus("month")
    f.backspace()
    expect(f.onBoundary).toHaveBeenCalledWith({ direction: "previous", reason: "backspace" })
    expect(f.active()).toBe("month")
  })

  it("retyping after a clear (react-spectrum#5223)", () => {
    const f = make({
      defaultValue: new CalendarDateTime(2026, 10, 14, 9, 5),
      granularity: "minute",
    })
    f.focus("minute")
    f.backspace()
    f.backspace()
    f.type("23")
    expect(f.value()?.toString()).toBe("2026-10-14T09:23:00")
  })

  it("select all + Backspace clears every segment", () => {
    const f = make({ defaultValue: new CalendarDate(2026, 10, 14) })
    f.focus("day")
    f.send({ type: "CLEAR_ALL" })
    expect(f.texts()).toBe("_ _ _ _ _ _")
    expect(f.value()).toBeNull()
  })
})

describe("Validity states keep the text", () => {
  it("an impossible date is kept, the value null (react-spectrum#9624)", () => {
    const f = make()
    f.focus("month")
    f.type("02312026")
    f.blur()
    expect(f.texts().startsWith("02 31 2026")).toBe(true)
    expect(f.value()).toBeNull()
  })
})

describe("Paste", () => {
  it("an ISO date replaces the whole field and commits", () => {
    const f = make({ locale: "en-GB" })
    f.focus("day")
    f.send({ type: "PASTE", text: "2026-10-14" })
    expect(f.value()?.toString()).toBe("2026-10-14")
    expect(f.onValueChange).toHaveBeenCalledTimes(1)
  })

  it("other text is ignored", () => {
    const f = make()
    f.focus("day")
    f.send({ type: "PASTE", text: "tomorrow" })
    expect(f.value()).toBeNull()
    expect(f.onValueChange).not.toHaveBeenCalled()
  })
})

describe("Controlled Value, Reset And Clearing", () => {
  it("external clear while focused (bits-ui#2174, reka-ui#1426): segments empty, focus kept", () => {
    const f = make({ value: new CalendarDate(2026, 10, 14) })
    f.focus("day")
    f.setProps({ value: null })
    expect(f.texts()).toBe("_ _ _ _ _ _")
    expect(f.active()).toBe("day")
    expect(f.state()).toBe("editing")
  })

  it("a controlled change never calls onValueChange", () => {
    const f = make({ value: new CalendarDate(2026, 10, 14) })
    f.setProps({ value: new CalendarDate(2027, 1, 1) })
    expect(f.onValueChange).not.toHaveBeenCalled()
    expect(f.text("year")).toBe("2027")
  })

  it("a proposal applied by the parent keeps the draft; refused, the draft reverts", () => {
    const f = make({ value: new CalendarDate(2026, 10, 14) })
    f.focus("year")
    f.type("2030")
    expect(f.onValueChange).toHaveBeenCalledTimes(1)
    f.setProps({ value: new CalendarDate(2030, 10, 14) })
    expect(f.text("year")).toBe("2030")
    f.key("INCREASE")
    // The parent keeps 2030: refused.
    f.setProps({ value: new CalendarDate(2030, 10, 14) })
    expect(f.text("year")).toBe("2030")
  })

  it("reset a partial field (react-spectrum#9366): every segment empty", () => {
    const f = make({ granularity: "minute", placeholderValue: new CalendarDateTime(2026, 1, 1) })
    f.focus("hour")
    f.type("9")
    f.send({ type: "RESET" })
    expect(f.texts()).toBe("_ _ _ _ _ _")
    expect(f.value()).toBeNull()
  })
})

describe("Recompute on locale change (reka-ui#1127)", () => {
  it("en-GB → en-US keeps values and the focused type", () => {
    const f = make({ locale: "en-GB", defaultValue: new CalendarDate(2026, 10, 14) })
    f.focus("month")
    f.focused.length = 0
    f.setProps({ locale: "en-US" })
    expect(f.active()).toBe("month")
    expect(f.focused).toEqual(["month"])
    expect(f.value()?.toString()).toBe("2026-10-14")
    expect(f.text("month")).toBe("10")
  })

  it("a partial draft survives a change of hour cycle", () => {
    const f = make({
      granularity: "minute",
      placeholderValue: new CalendarDateTime(2026, 1, 1),
      hourCycle: 24,
    })
    f.focus("hour")
    f.type("15")
    f.setProps({ hourCycle: 12 })
    expect([f.text("hour"), f.text("dayPeriod")]).toEqual(["3", "PM"])
  })
})

describe("Moving between segments", () => {
  it("arrows use the layout; with none adjacent the boundary is reported", () => {
    const f = make({}, { adjacent: (t, d) => (t === "month" && d === "next" ? "day" : null) })
    f.focus("month")
    f.send({ type: "NEXT", segment: "month" })
    expect(f.active()).toBe("day")
    f.send({ type: "PREV", segment: "day" })
    expect(f.onBoundary).toHaveBeenCalledWith({ direction: "previous", reason: "arrow" })
  })

  it("moving between segments commits the one left", () => {
    const f = make({ defaultValue: new CalendarDate(2026, 10, 14) })
    f.focus("month")
    f.type("1")
    expect(f.onValueChange).not.toHaveBeenCalled()
    f.tabTo("day")
    expect(f.value()?.toString()).toBe("2026-01-14")
  })
})

describe("Draft Hint", () => {
  it("calendar follows the typed month and year; no value change", () => {
    const f = make()
    f.focus("month")
    f.type("3/")
    f.focus("year")
    f.type("2031")
    expect(f.onDraftChange.mock.calls.map((c) => c[0])).toEqual([
      { year: null, month: 3, day: null },
      { year: 2031, month: 3, day: null },
    ])
    expect(f.onValueChange).not.toHaveBeenCalled()
  })
})
