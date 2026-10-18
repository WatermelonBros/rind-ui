// Date Field picker parts (date-field spec "Picker Parts", "Picker — …"): single and range.
import { CalendarDate, CalendarDateTime, isWeekend } from "@internationalized/date"
import { Calendar, DateField, Dialog, RindProvider } from "@rind-ui/react"
import { render, screen, waitFor } from "@testing-library/react"
import { userEvent } from "@testing-library/user-event"
import type { ReactNode } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { fixedDateClock, getDateField } from "../index"

const clock = fixedDateClock("2026-10-17T12:00:00Z", "UTC")
const d = (m: number, day: number) => new CalendarDate(2026, m, day)
afterEach(() => vi.restoreAllMocks())

type RootProps = Parameters<typeof DateField.Root>[0]

function Parts() {
  return (
    <>
      <DateField.Control>
        <DateField.Input />
        <DateField.Trigger>▾</DateField.Trigger>
        <DateField.ClearTrigger>×</DateField.ClearTrigger>
      </DateField.Control>
      <DateField.Portal>
        <DateField.Positioner>
          <DateField.Content>
            <DateField.Calendar>
              <Calendar.Header>
                <Calendar.PrevTrigger />
                <Calendar.Heading />
                <Calendar.NextTrigger />
              </Calendar.Header>
              <Calendar.Grid />
            </DateField.Calendar>
          </DateField.Content>
        </DateField.Positioner>
      </DateField.Portal>
    </>
  )
}

function Birthday(props: Partial<RootProps> & { readonly children?: ReactNode }) {
  return (
    <RindProvider environment={{ dateClock: clock }}>
      <DateField.Root locale="en-US" name="birthday" {...(props as object)}>
        <DateField.Label>Birthday</DateField.Label>
        <Parts />
      </DateField.Root>
      <button type="button">After</button>
    </RindProvider>
  )
}

function Stay(props: Record<string, unknown>) {
  return (
    <RindProvider environment={{ dateClock: clock }}>
      <DateField.Root selectionMode="range" locale="en-US" {...(props as object)}>
        <DateField.Label>Stay</DateField.Label>
        <Parts />
      </DateField.Root>
    </RindProvider>
  )
}

const trigger = (name = "Choose date Birthday") => screen.getByRole("button", { name })
const cell = (day: number) =>
  screen
    .getAllByRole("gridcell")
    .find(
      (c) => c.textContent === String(day) && !c.hasAttribute("data-outside-month"),
    ) as HTMLElement
const pressCell = (day: number) => cell(day).querySelector("button, [tabindex]") ?? cell(day)

describe("Date Field picker (single)", () => {
  it("one group named by the Label, three spinbuttons and a named trigger", async () => {
    render(<Birthday />)
    const group = screen.getByRole("group", { name: "Birthday" })
    expect(group.querySelectorAll('[role="spinbutton"]')).toHaveLength(3)
    expect(screen.getAllByRole("group")).toHaveLength(1)
    const t = trigger()
    expect(t.getAttribute("aria-haspopup")).toBe("dialog")
    expect(t.getAttribute("aria-expanded")).toBe("false")
    await userEvent.setup().click(t)
    const dialog = await screen.findByRole("dialog", { name: "Choose date Birthday" })
    expect(t.getAttribute("aria-expanded")).toBe("true")
    expect(t.getAttribute("aria-controls")).toBe(dialog.id)
  })

  it("opens on the selected date; a pick commits, closes and focuses the trigger", async () => {
    const onValueChange = vi.fn()
    const onOpenChange = vi.fn()
    render(
      <Birthday
        defaultValue={d(10, 14)}
        onValueChange={onValueChange}
        onOpenChange={onOpenChange}
      />,
    )
    const user = userEvent.setup()
    trigger().focus()
    await user.keyboard("{Enter}")
    await waitFor(() => expect(document.activeElement?.closest('[role="gridcell"]')).toBe(cell(14)))
    await user.keyboard("{ArrowRight}{Enter}")
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull())
    expect(onValueChange).toHaveBeenCalledTimes(1)
    expect(String(onValueChange.mock.calls[0]?.[0])).toBe("2026-10-15")
    expect(onValueChange.mock.calls[0]?.[1].reason).toBe("CALENDAR")
    expect(onOpenChange.mock.calls.map((c) => [c[0], c[1].reason])).toEqual([
      [true, "trigger"],
      [false, "select"],
    ])
    await waitFor(() => expect(document.activeElement).toBe(trigger()))
    const hidden = document.querySelector<HTMLInputElement>('input[name="birthday"]')
    expect(hidden?.value).toBe("2026-10-15")
  })

  it("picking the selected date again closes, the value unchanged", async () => {
    const onValueChange = vi.fn()
    render(<Birthday defaultValue={d(10, 14)} onValueChange={onValueChange} />)
    const user = userEvent.setup()
    await user.click(trigger())
    await screen.findByRole("dialog")
    await user.click(pressCell(14))
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull())
    expect(onValueChange).not.toHaveBeenCalled()
  })

  it("a pick keeps the time of day", async () => {
    const onValueChange = vi.fn()
    render(
      <Birthday
        defaultValue={new CalendarDateTime(2026, 10, 14, 9, 30)}
        granularity="minute"
        onValueChange={onValueChange}
      />,
    )
    const user = userEvent.setup()
    await user.click(trigger())
    await screen.findByRole("dialog")
    await user.click(pressCell(20))
    await waitFor(() => expect(onValueChange).toHaveBeenCalledTimes(1))
    expect(String(onValueChange.mock.calls[0]?.[0])).toBe("2026-10-20T09:30:00")
  })

  it("closeOnSelect={false}: stays open with the picked date selected", async () => {
    render(<Birthday closeOnSelect={false} />)
    const user = userEvent.setup()
    await user.click(trigger())
    await screen.findByRole("dialog")
    await user.click(pressCell(20))
    expect(screen.getByRole("dialog")).toBeTruthy()
    await waitFor(() => expect(cell(20).getAttribute("aria-selected")).toBe("true"))
  })

  it("a refused pick (details.cancel) keeps every view and the popover open", async () => {
    render(
      <Birthday
        defaultValue={d(10, 14)}
        onValueChange={(_v: unknown, x: { cancel(): void }) => x.cancel()}
      />,
    )
    const user = userEvent.setup()
    await user.click(trigger())
    await screen.findByRole("dialog")
    await user.click(pressCell(20))
    // The close is queued in a microtask after the pick: let it run.
    await Promise.resolve()
    await Promise.resolve()
    expect(screen.getByRole("dialog")).toBeTruthy()
    expect(cell(14).getAttribute("aria-selected")).toBe("true")
    const day = screen.getByRole("spinbutton", { name: "day Birthday" })
    expect(day.getAttribute("aria-valuenow")).toBe("14")
  })

  it("Alt+ArrowDown on a segment opens; the segment's value did not change", async () => {
    render(<Birthday defaultValue={d(10, 14)} />)
    const user = userEvent.setup()
    const day = screen.getByRole("spinbutton", { name: "day Birthday" })
    await user.click(day)
    await user.keyboard("{Alt>}{ArrowDown}{/Alt}")
    await screen.findByRole("dialog")
    expect(day.getAttribute("aria-valuenow")).toBe("14")
  })

  it("Escape closes and returns focus to the trigger", async () => {
    render(<Birthday defaultValue={d(10, 14)} />)
    const user = userEvent.setup()
    trigger().focus()
    await user.keyboard("{Enter}")
    await waitFor(() => expect(document.activeElement?.closest('[role="grid"]')).toBeTruthy())
    await user.keyboard("{Escape}")
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull())
    expect(document.activeElement).toBe(trigger())
  })

  it("Tab from the last segment while open: the trigger shows the focus ring", async () => {
    render(<Birthday defaultValue={d(10, 14)} defaultOpen />)
    const user = userEvent.setup()
    await screen.findByRole("dialog")
    await user.click(screen.getByRole("spinbutton", { name: "year Birthday" }))
    await user.tab()
    await waitFor(() => expect(document.activeElement).toBe(trigger()))
    await waitFor(() => expect(trigger().hasAttribute("data-focus-visible")).toBe(true))
  })

  it("typing a date while open moves the calendar's selection; the popover stays open", async () => {
    render(<Birthday />)
    const user = userEvent.setup()
    await user.click(trigger())
    await screen.findByRole("dialog")
    await user.click(screen.getByRole("spinbutton", { name: "month Birthday" }))
    await user.keyboard("03052027")
    expect(screen.getByRole("dialog")).toBeTruthy()
    await waitFor(() => expect(cell(5).getAttribute("aria-selected")).toBe("true"))
    expect(screen.getByRole("dialog").textContent).toContain("March 2027")
  })

  it("Clear trigger empties a partial field and focuses the first segment", async () => {
    render(<Birthday />)
    const user = userEvent.setup()
    await user.click(screen.getByRole("spinbutton", { name: "month Birthday" }))
    await user.keyboard("10")
    await user.click(screen.getByRole("button", { name: "Clear Birthday" }))
    const month = screen.getByRole("spinbutton", { name: "month Birthday" })
    expect(month.getAttribute("aria-valuenow")).toBeNull()
    expect(document.activeElement).toBe(month)
  })

  it("read-only: the trigger is focusable, aria-disabled, and does not open", async () => {
    render(<Birthday readOnly defaultValue={d(10, 14)} />)
    const user = userEvent.setup()
    const t = trigger()
    expect(t.getAttribute("aria-disabled")).toBe("true")
    await user.click(t)
    expect(screen.queryByRole("dialog")).toBeNull()
  })

  it("constraints reach the calendar; firstDayOfWeek is forwarded", async () => {
    render(<Birthday maxValue={d(10, 31)} firstDayOfWeek="mon" defaultValue={d(10, 14)} />)
    const user = userEvent.setup()
    await user.click(trigger())
    const dialog = await screen.findByRole("dialog")
    const next = dialog.querySelector('[data-part="next-trigger"]')
    expect(next?.getAttribute("aria-disabled") ?? next?.hasAttribute("disabled")).toBeTruthy()
    // Monday weeks: October 2026's grid starts on Monday 28 September.
    expect(dialog.querySelector("[data-value]")?.getAttribute("data-value")).toBe("2026-09-28")
  })

  it("inside a modal Dialog: a pick closes the picker, not the Dialog", async () => {
    render(
      <RindProvider environment={{ dateClock: clock }}>
        <Dialog.Root defaultOpen>
          <Dialog.Portal>
            <Dialog.Content>
              <Dialog.Title>Edit</Dialog.Title>
              <DateField.Root locale="en-US">
                <DateField.Label>Birthday</DateField.Label>
                <Parts />
              </DateField.Root>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
      </RindProvider>,
    )
    const user = userEvent.setup()
    await user.click(trigger())
    await screen.findByRole("dialog", { name: "Choose date Birthday" })
    await user.click(pressCell(20))
    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: "Choose date Birthday" })).toBeNull(),
    )
    expect(screen.getByRole("dialog", { name: "Edit" })).toBeTruthy()
    expect(
      screen.getByRole("spinbutton", { name: "day Birthday" }).getAttribute("aria-valuenow"),
    ).toBe("20")
  })
})

describe("Date Field picker (range)", () => {
  it("one group, six spinbuttons and a trigger named Choose dates", () => {
    render(<Stay />)
    const group = screen.getByRole("group", { name: "Stay" })
    expect(group.querySelectorAll('[role="spinbutton"]')).toHaveLength(6)
    expect(trigger("Choose dates Stay")).toBeTruthy()
  })

  it("two picks commit the range once, close, and focus the trigger", async () => {
    const onValueChange = vi.fn()
    render(<Stay onValueChange={onValueChange} />)
    const user = userEvent.setup()
    await user.click(trigger("Choose dates Stay"))
    await screen.findByRole("dialog", { name: "Choose dates Stay" })
    await user.click(pressCell(12))
    expect(screen.getByRole("dialog")).toBeTruthy()
    await user.click(pressCell(16))
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull())
    expect(onValueChange).toHaveBeenCalledTimes(1)
    const v = onValueChange.mock.calls[0]?.[0] as { start: CalendarDate; end: CalendarDate }
    expect(`${v.start}..${v.end}`).toBe("2026-10-12..2026-10-16")
    expect(
      screen.getByRole("spinbutton", { name: "day End date Stay" }).getAttribute("aria-valuenow"),
    ).toBe("16")
    await waitFor(() => expect(document.activeElement).toBe(trigger("Choose dates Stay")))
  })

  it("the range rules reach the calendar: no end across a weekend", async () => {
    render(<Stay isDateUnavailable={(date: CalendarDate) => isWeekend(date, "en-US")} />)
    const user = userEvent.setup()
    await user.click(trigger("Choose dates Stay"))
    await screen.findByRole("dialog")
    await user.click(pressCell(14))
    // 19 October is past the weekend of 17–18: not a possible end.
    expect(cell(19).getAttribute("aria-disabled")).toBe("true")
  })

  it("driver: open, pick a range, read both hidden inputs", async () => {
    render(<Stay />)
    const stay = getDateField(screen, { name: "Stay", selectionMode: "range" })
    await stay.openPicker()
    expect(await stay.isOpen()).toBe(true)
    await stay.pickDate("2026-10-12")
    await stay.pickDate("2026-10-16")
    await waitFor(async () => expect(await stay.isOpen()).toBe(false))
    expect(await stay.range()).toEqual({ start: "2026-10-12", end: "2026-10-16" })
  })
})

describe("Date Field picker driver (single)", () => {
  it("open, read the calendar's selection, pick, clear", async () => {
    render(<Birthday defaultValue={d(10, 14)} />)
    const birthday = getDateField(screen, { name: "Birthday" })
    await birthday.openPicker()
    expect(await birthday.calendarSelection()).toEqual(["2026-10-14"])
    await birthday.pickDate("2026-10-20")
    await waitFor(async () => expect(await birthday.isOpen()).toBe(false))
    expect(await birthday.value()).toBe("2026-10-20")
    await birthday.clearPicker()
    expect(await birthday.value()).toBe("")
  })
})
