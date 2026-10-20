// Table of Contents through its driver (spec table-of-contents): the landmark, one current
// section by the reading line, the end of the scroll range (Starlight #1954), visible is not
// current, a followed link held through its jump (tocbot #376), focus to the heading, hidden
// sections skipped, the list following the current item without moving the page. Layout
// needs a browser.
import type { TableOfContentsItem } from "@rind-ui/core"
import { RindProvider, TableOfContents, type TableOfContentsRootProps } from "@rind-ui/react"
import { act, render, screen } from "@testing-library/react"
import { userEvent } from "@testing-library/user-event"
import { useRef } from "react"
import { afterEach, describe, expect, it } from "vitest"
import { getTableOfContents, virtualClock } from "../index"

const browser = !navigator.userAgent.includes("jsdom")

const SECTIONS = [
  { id: "intro", label: "Intro", height: 400 },
  { id: "install", label: "Install", height: 400 },
  { id: "usage", label: "Usage", height: 400 },
  { id: "api", label: "API", height: 60 },
  { id: "faq", label: "FAQ", height: 60 },
]
const ITEMS: TableOfContentsItem[] = SECTIONS.map((s) => ({ id: s.id, label: s.label, depth: 0 }))

function Article({
  hiddenSections = [],
  ...props
}: Partial<TableOfContentsRootProps> & { readonly hiddenSections?: readonly string[] }) {
  const scroller = useRef<HTMLDivElement | null>(null)
  return (
    <>
      <TableOfContents.Root items={ITEMS} scrollRoot={scroller} {...props}>
        <TableOfContents.List style={{ maxBlockSize: 40, overflow: "auto", margin: 0 }}>
          {ITEMS.map((item) => (
            <TableOfContents.Item key={item.id} item={item} style={{ blockSize: 20 }}>
              <TableOfContents.Link />
            </TableOfContents.Item>
          ))}
          <TableOfContents.Indicator />
        </TableOfContents.List>
      </TableOfContents.Root>
      <div ref={scroller} data-testid="scroller" style={{ blockSize: 300, overflow: "auto" }}>
        {SECTIONS.map((s) => (
          <section
            key={s.id}
            style={{
              blockSize: s.height,
              display: hiddenSections.includes(s.id) ? "none" : "block",
            }}
          >
            <h2 id={s.id} style={{ margin: 0 }}>
              {s.label}
            </h2>
          </section>
        ))}
      </div>
    </>
  )
}

const frames = (n = 2) =>
  act(async () => {
    for (let i = 0; i < n; i++) await new Promise<void>((r) => requestAnimationFrame(() => r()))
  })

function setup(
  props: Partial<TableOfContentsRootProps> & { readonly hiddenSections?: readonly string[] } = {},
) {
  const clock = virtualClock()
  render(
    <RindProvider environment={{ scheduler: clock.scheduler }}>
      <Article {...props} />
    </RindProvider>,
  )
  const scroller = screen.getByTestId("scroller")
  const scrollTo = async (top: number) => {
    scroller.scrollTop = top
    await frames()
  }
  return { d: getTableOfContents(screen, { name: "On this page" }), clock, scroller, scrollTo }
}

afterEach(() => {
  history.replaceState(null, "", location.pathname + location.search)
})

describe.runIf(browser)("table of contents", () => {
  it("a named navigation landmark of anchor links; the first section is current at the top", async () => {
    const { d } = setup()
    await frames()
    const nav = screen.getByRole("navigation", { name: "On this page" })
    expect(nav.tagName).toBe("NAV")
    expect(screen.getByRole("link", { name: "Install" }).getAttribute("href")).toBe("#install")
    expect(await d.current()).toBe("Intro")
  })

  it("the current section is the last heading above the reading line", async () => {
    const { d, scrollTo } = setup()
    // The line sits 100 px down (1/3 of 300): Install's heading at 400 - 350 = 50 is above it.
    await scrollTo(350)
    expect(await d.current()).toBe("Install")
    await scrollTo(760)
    expect(await d.current()).toBe("Usage")
  })

  it("at the end of the scroll range the last section is current (Starlight #1954)", async () => {
    const { d, scroller, scrollTo } = setup()
    await scrollTo(scroller.scrollHeight)
    expect(await d.current()).toBe("FAQ")
  })

  it("visible sections are marked; only one is current", async () => {
    const { d, scrollTo } = setup()
    await scrollTo(250)
    expect(await d.visible()).toEqual(["Intro", "Install"])
    expect(await d.current()).toBe("Intro")
    expect(screen.getAllByRole("link").filter((l) => l.hasAttribute("aria-current"))).toHaveLength(
      1,
    )
  })

  it("an offset moves the reading line below a sticky header", async () => {
    const { d, scrollTo } = setup({ offset: 200 })
    // Line at 200 + (300 - 200) / 3 ≈ 233: Install's heading at 400 - 200 = 200 is above it
    // (without the offset the line is at 100 and Intro is current).
    await scrollTo(200)
    expect(await d.current()).toBe("Install")
  })

  it("a followed link is current at once and stays through the jump (tocbot #376)", async () => {
    const { d, clock, scroller } = setup()
    await frames()
    const seen = new Set<string>()
    const watch = new MutationObserver(() => {
      const link = document.querySelector('[aria-current="location"]')
      if (link?.textContent) seen.add(link.textContent)
    })
    watch.observe(document.body, { subtree: true, attributeFilter: ["aria-current"] })
    await d.follow("FAQ")
    expect(await d.current()).toBe("FAQ")
    expect(scroller.scrollTop).toBeGreaterThan(0)
    await frames()
    await act(async () => clock.advance(200))
    await frames()
    watch.disconnect()
    expect(await d.current()).toBe("FAQ")
    expect([...seen]).toEqual(["FAQ"])
    expect(location.hash).toBe("#faq")
  })

  it("keyboard: focus moves to the heading", async () => {
    const user = userEvent.setup()
    const { d } = setup()
    await frames()
    screen.getByRole("link", { name: "Usage" }).focus()
    await user.keyboard("{Enter}")
    await frames()
    expect(await d.focusedHeading()).toBe("Usage")
    expect(document.getElementById("usage")?.getAttribute("tabindex")).toBe("-1")
  })

  it("pointer: focus stays on the link", async () => {
    const { d } = setup()
    await frames()
    await d.follow("Usage")
    await frames()
    expect(await d.focusedHeading()).toBe("")
  })

  it("sections that are not rendered are skipped", async () => {
    const { d, scrollTo } = setup({ hiddenSections: ["install"] })
    await scrollTo(420)
    expect(await d.current()).toBe("Usage")
    expect(await d.visible()).not.toContain("Install")
  })

  it("the list keeps the current item in view without moving the page", async () => {
    const { scroller, scrollTo } = setup()
    const pageTop = window.scrollY
    await scrollTo(scroller.scrollHeight)
    const list = screen.getByRole("list")
    expect(list.scrollTop).toBeGreaterThan(0)
    expect(window.scrollY).toBe(pageTop)
    const indicator = document.querySelector<HTMLElement>('[data-part="indicator"]')
    // The fifth 20 px item (Firefox lays the list out with sub-pixel offsets).
    const top = Number.parseFloat(
      indicator?.style.getPropertyValue("--rind-toc-indicator-top") ?? "",
    )
    expect(Math.abs(top - 80)).toBeLessThan(3)
  })

  it("controlled value", async () => {
    const changes: string[] = []
    const { d, scrollTo } = setup({ value: "intro", onValueChange: (v) => changes.push(v) })
    await scrollTo(350)
    expect(changes.at(-1)).toBe("install")
    expect(await d.current()).toBe("Intro")
  })
})
