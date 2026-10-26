// Date Field picker parts (date-field spec "Picker Parts", "Picker — …"): single and range.
import { CalendarDate, CalendarDateTime, type DateValue, isWeekend } from "@internationalized/date"
import type { Scheduler } from "@rind-ui/core"
import { Calendar, DateField, Dialog, RindProvider } from "@rind-ui/react"
import { render, screen, waitFor } from "@testing-library/react"
import { userEvent } from "@testing-library/user-event"
import type { ReactNode } from "react"
import { renderToString } from "react-dom/server"
import { afterEach, describe, expect, it, vi } from "vitest"
import { domEnv, fixedDateClock, getDateField } from "../index"

const clock = fixedDateClock("2026-10-17T12:00:00Z", "UTC")
const d = (m: number, day: number) => new CalendarDate(2026, m, day)
afterEach(() => vi.restoreAllMocks())

type RootProps = Parameters<typeof DateField.Root>[0]

function Parts({ close = false }: { readonly close?: boolean }) {
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
            {close ? <DateField.CloseTrigger>Close</DateField.CloseTrigger> : null}
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

function Birthday({
  close,
  ...props
}: Partial<RootProps> & { readonly children?: ReactNode; readonly close?: boolean }) {
  return (
    <RindProvider environment={{ dateClock: clock }}>
      <DateField.Root locale="en-US" name="birthday" {...(props as object)}>
        <DateField.Label>Birthday</DateField.Label>
        <Parts close={close === true} />
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

  it("the calendar follows the field's own locale, not the app's (react-spectrum#8557)", async () => {
    render(<Birthday locale="de-DE" defaultValue={d(10, 14)} />)
    const user = userEvent.setup()
    await user.click(trigger())
    const dialog = await screen.findByRole("dialog")
    expect(dialog.querySelector('[data-part="heading"]')?.textContent).toMatch(/Oktober/)
    // German weeks start on Monday: October 2026's grid starts on Monday 28 September.
    expect(dialog.querySelector("[data-value]")?.getAttribute("data-value")).toBe("2026-09-28")
  })

  it("min greater than max: a development warning names both props (react-spectrum#5208)", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    render(<Birthday minValue={d(10, 20)} maxValue={d(10, 10)} />)
    const user = userEvent.setup()
    await user.click(trigger())
    await screen.findByRole("dialog")
    const said = warn.mock.calls.map((c) => String(c[0]))
    expect(said.some((m) => m.includes("date-field") && m.includes("minValue"))).toBe(true)
    expect(said.some((m) => m.includes("calendar") && m.includes("maxValue"))).toBe(true)
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

describe("Date Field picker (single, review)", () => {
  it("after a refused pick, picking the selected date again closes", async () => {
    let refuse = true
    render(
      <Birthday
        defaultValue={d(10, 14)}
        onValueChange={(_v: unknown, x: { cancel(): void }) => {
          if (refuse) x.cancel()
        }}
      />,
    )
    const user = userEvent.setup()
    await user.click(trigger())
    await screen.findByRole("dialog")
    await user.click(pressCell(20))
    await Promise.resolve()
    await Promise.resolve()
    expect(screen.getByRole("dialog")).toBeTruthy()
    refuse = false
    await user.click(pressCell(14))
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull())
  })

  it("an outside press closes without committing", async () => {
    const onValueChange = vi.fn()
    render(<Birthday defaultValue={d(10, 14)} onValueChange={onValueChange} />)
    const user = userEvent.setup()
    await user.click(trigger())
    await screen.findByRole("dialog")
    await user.click(screen.getByRole("button", { name: "After" }))
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull())
    expect(onValueChange).not.toHaveBeenCalled()
  })

  it("disabled: the trigger is disabled and never opens", async () => {
    render(<Birthday disabled />)
    const t = trigger()
    expect((t as HTMLButtonElement).disabled).toBe(true)
    await userEvent.setup().click(t)
    expect(screen.queryByRole("dialog")).toBeNull()
  })

  it("an unavailable day cannot be picked: the popover stays open, the value unchanged", async () => {
    const onValueChange = vi.fn()
    render(
      <Birthday
        defaultValue={d(10, 14)}
        isDateUnavailable={(date: DateValue) => isWeekend(date, "en-US")}
        onValueChange={onValueChange}
      />,
    )
    const user = userEvent.setup()
    await user.click(trigger())
    await screen.findByRole("dialog")
    await user.click(pressCell(17))
    expect(screen.getByRole("dialog")).toBeTruthy()
    expect(onValueChange).not.toHaveBeenCalled()
  })

  it("server render: closed, trigger not expanded, no dialog", () => {
    const html = renderToString(<Birthday defaultValue={d(10, 14)} />)
    expect(html).toContain('aria-expanded="false"')
    expect(html).not.toContain('role="dialog"')
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

  it("driver: openPicker waits for the first placement (the popup takes no pointer input before)", async () => {
    // Held animation frames: the first placement waits for one, as on a starved CI page.
    const held: (() => void)[] = []
    let hold = true
    const scheduler: Scheduler = {
      // fake-time: timers pass through untouched; only the animation frames are held.
      setTimeout: (cb, ms) => window.setTimeout(cb, ms),
      // The handles are the window's own numbers (or a held frame's index, never cancelled).
      clearTimeout: (h) => window.clearTimeout(h as number),
      requestAnimationFrame: (cb) => (hold ? held.push(cb) : window.requestAnimationFrame(cb)),
      cancelAnimationFrame: (h) => {
        if (!hold) window.cancelAnimationFrame(h as number)
      },
    }
    render(
      <RindProvider environment={{ dateClock: clock, scheduler }}>
        <DateField.Root selectionMode="range" locale="en-US">
          <DateField.Label>Stay</DateField.Label>
          <Parts />
        </DateField.Root>
      </RindProvider>,
    )
    const short = getDateField(() => domEnv({ timeout: 200 }), {
      name: "Stay",
      selectionMode: "range",
    })
    // Open but unplaced: the postcondition is not met.
    await expect(short.openPicker()).rejects.toThrow(/openPicker/)
    const content = screen.getByRole("dialog")
    expect(content.getAttribute("data-state")).toBe("open")
    expect(content.hasAttribute("data-placing")).toBe(true)
    hold = false
    for (const cb of held.splice(0)) cb()
    const stay = getDateField(screen, { name: "Stay", selectionMode: "range" })
    await waitFor(async () => expect(await stay.isOpen()).toBe(true))
    await waitFor(() => expect(content.hasAttribute("data-placing")).toBe(false))
    await stay.pickDate("2026-10-12")
    await stay.pickDate("2026-10-16")
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

describe("Date Field picker (range, review)", () => {
  it("typing a range while open moves and selects the calendar", async () => {
    render(<Stay />)
    const user = userEvent.setup()
    await user.click(trigger("Choose dates Stay"))
    const dialog = await screen.findByRole("dialog")
    await user.click(screen.getByRole("spinbutton", { name: "month Start date Stay" }))
    await user.keyboard("03052027")
    await user.keyboard("03082027")
    await waitFor(() => expect(dialog.textContent).toContain("March 2027"))
    await waitFor(() => expect(cell(5).getAttribute("aria-selected")).toBe("true"))
    expect(cell(8).getAttribute("aria-selected")).toBe("true")
    expect(screen.getByRole("dialog")).toBeTruthy()
  })

  it("resume: a typed start is the anchor; one press sets the end", async () => {
    const onValueChange = vi.fn()
    render(<Stay onValueChange={onValueChange} />)
    const user = userEvent.setup()
    await user.click(screen.getByRole("spinbutton", { name: "month Start date Stay" }))
    await user.keyboard("10122026")
    await user.click(trigger("Choose dates Stay"))
    await screen.findByRole("dialog")
    await user.click(pressCell(16))
    await waitFor(() => expect(onValueChange).toHaveBeenCalledTimes(1))
    const v = onValueChange.mock.calls[0]?.[0] as { start: CalendarDate; end: CalendarDate }
    expect(`${v.start}..${v.end}`).toBe("2026-10-12..2026-10-16")
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull())
  })

  it("an outside press drops a half range and commits nothing", async () => {
    const onValueChange = vi.fn()
    render(<Stay onValueChange={onValueChange} />)
    const user = userEvent.setup()
    await user.click(trigger("Choose dates Stay"))
    await screen.findByRole("dialog")
    await user.click(pressCell(12))
    await user.click(document.body)
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull())
    expect(onValueChange).not.toHaveBeenCalled()
  })

  it("Escape twice: the first drops the anchor, the second closes", async () => {
    render(<Stay />)
    const user = userEvent.setup()
    await user.click(trigger("Choose dates Stay"))
    await screen.findByRole("dialog")
    await user.click(pressCell(12))
    await user.keyboard("{Escape}")
    expect(screen.getByRole("dialog")).toBeTruthy()
    expect(document.querySelector('[data-scope="calendar"][data-anchored]')).toBeNull()
    await user.keyboard("{Escape}")
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull())
  })
})

/** A tap with the element's coordinates (the press hit test needs them). */
async function tap(user: ReturnType<typeof userEvent.setup>, el: Element) {
  const r = el.getBoundingClientRect()
  const coords = { clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 }
  await user.pointer([{ keys: "[TouchA]", target: el, coords }])
}
const pickerDialog = () => screen.queryByRole("dialog", { name: "Choose date Birthday" })

describe("Date Field picker (modality, Field and form, touch)", () => {
  it("modal: Tab wraps inside the content and the field is inert", async () => {
    render(<Birthday modal close />)
    const user = userEvent.setup()
    await user.click(trigger())
    const content = await screen.findByRole("dialog", { name: "Choose date Birthday" })
    expect(content.getAttribute("aria-modal")).toBe("true")
    expect(content.hasAttribute("data-modal")).toBe(true)
    const next = screen.getByRole("button", { name: /next/i })
    next.focus()
    await user.tab()
    await user.tab()
    expect(content.contains(document.activeElement)).toBe(true)
    expect(screen.getByRole("group", { name: "Birthday" }).closest("[inert]")).not.toBeNull()
  })

  it("non-modal: the field stays operable while open", async () => {
    render(<Birthday />)
    const user = userEvent.setup()
    await user.click(trigger())
    await screen.findByRole("dialog", { name: "Choose date Birthday" })
    const month = screen.getByRole("spinbutton", { name: "month Birthday" })
    await user.click(month)
    await user.keyboard("3")
    expect(month.getAttribute("aria-valuenow")).toBe("3")
    expect(pickerDialog()).not.toBeNull()
  })

  it("Tab from the content's last tabbable leaves and closes with reason outside-focus", async () => {
    const onOpenChange = vi.fn()
    render(<Birthday onOpenChange={onOpenChange} />)
    const user = userEvent.setup()
    await user.click(trigger())
    const content = await screen.findByRole("dialog", { name: "Choose date Birthday" })
    const tabbables = content.querySelectorAll<HTMLElement>(
      "button:not([disabled]), [tabindex='0']",
    )
    ;(tabbables[tabbables.length - 1] as HTMLElement).focus()
    await user.tab()
    await waitFor(() => expect(pickerDialog()).toBeNull())
    expect(onOpenChange).toHaveBeenLastCalledWith(
      false,
      expect.objectContaining({ reason: "outside-focus" }),
    )
    expect(content.contains(document.activeElement)).toBe(false)
    expect(document.activeElement).not.toBe(document.body)
  })

  it("opening from the keyboard does not touch the Field (blur validation)", async () => {
    const { Field } = await import("@rind-ui/react")
    render(
      <RindProvider environment={{ dateClock: clock }}>
        <Field.Root validationMode="blur" data-testid="field">
          <Field.Label>Birthday</Field.Label>
          <DateField.Root locale="en-US">
            <Parts />
          </DateField.Root>
        </Field.Root>
      </RindProvider>,
    )
    const user = userEvent.setup()
    await user.click(screen.getByRole("spinbutton", { name: "month Birthday" }))
    await user.keyboard("{Alt>}{ArrowDown}{/Alt}")
    const content = await screen.findByRole("dialog", { name: "Choose date Birthday" })
    // Initial focus waits for the popup's first placement.
    await waitFor(() => expect(content.contains(document.activeElement)).toBe(true))
    expect(screen.getByTestId("field").hasAttribute("data-touched")).toBe(false)
  })

  it("minute granularity submits a datetime-local value", async () => {
    const submitted = vi.fn((e: SubmitEvent) => {
      e.preventDefault()
      return new FormData(e.target as HTMLFormElement).get("at")
    })
    render(
      <RindProvider environment={{ dateClock: clock }}>
        <form onSubmit={(e) => submitted(e.nativeEvent as SubmitEvent)}>
          <DateField.Root
            locale="en-US"
            name="at"
            granularity="minute"
            defaultValue={new CalendarDateTime(2026, 10, 20, 9, 30)}
          >
            <DateField.Label>At</DateField.Label>
            <Parts />
          </DateField.Root>
          <button type="submit">Send</button>
        </form>
      </RindProvider>,
    )
    const hidden = document.querySelector<HTMLInputElement>('input[name="at"]') as HTMLInputElement
    expect(hidden.type).toBe("datetime-local")
    expect(hidden.step).toBe("60")
    await userEvent.setup().click(screen.getByRole("button", { name: "Send" }))
    expect(submitted).toHaveReturnedWith("2026-10-20T09:30")
  })

  it("required and empty: submission is cancelled, focus on the first segment", async () => {
    const onSubmit = vi.fn((e: { preventDefault(): void }) => e.preventDefault())
    render(
      <RindProvider environment={{ dateClock: clock }}>
        <form onSubmit={onSubmit}>
          <DateField.Root locale="en-US" name="d" required>
            <DateField.Label>Birthday</DateField.Label>
            <Parts />
          </DateField.Root>
          <button type="submit">Send</button>
        </form>
      </RindProvider>,
    )
    await userEvent.setup().click(screen.getByRole("button", { name: "Send" }))
    expect(onSubmit).not.toHaveBeenCalled()
    await waitFor(() =>
      expect(document.activeElement).toBe(
        screen.getByRole("spinbutton", { name: "month Birthday" }),
      ),
    )
  })

  it("an unavailable typed date makes the calendar invalid", async () => {
    render(<Birthday isDateUnavailable={(v: DateValue) => isWeekend(v, "en-US")} />)
    const user = userEvent.setup()
    await user.click(screen.getByRole("spinbutton", { name: "month Birthday" }))
    await user.keyboard("10182026")
    await user.click(trigger())
    const content = await screen.findByRole("dialog", { name: "Choose date Birthday" })
    expect(
      content
        .querySelector('[data-scope="calendar"][data-part="root"]')
        ?.hasAttribute("data-invalid"),
    ).toBe(true)
  })

  it("touch: tapping the trigger with a focused segment moves focus into the calendar", async () => {
    render(<Birthday />)
    const user = userEvent.setup()
    const month = screen.getByRole("spinbutton", { name: "month Birthday" })
    month.focus()
    await tap(user, trigger())
    const content = await screen.findByRole("dialog", { name: "Choose date Birthday" })
    await waitFor(() => expect(content.contains(document.activeElement)).toBe(true))
    expect(document.activeElement).not.toBe(month)
  })

  it("touch inside a Drawer: a tapped date is picked, the Drawer stays open", async () => {
    const { Drawer } = await import("@rind-ui/react")
    render(
      <RindProvider environment={{ dateClock: clock }}>
        <Drawer.Root defaultOpen>
          <Drawer.Portal>
            <Drawer.Positioner>
              <Drawer.Content>
                <Drawer.Title>Edit</Drawer.Title>
                <DateField.Root locale="en-US">
                  <DateField.Label>Birthday</DateField.Label>
                  <Parts />
                </DateField.Root>
              </Drawer.Content>
            </Drawer.Positioner>
          </Drawer.Portal>
        </Drawer.Root>
      </RindProvider>,
    )
    const user = userEvent.setup()
    await tap(user, trigger())
    await screen.findByRole("dialog", { name: "Choose date Birthday" })
    await tap(user, pressCell(20))
    await waitFor(() => expect(pickerDialog()).toBeNull())
    expect(screen.getByRole("dialog", { name: "Edit" })).toBeTruthy()
    expect(
      screen.getByRole("spinbutton", { name: "day Birthday" }).getAttribute("aria-valuenow"),
    ).toBe("20")
  })

  it("touch: a scroll that starts outside, then a tap inside, picks the date", async () => {
    render(<Birthday />)
    const user = userEvent.setup()
    await user.click(trigger())
    await screen.findByRole("dialog", { name: "Choose date Birthday" })
    const after = screen.getByRole("button", { name: "After" })
    // A scroll: the browser takes the gesture over (pointercancel) and fires no click.
    const init = {
      bubbles: true,
      cancelable: true,
      pointerId: 7,
      pointerType: "touch",
      isPrimary: true,
    }
    after.dispatchEvent(new PointerEvent("pointerdown", { ...init, clientX: 5, clientY: 300 }))
    after.dispatchEvent(new PointerEvent("pointermove", { ...init, clientX: 5, clientY: 100 }))
    after.dispatchEvent(new PointerEvent("pointercancel", init))
    // A scroll gesture is not an outside press: the popover is still open.
    expect(pickerDialog()).not.toBeNull()
    await tap(user, pressCell(21))
    await waitFor(() => expect(pickerDialog()).toBeNull())
    expect(
      screen.getByRole("spinbutton", { name: "day Birthday" }).getAttribute("aria-valuenow"),
    ).toBe("21")
  })

  it("the positioner and content are re-scoped to date-field with the trigger's instance", async () => {
    render(<Birthday />)
    await userEvent.setup().click(trigger())
    const content = await screen.findByRole("dialog", { name: "Choose date Birthday" })
    const instance = trigger().getAttribute("data-instance")
    expect(content.getAttribute("data-scope")).toBe("date-field")
    expect(content.getAttribute("data-instance")).toBe(instance)
    const positioner = content.closest('[data-part="positioner"]')
    expect(positioner?.getAttribute("data-scope")).toBe("date-field")
    expect(positioner?.getAttribute("data-instance")).toBe(instance)
  })
})

describe("Date Field picker nested in a Dialog: one gesture closes one layer", () => {
  function Nested({
    onDialog,
    onPicker,
  }: {
    readonly onDialog?: (o: boolean, d: unknown) => void
    readonly onPicker?: (o: boolean, d: unknown) => void
  }) {
    return (
      <RindProvider environment={{ dateClock: clock }}>
        <Dialog.Root
          defaultOpen
          initialFocus="title"
          {...(onDialog ? { onOpenChange: onDialog } : {})}
        >
          <Dialog.Portal>
            <Dialog.Content>
              <Dialog.Title>Edit</Dialog.Title>
              <DateField.Root locale="en-US" {...(onPicker ? { onOpenChange: onPicker } : {})}>
                <DateField.Label>Birthday</DateField.Label>
                <Parts />
              </DateField.Root>
              <Dialog.CloseTrigger>Close</Dialog.CloseTrigger>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
      </RindProvider>
    )
  }

  it("Escape from a segment closes the picker only", async () => {
    render(<Nested />)
    const user = userEvent.setup()
    await user.click(trigger())
    await screen.findByRole("dialog", { name: "Choose date Birthday" })
    screen.getByRole("spinbutton", { name: "month Birthday" }).focus()
    await user.keyboard("{Escape}")
    await waitFor(() => expect(pickerDialog()).toBeNull())
    expect(screen.getByRole("dialog", { name: "Edit" })).toBeTruthy()
  })

  it("a press outside both closes the picker only", async () => {
    const onDialog = vi.fn()
    const onPicker = vi.fn()
    render(<Nested onDialog={onDialog} onPicker={onPicker} />)
    const user = userEvent.setup()
    await user.click(trigger())
    await screen.findByRole("dialog", { name: "Choose date Birthday" })
    await user.click(screen.getByRole("spinbutton", { name: "month Birthday" }))
    // A press on the field is inside the picker (spec "Picker — Dismissal And Nesting").
    expect(onPicker.mock.calls.map((c) => (c[1] as { reason: string }).reason)).toEqual(["trigger"])
    expect(pickerDialog()).not.toBeNull()
    await user.click(document.body)
    expect(onDialog).not.toHaveBeenCalled()
    await waitFor(() => expect(pickerDialog()).toBeNull())
    expect(screen.getByRole("dialog", { name: "Edit" })).toBeTruthy()
  })
})
