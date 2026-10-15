// Tabs.Indicator measurement against real layout (openspec add-tabs, selection-indicator).
import { Tabs } from "@rind-ui/react"
import { act, render } from "@testing-library/react"
import { type ReactNode, StrictMode, useState } from "react"
import { hydrateRoot } from "react-dom/client"
import { renderToString } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { userEvent } from "vitest/browser"

const VARS = ["left", "right", "top", "bottom", "width", "height"] as const
const read = (ind: Element) => {
  const cs = getComputedStyle(ind)
  return Object.fromEntries(
    VARS.map((v) => [v, Number.parseFloat(cs.getPropertyValue(`--rind-indicator-${v}`))]),
  ) as Record<(typeof VARS)[number], number>
}
const indicator = (c: ParentNode = document) =>
  c.querySelector<HTMLElement>('[data-part="indicator"]')
const tab = (name: string) =>
  document.querySelector<HTMLElement>(`[data-part="tab"][data-key="${name}"]`)
const listStyle = { position: "relative", display: "flex" } as const
const tabStyle = { padding: 0, border: 0, font: "16px monospace", flex: "none" } as const

function Fixture({
  value,
  defaultValue = "b",
  labels = { a: "Alpha", b: "Bravo", c: "Charlie" },
  tabWidth,
  list = {},
}: {
  value?: string | null
  defaultValue?: string
  labels?: Record<string, string>
  tabWidth?: Record<string, number>
  list?: object
}) {
  return (
    <Tabs.Root {...(value !== undefined ? { value } : { defaultValue })}>
      <Tabs.List aria-label="t" style={{ ...listStyle, ...list }}>
        {Object.entries(labels).map(([k, l]) => (
          <Tabs.Tab key={k} value={k} style={{ ...tabStyle, width: tabWidth?.[k] }}>
            {l}
          </Tabs.Tab>
        ))}
        <Tabs.Indicator style={{ position: "absolute" }} />
      </Tabs.List>
      {Object.keys(labels).map((k) => (
        <Tabs.Panel key={k} value={k}>
          {k}
        </Tabs.Panel>
      ))}
    </Tabs.Root>
  )
}

/** Wait until the indicator is visible and equals the box of tab `key` in its list. */
async function expectFollows(key: string, tol = 0.5) {
  await expect
    .poll(() => {
      const ind = indicator()
      const t = tab(key)
      if (!ind || !t || ind.hidden) return null
      const lr = ind.parentElement?.getBoundingClientRect()
      const tr = t.getBoundingClientRect()
      const v = read(ind)
      if (!lr) return null
      return (
        Math.abs(v.left - (tr.left - lr.left)) <= tol &&
        Math.abs(v.top - (tr.top - lr.top)) <= tol &&
        Math.abs(v.width - tr.width) <= tol &&
        Math.abs(v.height - tr.height) <= tol
      )
    })
    .toBe(true)
}

describe("Tabs.Indicator in a real browser", () => {
  it("equals the unscaled offsets inside a scaling container (base-ui#3425)", async () => {
    render(
      <div style={{ transform: "scale(0.9)", transformOrigin: "0 0", width: 400 }}>
        <Fixture />
      </div>,
    )
    await expect.poll(() => indicator()?.hidden).toBe(false)
    const t = tab("b") as HTMLElement
    const v = read(indicator() as HTMLElement)
    expect(v.left).toBeCloseTo(t.offsetLeft, 1)
    expect(v.top).toBeCloseTo(t.offsetTop, 1)
    expect(v.width).toBeCloseTo(t.offsetWidth, 0)
    expect(v.height).toBeCloseTo(t.offsetHeight, 0)
  })

  it("is the same with the page and a scroll container scrolled (react-spectrum#9931)", async () => {
    const view = render(
      <div>
        <div style={{ height: 200 }} />
        <Fixture />
      </div>,
    )
    await expect.poll(() => indicator()?.hidden).toBe(false)
    const before = read(indicator() as HTMLElement)
    view.unmount()
    render(
      <div>
        <div style={{ height: 3000 }} />
        <div style={{ height: 40, width: 150, overflow: "auto" }} data-testid="scroller">
          <Fixture />
        </div>
      </div>,
    )
    const scroller = document.querySelector<HTMLElement>('[data-testid="scroller"]') as HTMLElement
    window.scrollTo(0, 2900)
    scroller.scrollLeft = 30
    await act(async () => userEvent.click(tab("c") as HTMLElement))
    await act(async () => userEvent.click(tab("b") as HTMLElement))
    await expect.poll(() => tab("b")?.getAttribute("aria-selected")).toBe("true")
    await expectFollows("b")
    const after = read(indicator() as HTMLElement)
    expect(after.left).toBeCloseTo(before.left, 1)
    expect(after.width).toBeCloseTo(before.width, 1)
    expect(after.top).toBeCloseTo(before.top, 1)
    window.scrollTo(0, 0)
  })

  it("never rounds a 100.4px width up and the list does not overflow (base-ui#2235)", async () => {
    render(<Fixture tabWidth={{ b: 100.4 }} />)
    await expect.poll(() => indicator()?.hidden).toBe(false)
    const v = read(indicator() as HTMLElement)
    expect(v.width).toBeLessThanOrEqual(100.4)
    expect(v.width).toBeGreaterThan(100)
    const list = indicator()?.parentElement as HTMLElement
    expect(list.scrollWidth).toBeLessThanOrEqual(list.clientWidth)
  })

  it("follows the selected tab when a sibling label grows (base-ui#4156)", async () => {
    function Grow() {
      const [long, setLong] = useState(false)
      return (
        <>
          <button type="button" onClick={() => setLong(true)}>
            grow
          </button>
          <Fixture
            labels={{ a: long ? "Alpha alpha alpha alpha" : "Alpha", b: "Bravo", c: "Charlie" }}
          />
        </>
      )
    }
    render(<Grow />)
    await expectFollows("b")
    const before = read(indicator() as HTMLElement).left
    await userEvent.click(document.querySelector("button:not([role])") as HTMLElement)
    await expect.poll(() => read(indicator() as HTMLElement).left).toBeGreaterThan(before + 20)
    await expectFollows("b")
  })

  it("is visible under the default tab after a conditional mount (ark#3435)", async () => {
    function Late() {
      const [on, setOn] = useState(false)
      return (
        <>
          <button type="button" onClick={() => setOn(true)}>
            show
          </button>
          {on ? <Fixture defaultValue="c" /> : null}
        </>
      )
    }
    render(<Late />)
    await userEvent.click(document.querySelector("button:not([role])") as HTMLElement)
    await expectFollows("c")
  })

  it("carries data-resizing on the first measurement, not on the first change (base-ui#998, ark#1129)", async () => {
    render(<Fixture />)
    await expect.poll(() => indicator()?.hidden).toBe(false)
    // Chosen to catch the first positioning before any observer-driven layout re-measure.
    expect(indicator()?.hasAttribute("data-resizing")).toBe(true)
    await act(async () => userEvent.click(tab("c") as HTMLElement))
    await expectFollows("c")
    expect(indicator()?.hasAttribute("data-resizing")).toBe(false)
  })

  it("carries data-resizing while a container resize moves it (react-spectrum#1462)", async () => {
    render(
      <div data-testid="box" style={{ width: 600 }}>
        <Fixture list={{ width: "100%", justifyContent: "flex-end" }} />
      </div>,
    )
    await expectFollows("b")
    const box = document.querySelector<HTMLElement>('[data-testid="box"]') as HTMLElement
    const before = read(indicator() as HTMLElement).left
    box.style.width = "450px"
    await expect.poll(() => read(indicator() as HTMLElement).left).toBeLessThan(before - 50)
    expect(indicator()?.hasAttribute("data-resizing")).toBe(true)
    await expectFollows("b")
  })

  it("is hidden when nothing is selected", async () => {
    render(<Fixture value={null} />)
    const ind = indicator() as HTMLElement
    expect(ind.hidden).toBe(true)
    expect(ind.getAttribute("data-state")).toBe("hidden")
    await new Promise((r) => setTimeout(r, 100))
    expect(ind.hidden).toBe(true)
    expect(ind.getAttribute("data-state")).toBe("hidden")
  })

  it("hydrates under StrictMode with the box of the selected tab and no stale style", async () => {
    const ui: ReactNode = (
      <StrictMode>
        <Fixture />
      </StrictMode>
    )
    const host = document.body.appendChild(document.createElement("div"))
    host.innerHTML = renderToString(ui)
    const ssr = indicator(host)
    expect(ssr?.hidden).toBe(true)
    expect(ssr?.getAttribute("style") ?? "").not.toContain("--rind-indicator")
    await act(async () => {
      hydrateRoot(host, ui)
    })
    await expectFollows("b")
    const style = indicator(host)?.getAttribute("style") ?? ""
    for (const v of VARS)
      expect(style.match(new RegExp(`--rind-indicator-${v}:`, "g"))).toHaveLength(1)
    host.remove()
  })
})
