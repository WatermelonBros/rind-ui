// Date Field server markup (task 4.2, date-segments "Server Rendering"): every IDREF resolves
// in the server's HTML and after hydration, a literal that differs between the server's and
// the browser's formatter is corrected without a warning, platform quirks apply after mount.
import { CalendarDate, CalendarDateTime } from "@internationalized/date"
import { platforms } from "@rind-ui/core"
import { DateField, type DateFieldRootProps, RindProvider } from "@rind-ui/react"
import { act } from "@testing-library/react"
import type { ReactNode } from "react"
import { hydrateRoot } from "react-dom/client"
import { renderToString } from "react-dom/server"
import { afterEach, describe, expect, it, vi } from "vitest"
import { fixedDateClock } from "../index"

afterEach(() => vi.restoreAllMocks())

const clock = fixedDateClock("2026-10-17T12:00:00Z", "UTC")
const tree = (props: DateFieldRootProps = {}, platform = platforms.linux) => (
  <RindProvider environment={{ platform, dateClock: clock }}>
    <form>
      <DateField.Root name="d" defaultValue={new CalendarDate(2026, 10, 14)} {...props}>
        <DateField.Label>Birthday</DateField.Label>
        <DateField.Description>As on your passport</DateField.Description>
        <DateField.Input />
      </DateField.Root>
    </form>
  </RindProvider>
)

/** Every id an aria-labelledby / aria-describedby names, and whether it exists. */
function idrefs(root: ParentNode) {
  const out: [string, boolean][] = []
  for (const el of root.querySelectorAll("[aria-labelledby], [aria-describedby]")) {
    for (const attr of ["aria-labelledby", "aria-describedby"]) {
      for (const id of (el.getAttribute(attr) ?? "").split(" ").filter(Boolean)) {
        out.push([id, root.querySelector(`[id="${id}"]`) !== null])
      }
    }
  }
  return out
}

async function hydrate(server: ReactNode, mutate?: (c: HTMLElement) => void) {
  const container = document.createElement("div")
  container.innerHTML = renderToString(server)
  mutate?.(container)
  document.body.append(container)
  const error = vi.spyOn(console, "error").mockImplementation(() => {})
  let root: ReturnType<typeof hydrateRoot> | undefined
  await act(async () => {
    root = hydrateRoot(container, server, { onRecoverableError: (e) => error(String(e)) })
  })
  const calls = [...error.mock.calls]
  return {
    calls,
    container,
    done: async () => {
      await act(async () => root?.unmount())
      container.remove()
    },
  }
}

describe("Date Field server render", () => {
  it("Labelled segments after server rendering (react-spectrum#9675): every IDREF resolves", async () => {
    const box = document.createElement("div")
    box.innerHTML = renderToString(tree())
    const refs = idrefs(box)
    expect(refs.length).toBeGreaterThan(3)
    expect(refs.filter(([, ok]) => !ok)).toEqual([])
    expect([...new FormData(box.querySelector("form") as HTMLFormElement)]).toEqual([
      ["d", "2026-10-14"],
    ])
    const h = await hydrate(tree())
    expect(h.calls).toEqual([])
    expect(idrefs(h.container).filter(([, ok]) => !ok)).toEqual([])
    await h.done()
  })

  it("Engine-specific space before AM/PM (react-spectrum#7169): no warning, the browser's text", async () => {
    const props = {
      granularity: "minute" as const,
      defaultValue: new CalendarDateTime(2026, 10, 14, 9, 30),
    }
    const h = await hydrate(tree(props), (c) => {
      // The server's formatter used another space before the day period.
      const literals = [...c.querySelectorAll('[data-type="literal"]')]
      const last = literals.at(-1)
      if (last) last.textContent = `${last.textContent ?? ""}\u00a0`
    })
    expect(h.calls).toEqual([])
    const shown = [...h.container.querySelectorAll('[data-type="literal"]')].map(
      (l) => l.textContent,
    )
    const fresh = document.createElement("div")
    fresh.innerHTML = renderToString(tree(props))
    expect(shown).toEqual(
      [...fresh.querySelectorAll('[data-type="literal"]')].map((l) => l.textContent),
    )
    await h.done()
  })

  it("iPhone hydration: no mismatch, then segments without the spinbutton role", async () => {
    const h = await hydrate(tree({}, platforms.ios))
    expect(h.calls).toEqual([])
    expect(h.container.querySelectorAll('[role="spinbutton"]')).toHaveLength(0)
    await h.done()
  })
})
