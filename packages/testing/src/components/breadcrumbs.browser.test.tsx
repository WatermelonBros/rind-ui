// add-breadcrumbs 5.1, 5.2: browser-only checks. The current item's text is selectable by a
// mouse drag (react-spectrum#5549); a screen reader reads no separator, the list size is the
// visible crumbs, the ellipsis trigger is named, and the current item is no link
// (react-spectrum#3967, #3998).
import { Breadcrumbs, Popover } from "@rind-ui/react"
import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { userEvent } from "vitest/browser"
import { spokenLog } from "../index"

const NAMES = ["Home", "Docs", "Guides", "Forms", "Fields", "Page"]

function Trail({ count = 3, maxItems }: { count?: number; maxItems?: number }) {
  const names = NAMES.slice(0, count - 1).concat("Page")
  return (
    <Breadcrumbs.Root {...(maxItems === undefined ? {} : { maxItems })}>
      <Breadcrumbs.List>
        {names.map((n, i) => (
          <Breadcrumbs.Item key={n} value={n}>
            <Breadcrumbs.Link {...(i < names.length - 1 ? { href: `/${i}` } : {})}>
              {n}
            </Breadcrumbs.Link>
            <Breadcrumbs.Separator>›</Breadcrumbs.Separator>
          </Breadcrumbs.Item>
        ))}
        <Breadcrumbs.Ellipsis>
          {({ label }) => (
            <Popover.Root>
              <Popover.Trigger aria-label={label}>…</Popover.Trigger>
            </Popover.Root>
          )}
        </Breadcrumbs.Ellipsis>
      </Breadcrumbs.List>
    </Breadcrumbs.Root>
  )
}

describe("Breadcrumbs in a real browser", () => {
  it("the current text is selectable by a mouse drag (react-spectrum#5549)", async () => {
    render(<Trail />)
    const page = screen.getByText("Page")
    await userEvent.tripleClick(page)
    expect(window.getSelection()?.toString()).toContain("Page")
    expect(page.style.userSelect).toBe("")
  })

  it("the screen reader reads no separator and no link role on the current item", async () => {
    const { container } = render(<Trail />)
    const log = await spokenLog(container, async (v) => {
      for (let i = 0; i < 12; i++) await v.next()
    })
    const text = log.join(" | ")
    expect(text).not.toContain("›")
    expect(log).toContain("listitem, level 1, position 3, set size 3")
    expect(log).toContain("current page")
    expect(log.some((p) => /link, Page|Page, link/.test(p))).toBe(false)
  })

  it("the ellipsis trigger is named, never '…' (react-spectrum#3967)", async () => {
    render(<Trail count={6} maxItems={4} />)
    expect(screen.getByRole("button", { name: "Show 4 more breadcrumbs" })).toBeTruthy()
  })
})
