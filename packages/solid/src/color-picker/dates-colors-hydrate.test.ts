// @vitest-environment jsdom
// Node project with a DOM: fixtures/ssr.ts bundles with Node APIs, so not in the browser.
// A Tour, a Calendar, a Date Field and a Color Picker on the server: the HTML is React's, it
// hydrates with no warning, and each is live afterwards.
import { CalendarDate } from "@internationalized/date"
import * as R from "@rind-ui/react"
import { canonicalHtml } from "@rind-ui/testing"
import { createElement as r } from "react"
import { renderToString } from "react-dom/server"
import { afterEach, describe, expect, it, vi } from "vitest"
import { bootstrap, build, withoutHydrationKeys } from "../../fixtures/ssr"

afterEach(() => vi.restoreAllMocks())

const clock = { now: () => Date.parse("2026-10-17T12:00:00Z"), timeZone: () => "UTC" }

describe("Solid Tour, Calendar, Date Field and Color Picker server render and hydration", () => {
  it("server HTML matches React; hydrates with zero warnings; all four are live", async () => {
    const server = await build("dates-colors/hydrate.tsx", "ssr")
    const client = await build("dates-colors/hydrate.tsx", "dom")
    const html = server.renderToString(() => server.createComponent(server.App, {}))
    const react = renderToString(
      r(
        R.RindProvider,
        { environment: { dateClock: clock } },
        r(
          "div",
          null,
          r(
            R.Tour.Root,
            {
              id: "tour",
              steps: [{ id: "welcome", title: "Welcome", description: "A short tour." }],
            },
            r(R.Tour.Trigger, null, "Take the tour"),
            r(
              R.Tour.Portal,
              null,
              r(R.Tour.Backdrop),
              r(
                R.Tour.Positioner,
                null,
                r(
                  R.Tour.Content,
                  null,
                  r(R.Tour.Title),
                  r(R.Tour.Description),
                  r(R.Tour.CloseTrigger, null, "Close"),
                ),
              ),
            ),
          ),
          r(
            R.Calendar.Root,
            { id: "cal", "aria-label": "Departure" },
            r(
              R.Calendar.Header,
              null,
              r(R.Calendar.PrevTrigger),
              r(R.Calendar.Heading),
              r(R.Calendar.NextTrigger),
            ),
            r(R.Calendar.Grid),
          ),
          r(
            R.DateField.Root,
            {
              id: "date",
              locale: "en-US",
              name: "birthday",
              defaultValue: new CalendarDate(2026, 10, 14),
            },
            r(R.DateField.Label, null, "Birthday"),
            r(R.DateField.Input),
          ),
          r(
            R.ColorPicker.Root,
            { id: "fill", defaultValue: "#3D8BFF", name: "fill" },
            r(R.ColorPicker.Label, null, "Background"),
            r(
              R.ColorPicker.Control,
              null,
              r(R.ColorPicker.Trigger, null, r(R.ColorPicker.ValueSwatch)),
              r(R.ColorPicker.ValueText),
            ),
            r(
              R.ColorPicker.Portal,
              null,
              r(
                R.ColorPicker.Positioner,
                null,
                r(R.ColorPicker.Content, null, r(R.ColorPicker.ChannelInput, { channel: "hex" })),
              ),
            ),
          ),
        ),
      ),
    )
    expect(canonicalHtml(withoutHydrationKeys(html))).toBe(canonicalHtml(react))

    bootstrap(server)
    const container = document.body.appendChild(document.createElement("div"))
    container.innerHTML = html
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    const error = vi.spyOn(console, "error").mockImplementation(() => {})
    const dispose = client.hydrate(() => client.createComponent(client.App, {}), container)
    expect([...warn.mock.calls, ...error.mock.calls]).toEqual([])
    // Live: the tour opens, the calendar pages, a date segment steps, the picker opens.
    const tour = [...container.querySelectorAll("button")].find(
      (b) => b.textContent === "Take the tour",
    )
    tour?.click()
    await vi.waitFor(() =>
      expect(document.querySelector("[data-scope='tour'][data-part='content']")).toBeTruthy(),
    )
    const next = container.querySelector<HTMLElement>(
      "[data-scope='calendar'][data-part='next-trigger']",
    )
    const heading = () =>
      container.querySelector("[data-scope='calendar'][data-part='heading']")?.textContent
    const before = heading()
    next?.click()
    await vi.waitFor(() => expect(heading()).not.toBe(before))
    const day = container.querySelector<HTMLInputElement>(
      "input[data-scope='date-field'][data-type='day']",
    )
    day?.focus()
    day?.dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowUp", bubbles: true, cancelable: true }),
    )
    await vi.waitFor(() => expect(day?.getAttribute("aria-valuenow")).toBe("15"))
    const picker = container.querySelector<HTMLElement>(
      "[data-scope='color-picker'][data-part='trigger']",
    )
    picker?.click()
    await vi.waitFor(() =>
      expect(
        document.querySelector("[data-scope='color-picker'][data-part='content']"),
      ).toBeTruthy(),
    )
    dispose()
    container.remove()
  })
})
