// Browser only (real layout): the scroll container's tab stop, the scroll-metric attributes and
// CSS variables, and axe's scrollable-region-focusable (spec "Scroll Container", "Scroll Metrics").
import { RindProvider, Table } from "@rind-ui/react"
import { render, screen } from "@testing-library/react"
import axe from "axe-core"
import { useState } from "react"
import { describe, expect, it } from "vitest"
import { userEvent } from "vitest/browser"

const COLS = ["Plan", "Seats", "Storage", "Support", "SSO", "Audit log", "API", "Price"]

function Wide({
  width = 240,
  sortable = false,
  rows = 12,
  height = 160,
  dir,
}: {
  readonly height?: number | undefined
  readonly width?: number
  readonly sortable?: boolean
  readonly rows?: number
  readonly dir?: "rtl"
}) {
  return (
    <RindProvider>
      <button type="button">Before</button>
      <Table.Root
        dir={dir}
        style={{ inlineSize: width, blockSize: height, overflow: "auto" }}
        data-testid="root"
      >
        <Table.Table style={{ borderSpacing: 0 }}>
          <Table.Caption>Comparison</Table.Caption>
          <Table.Head>
            <Table.Row>
              {COLS.map((c) =>
                sortable ? (
                  <Table.ColumnHeader key={c} sortable id={c}>
                    <Table.SortTrigger>{c}</Table.SortTrigger>
                  </Table.ColumnHeader>
                ) : (
                  <Table.ColumnHeader key={c} style={{ minInlineSize: 120, whiteSpace: "nowrap" }}>
                    {c}
                  </Table.ColumnHeader>
                ),
              )}
            </Table.Row>
          </Table.Head>
          <Table.Body>
            {Array.from({ length: rows }, (_, r) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: fixed rows
              <Table.Row key={r}>
                {COLS.map((c) => (
                  <Table.Cell key={c} style={{ whiteSpace: "nowrap", paddingInline: 24 }}>
                    {c} {r}
                  </Table.Cell>
                ))}
              </Table.Row>
            ))}
          </Table.Body>
        </Table.Table>
      </Table.Root>
    </RindProvider>
  )
}

const root = () => screen.getByTestId("root")
const frames = async () => {
  for (let i = 0; i < 4; i++) await new Promise<void>((r) => requestAnimationFrame(() => r()))
}

describe("Table scroll container", () => {
  it("a wide table without controls: Tab reaches the Root, a group named by the caption", async () => {
    render(<Wide />)
    await expect.poll(() => root().getAttribute("tabindex")).toBe("0")
    expect(root().getAttribute("role")).toBe("group")
    expect(root().hasAttribute("data-overflow-x")).toBe(true)
    screen.getByRole("button", { name: "Before" }).focus()
    await userEvent.tab()
    expect(document.activeElement).toBe(root())
    await expect.poll(() => root().hasAttribute("data-focus-visible")).toBe(true)
    // PageDown: headless WebKit under Playwright does not scroll a focused element on arrows.
    await userEvent.keyboard("{PageDown}")
    await expect.poll(() => root().scrollTop).toBeGreaterThan(0)
    const { violations } = await axe.run(root(), { runOnly: ["scrollable-region-focusable"] })
    expect(violations).toEqual([])
  })

  it("with sort buttons the Root is no stop: Tab goes to the first button", async () => {
    render(<Wide sortable />)
    await frames()
    await expect.poll(() => root().hasAttribute("data-overflow-x")).toBe(true)
    expect(root().getAttribute("tabindex")).toBe("-1")
    screen.getByRole("button", { name: "Before" }).focus()
    await userEvent.tab()
    // WebKit's default Tab skips buttons (Safari: "Press Tab to highlight each item" off): there
    // the check is that Tab never stops on the Root.
    const webkit = /AppleWebKit/.test(navigator.userAgent) && !/Chrome/.test(navigator.userAgent)
    if (webkit) expect(document.activeElement).not.toBe(root())
    else expect(document.activeElement).toBe(screen.getByRole("button", { name: "Plan" }))
  })

  it("a table that fits: no stop, no role", async () => {
    render(<Wide width={4000} rows={3} height={undefined} />)
    await frames()
    expect(root().hasAttribute("tabindex")).toBe(false)
    expect(root().hasAttribute("role")).toBe(false)
    expect(root().hasAttribute("data-overflow-x")).toBe(false)
  })

  it("overflow ends while focused: the stop stays until blur (mui/base-ui#4205)", async () => {
    function Growing() {
      const [w, setW] = useState(240)
      return (
        <>
          <Wide width={w} rows={3} height={undefined} />
          <button type="button" onClick={() => setW(4000)}>
            Grow
          </button>
        </>
      )
    }
    render(<Growing />)
    await expect.poll(() => root().getAttribute("tabindex")).toBe("0")
    root().focus()
    // Grow without moving focus: a programmatic click.
    screen.getByRole("button", { name: "Grow" }).click()
    await expect.poll(() => root().hasAttribute("data-overflow-x")).toBe(false)
    expect(root().getAttribute("tabindex")).toBe("0")
    expect(document.activeElement).toBe(root())
    root().blur()
    await expect.poll(() => root().hasAttribute("tabindex")).toBe(false)
    expect(root().hasAttribute("role")).toBe(false)
  })

  it("scroll shadows follow the position; the head height and first column width are set", async () => {
    render(<Wide />)
    await expect.poll(() => root().hasAttribute("data-overflow-x-end")).toBe(true)
    expect(root().hasAttribute("data-overflow-x-start")).toBe(false)
    root().scrollLeft = (root().scrollWidth - root().clientWidth) / 2
    await expect.poll(() => root().hasAttribute("data-overflow-x-start")).toBe(true)
    expect(root().hasAttribute("data-overflow-x-end")).toBe(true)
    root().scrollLeft = root().scrollWidth
    await expect.poll(() => root().hasAttribute("data-overflow-x-end")).toBe(false)
    const head = root().querySelector("thead") as HTMLElement
    expect(root().style.getPropertyValue("--rind-table-head-height")).toBe(`${head.offsetHeight}px`)
    expect(root().style.getPropertyValue("--rind-table-first-column-width")).not.toBe("")
  })

  it("right to left: the logical start is the right side", async () => {
    render(<Wide dir="rtl" />)
    await expect.poll(() => root().hasAttribute("data-overflow-x-end")).toBe(true)
    expect(root().hasAttribute("data-overflow-x-start")).toBe(false)
  })
})

// table-columns-and-toolbar "Pinned Columns": measured offsets, both edges, right to left.
function Pinned({ dir }: { readonly dir?: "rtl" }) {
  const cols = ["select", "name", "a", "b", "c", "d", "e", "actions"]
  return (
    <RindProvider>
      <Table.Root
        dir={dir}
        pinnedColumns={{ start: ["select", "name"], end: ["actions"] }}
        style={{ inlineSize: 320, overflow: "auto" }}
        data-testid="pinned"
      >
        <Table.Table style={{ borderSpacing: 0 }}>
          <Table.Caption>Pinned</Table.Caption>
          <Table.Head>
            <Table.Row>
              {cols.map((c) => (
                <Table.ColumnHeader
                  key={c}
                  id={c}
                  style={{ minInlineSize: 90, background: "white" }}
                >
                  {c}
                </Table.ColumnHeader>
              ))}
            </Table.Row>
          </Table.Head>
          <Table.Body>
            {[0, 1].map((r) => (
              <Table.Row key={r}>
                {cols.map((c) => (
                  <Table.Cell
                    key={c}
                    style={{ whiteSpace: "nowrap", paddingInline: 30, background: "white" }}
                  >
                    {c}
                    {r}
                  </Table.Cell>
                ))}
              </Table.Row>
            ))}
          </Table.Body>
        </Table.Table>
      </Table.Root>
    </RindProvider>
  )
}

/** The theme's rule for pinned cells (the component writes the flags and the offsets). */
const PIN_CSS = `
[data-scope="table"] [data-pinned="start"] { position: sticky; inset-inline-start: var(--rind-table-pin-offset, 0); z-index: 1 }
[data-scope="table"] [data-pinned="end"] { position: sticky; inset-inline-end: var(--rind-table-pin-offset, 0); z-index: 1 }`

describe("Table pinned columns", () => {
  for (const dir of [undefined, "rtl"] as const) {
    it(`pinned cells stay at their edges while scrolled (${dir ?? "ltr"})`, async () => {
      const style = document.createElement("style")
      style.textContent = PIN_CSS
      document.head.append(style)
      try {
        render(<Pinned {...(dir ? { dir } : {})} />)
        const r = screen.getByTestId("pinned")
        await expect.poll(() => r.querySelectorAll('tbody [data-pinned="start"]').length).toBe(4)
        const cell = (row: number, col: number) =>
          r.querySelectorAll("tbody tr")[row]?.children[col] as HTMLElement
        expect(cell(0, 7).getAttribute("data-pinned")).toBe("end")
        expect(cell(0, 1).hasAttribute("data-pinned-edge")).toBe(true)
        // The second start column is offset by the first one's width.
        const firstWidth = (r.querySelector("thead th") as HTMLElement).offsetWidth
        expect(cell(1, 1).style.getPropertyValue("--rind-table-pin-offset")).toBe(`${firstWidth}px`)
        r.scrollLeft = dir === "rtl" ? -(r.scrollWidth / 2) : r.scrollWidth / 2
        await new Promise<void>((done) => requestAnimationFrame(() => done()))
        const box = r.getBoundingClientRect()
        const start = cell(1, 0).getBoundingClientRect()
        const end = cell(1, 7).getBoundingClientRect()
        if (dir === "rtl") {
          expect(Math.abs(start.right - box.right)).toBeLessThan(3)
          expect(Math.abs(end.left - box.left)).toBeLessThan(3)
        } else {
          expect(Math.abs(start.left - box.left)).toBeLessThan(3)
          expect(Math.abs(end.right - (box.left + r.clientWidth))).toBeLessThan(3)
        }
        expect(r.style.getPropertyValue("--rind-table-pinned-start-width")).not.toBe("0px")
      } finally {
        style.remove()
      }
    })
  }
})
