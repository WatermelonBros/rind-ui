// SegmentedControl.Indicator measurement against real layout (openspec add-segmented-control).
import { SegmentedControl } from "@rind-ui/react"
import { act, render } from "@testing-library/react"
import { useState } from "react"
import { describe, expect, it } from "vitest"
import { userEvent } from "vitest/browser"

const VARS = ["left", "right", "top", "bottom", "width", "height"] as const
const read = (ind: Element) => {
  const cs = getComputedStyle(ind)
  return Object.fromEntries(
    VARS.map((v) => [v, Number.parseFloat(cs.getPropertyValue(`--rind-indicator-${v}`))]),
  ) as Record<(typeof VARS)[number], number>
}
const indicator = () => document.querySelector<HTMLElement>('[data-part="indicator"]')
const seg = (name: string) =>
  document.querySelector<HTMLElement>(`[data-part="item"][data-key="${name}"]`)
const rootStyle = { position: "relative", display: "flex" } as const
const itemStyle = { padding: 0, border: 0, font: "16px monospace", flex: "none" } as const
const LABELS = { day: "Day", week: "Week", month: "Month" }

function Fixture({
  value,
  defaultValue = "week",
  root = {},
  dir,
}: {
  value?: string | null
  defaultValue?: string
  root?: object
  dir?: "rtl" | "ltr"
}) {
  return (
    <SegmentedControl.Root
      aria-label="range"
      {...(dir ? { dir } : {})}
      {...(value !== undefined ? { value } : { defaultValue })}
      style={{ ...rootStyle, ...root }}
    >
      {Object.entries(LABELS).map(([k, l]) => (
        <SegmentedControl.Item key={k} value={k} style={itemStyle}>
          {l}
        </SegmentedControl.Item>
      ))}
      <SegmentedControl.Indicator style={{ position: "absolute" }} />
    </SegmentedControl.Root>
  )
}

/** Wait until the indicator is visible and equals the box of segment `key` in its root. */
async function expectFollows(key: string, tol = 0.5) {
  await expect
    .poll(() => {
      const ind = indicator()
      const s = seg(key)
      if (!ind || !s || ind.hidden) return null
      const lr = ind.parentElement?.getBoundingClientRect()
      const sr = s.getBoundingClientRect()
      const v = read(ind)
      if (!lr) return null
      return (
        Math.abs(v.left - (sr.left - lr.left)) <= tol &&
        Math.abs(v.top - (sr.top - lr.top)) <= tol &&
        Math.abs(v.width - sr.width) <= tol &&
        Math.abs(v.height - sr.height) <= tol
      )
    })
    .toBe(true)
}

describe("SegmentedControl.Indicator in a real browser", () => {
  it("carries data-resizing on the first measurement, not on the first change (ark#1129)", async () => {
    render(<Fixture />)
    await expect.poll(() => indicator()?.hidden).toBe(false)
    expect(indicator()?.hasAttribute("data-resizing")).toBe(true)
    await act(async () => userEvent.click(seg("month") as HTMLElement))
    await expectFollows("month")
    expect(indicator()?.hasAttribute("data-resizing")).toBe(false)
  })

  it("is visible under the default segment after a conditional mount (ark#3435, ark#3703)", async () => {
    function Late() {
      const [on, setOn] = useState(false)
      return (
        <>
          <button type="button" onClick={() => setOn(true)}>
            show
          </button>
          {on ? <Fixture defaultValue="week" /> : null}
        </>
      )
    }
    render(<Late />)
    await userEvent.click(document.querySelector("button:not([role])") as HTMLElement)
    await expectFollows("week")
  })

  it("equals the segment's box inside a horizontally scrolled container (zag#2810)", async () => {
    render(
      <div data-testid="scroller" style={{ width: 150, overflow: "auto" }}>
        <Fixture root={{ width: 400 }} />
      </div>,
    )
    const scroller = document.querySelector<HTMLElement>('[data-testid="scroller"]') as HTMLElement
    await expectFollows("week")
    scroller.scrollLeft = 30
    // Keyboard, not a pointer click: Playwright's hit test mis-targets inside the scroller.
    ;(seg("week") as HTMLElement).focus()
    await act(async () => userEvent.keyboard("{ArrowRight}"))
    await expect.poll(() => seg("month")?.getAttribute("aria-checked")).toBe("true")
    await expectFollows("month")
    const v = read(indicator() as HTMLElement)
    const s = seg("month") as HTMLElement
    expect(v.left).toBeCloseTo(s.offsetLeft, 1)
    expect(v.width).toBeCloseTo(s.offsetWidth, 0)
  })

  it("carries data-resizing while a container resize moves it", async () => {
    render(
      <div data-testid="box" style={{ width: 600 }}>
        <Fixture root={{ width: "100%", justifyContent: "flex-end" }} />
      </div>,
    )
    await expectFollows("week")
    const box = document.querySelector<HTMLElement>('[data-testid="box"]') as HTMLElement
    const before = read(indicator() as HTMLElement).left
    box.style.width = "450px"
    await expect.poll(() => read(indicator() as HTMLElement).left).toBeLessThan(before - 50)
    expect(indicator()?.hasAttribute("data-resizing")).toBe(true)
    await expectFollows("week")
  })

  it("is hidden when nothing is selected", async () => {
    render(<Fixture value={null} />)
    const ind = indicator() as HTMLElement
    expect(ind.hidden).toBe(true)
    expect(ind.getAttribute("data-state")).toBe("hidden")
    for (let i = 0; i < 6; i++) await new Promise<void>((r) => requestAnimationFrame(() => r()))
    expect(ind.hidden).toBe(true)
    expect(ind.getAttribute("data-state")).toBe("hidden")
  })

  it("uses the segment's offsetLeft and width in RTL", async () => {
    render(<Fixture dir="rtl" />)
    await expectFollows("week")
    const v = read(indicator() as HTMLElement)
    const s = seg("week") as HTMLElement
    expect(v.left).toBeCloseTo(s.offsetLeft, 1)
    expect(v.width).toBeCloseTo(s.offsetWidth, 0)
  })

  it("is not affected by the hidden input siblings", async () => {
    render(<Fixture />)
    await expectFollows("week")
    expect(document.querySelectorAll('[data-part="hidden-input"]').length).toBe(3)
    await act(async () => userEvent.click(seg("day") as HTMLElement))
    await expectFollows("day")
    const v = read(indicator() as HTMLElement)
    expect(v.left).toBeCloseTo(0, 1)
    expect(v.width).toBeCloseTo((seg("day") as HTMLElement).offsetWidth, 0)
  })
})
