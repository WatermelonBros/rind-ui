// Tabs find-in-page (until-found panels) and scrolling, against real layout and input.
import { Tabs } from "@rind-ui/react"
import { act, render } from "@testing-library/react"
import { useState } from "react"
import { describe, expect, it, vi } from "vitest"
import { userEvent } from "vitest/browser"

const tab = (key: string) =>
  document.querySelector<HTMLElement>(`[data-part="tab"][data-key="${key}"]`) as HTMLElement
const panel = (key: string) =>
  document.querySelector<HTMLElement>(`[data-part="panel"][data-key="${key}"]`) as HTMLElement
const raf = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))

type RootProps = Parameters<typeof Tabs.Root>[0]
function Fixture(props: RootProps) {
  return (
    <Tabs.Root {...props}>
      <Tabs.List aria-label="t">
        {["a", "b", "c"].map((k) => (
          <Tabs.Tab key={k} value={k}>
            Tab {k}
          </Tabs.Tab>
        ))}
      </Tabs.List>
      {["a", "b", "c"].map((k) => (
        <Tabs.Panel key={k} value={k}>
          Panel {k}
        </Tabs.Panel>
      ))}
    </Tabs.Root>
  )
}

describe("Tabs find-in-page", () => {
  it("inactive panels are hidden=until-found where supported, plain hidden elsewhere", async () => {
    render(<Fixture defaultValue="a" inactivePanels="until-found" />)
    const b = panel("b")
    await expect
      .poll(() => b.getAttribute("hidden"))
      .toBe("onbeforematch" in b ? "until-found" : "")
    expect(panel("a").hasAttribute("hidden")).toBe(false)
  })

  it("beforematch selects the tab with reason find-in-page and marks data-reveal", async () => {
    const onValueChange = vi.fn()
    render(<Fixture defaultValue="a" inactivePanels="until-found" onValueChange={onValueChange} />)
    await expect.poll(() => panel("b").hasAttribute("hidden")).toBe(true)
    await act(async () => {
      panel("b").dispatchEvent(new Event("beforematch", { bubbles: true }))
    })
    await expect.poll(() => tab("b").getAttribute("aria-selected")).toBe("true")
    expect(onValueChange.mock.calls.at(-1)?.[0]).toBe("b")
    expect(onValueChange.mock.calls.at(-1)?.[1].reason).toBe("find-in-page")
    expect(panel("b").getAttribute("data-reveal")).toBe("find-in-page")
    expect(panel("b").hasAttribute("hidden")).toBe(false)
    expect(panel("a").hasAttribute("hidden")).toBe(true)
  })

  it("a controlled refusal puts until-found back on the next frame", async () => {
    function Controlled() {
      const [value] = useState("a")
      return <Fixture value={value} inactivePanels="until-found" />
    }
    render(<Controlled />)
    const b = panel("b")
    const hidden = b.getAttribute("hidden")
    await act(async () => {
      b.dispatchEvent(new Event("beforematch", { bubbles: true }))
    })
    await raf()
    await expect.poll(() => b.getAttribute("hidden")).toBe(hidden)
    expect(tab("a").getAttribute("aria-selected")).toBe("true")
  })
})

describe("Tabs scrolling", () => {
  const narrow = (
    <div style={{ width: 160 }}>
      <Fixture defaultValue="a" />
    </div>
  )
  const style = (el: HTMLElement) => {
    el.style.overflow = "auto"
    el.style.display = "flex"
    for (const t of el.querySelectorAll<HTMLElement>('[data-part="tab"]')) {
      t.style.flex = "none"
      t.style.width = "100px"
    }
  }
  const setup = () => {
    render(
      <>
        <div style={{ height: 3000 }} />
        {narrow}
      </>,
    )
    const list = document.querySelector<HTMLElement>('[data-part="list"]') as HTMLElement
    style(list)
    return list
  }

  it("does not scroll the page on mount with Tabs below the fold (react-spectrum#4132)", async () => {
    setup()
    await raf()
    expect(window.scrollY).toBe(0)
  })

  it("an arrow move scrolls the newly focused tab into view", async () => {
    const list = setup()
    await act(async () => tab("a").focus())
    expect(list.scrollLeft).toBe(0)
    await userEvent.keyboard("{ArrowRight}{ArrowRight}")
    await expect.poll(() => document.activeElement).toBe(tab("c"))
    await expect.poll(() => list.scrollLeft).toBeGreaterThan(0)
    const l = list.getBoundingClientRect()
    const r = tab("c").getBoundingClientRect()
    expect(r.right).toBeLessThanOrEqual(l.right + 1)
    window.scrollTo(0, 0)
  })

  it("a pointer press on a partly visible edge tab selects it without scrolling the list (ariakit#4132)", async () => {
    const list = setup()
    await raf()
    expect(list.scrollLeft).toBe(0)
    // Tab b spans 100..200 in a 160px list: its first 50px are visible.
    await userEvent.click(tab("b"), { position: { x: 10, y: 5 }, force: true } as never)
    await expect.poll(() => tab("b").getAttribute("aria-selected")).toBe("true")
    await raf()
    expect(list.scrollLeft).toBe(0)
  })
})
