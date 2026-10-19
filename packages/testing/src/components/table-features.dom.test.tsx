// Table columns and toolbar (table-columns-and-toolbar): filters in headers, the header's name,
// indicators by state, the Frame's full-page view, the row-count announcement.
import type { Scheduler } from "@rind-ui/core"
import { RindProvider, Table } from "@rind-ui/react"
import { act, render, screen, waitFor } from "@testing-library/react"
import { userEvent } from "@testing-library/user-event"
import { type ReactNode, useState } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { getTable, recordingAnnouncer } from "../index"

afterEach(() => vi.restoreAllMocks())

function setup(node: ReactNode, scheduler?: Scheduler) {
  const rec = recordingAnnouncer()
  render(
    <RindProvider announcer={rec.announcer} environment={scheduler ? { scheduler } : {}}>
      {node}
      <button type="button">After</button>
    </RindProvider>,
  )
  return { log: rec.log }
}

function People({
  active = false,
  rows = 2,
  sortIcons = false,
}: {
  readonly active?: boolean
  readonly rows?: number
  readonly sortIcons?: boolean
}) {
  return (
    <Table.Frame>
      <Table.Header>
        <input aria-label="Search people" />
        <Table.ExpandTrigger />
      </Table.Header>
      <Table.Root>
        <Table.Table>
          <Table.Caption>People</Table.Caption>
          <Table.Head>
            <Table.Row>
              <Table.ColumnHeader sortable id="name">
                <Table.SortTrigger>
                  Name
                  {sortIcons ? (
                    <Table.SortIndicator ascending="up" descending="down" none="both" />
                  ) : (
                    <Table.SortIndicator />
                  )}
                </Table.SortTrigger>
                <Table.Filter active={active}>
                  <Table.FilterTrigger>
                    <Table.FilterIndicator />
                  </Table.FilterTrigger>
                  <Table.FilterContent>
                    <label>
                      <input type="checkbox" /> Only admins
                    </label>
                  </Table.FilterContent>
                </Table.Filter>
              </Table.ColumnHeader>
              <Table.ColumnHeader id="role">Role</Table.ColumnHeader>
            </Table.Row>
          </Table.Head>
          <Table.Body>
            {rows === 0 ? (
              <Table.Empty colSpan={2}>No people</Table.Empty>
            ) : (
              Array.from({ length: rows }, (_, i) => `Person ${i}`).map((name, i) => (
                <Table.Row key={name}>
                  <Table.RowHeader>Person {i}</Table.RowHeader>
                  <Table.Cell>Admin</Table.Cell>
                </Table.Row>
              ))
            )}
          </Table.Body>
        </Table.Table>
      </Table.Root>
      <Table.Footer>footer</Table.Footer>
    </Table.Frame>
  )
}

describe("table filters", () => {
  it("the header stays named by its text; the filter button is Filter Name (MUI-X#19239)", async () => {
    setup(<People />)
    await waitFor(() => expect(screen.getByRole("columnheader", { name: "Name" })).toBeTruthy())
    const trigger = screen.getByRole("button", { name: "Filter Name" })
    expect(trigger.getAttribute("aria-haspopup")).toBe("dialog")
    expect(trigger.getAttribute("aria-expanded")).toBe("false")
  })

  it("open, interact, Escape: closed, focus back, active is described", async () => {
    const { rerender } = render(
      <RindProvider>
        <People />
      </RindProvider>,
    )
    const user = userEvent.setup()
    await user.click(screen.getByRole("button", { name: "Filter Name" }))
    const dialog = await screen.findByRole("dialog", { name: "Filter Name" })
    // Until its first placement the popup takes no pointer input.
    await waitFor(() => expect(dialog.hasAttribute("data-placing")).toBe(false))
    await user.click(screen.getByRole("checkbox", { name: "Only admins" }))
    expect(dialog.contains(document.activeElement)).toBe(true)
    await user.keyboard("{Escape}")
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Filter Name" })).toBeNull())
    const trigger = screen.getByRole("button", { name: "Filter Name" })
    expect(document.activeElement).toBe(trigger)
    rerender(
      <RindProvider>
        <People active />
      </RindProvider>,
    )
    expect(trigger.hasAttribute("data-active")).toBe(true)
    const id = trigger.getAttribute("aria-describedby") ?? ""
    expect(document.getElementById(id)?.textContent).toBe("Filtered")
    expect(await getTable(screen, { name: "People" }).isFilterActive("Name")).toBe(true)
  })

  it("reachable by Tab with no rows (react-spectrum#10121)", async () => {
    setup(<People rows={0} active />)
    const user = userEvent.setup()
    screen.getByRole("textbox", { name: "Search people" }).focus()
    await user.tab()
    await user.tab()
    await user.tab()
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Filter Name" }))
  })
})

describe("table indicators by state", () => {
  it("SortIndicator renders the node for the direction", async () => {
    setup(<People sortIcons />)
    const indicator = () => document.querySelector('[data-part="sort-indicator"]')?.textContent
    expect(indicator()).toBe("both")
    const d = getTable(screen, { name: "People" })
    await d.sortBy("Name")
    expect(indicator()).toBe("up")
    await d.sortBy("Name")
    expect(indicator()).toBe("down")
  })

  it("the provider's icons when no node is given", async () => {
    render(
      <RindProvider
        icons={{
          "caret-up-down": () => <i>ud</i>,
          "funnel-simple": () => <i>fs</i>,
          "arrows-out": () => <i>out</i>,
        }}
      >
        <People />
      </RindProvider>,
    )
    expect(document.querySelector('[data-part="sort-indicator"]')?.textContent).toBe("ud")
    expect(document.querySelector('[data-part="filter-indicator"]')?.textContent).toBe("fs")
    expect(screen.getByRole("button", { name: "Full page" }).textContent).toBe("out")
  })
})

describe("table full page", () => {
  it("expands to a named modal dialog; Escape returns it, focus on Full page", async () => {
    setup(<People />)
    const user = userEvent.setup()
    const trigger = screen.getByRole("button", { name: "Full page" })
    expect(trigger.getAttribute("aria-pressed")).toBe("false")
    await user.click(trigger)
    const dialog = await screen.findByRole("dialog", { name: "People" })
    expect(dialog.getAttribute("aria-modal")).toBe("true")
    expect(trigger.getAttribute("aria-pressed")).toBe("true")
    expect(
      screen.getByRole("button", { name: "After", hidden: true }).closest("[inert]"),
    ).not.toBeNull()
    expect(await getTable(screen, { name: "People" }).isExpanded()).toBe(true)
    await user.keyboard("{Escape}")
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "People" })).toBeNull())
    expect(trigger.getAttribute("aria-pressed")).toBe("false")
    expect(document.activeElement).toBe(trigger)
  })

  it("controlled: the parent decides", async () => {
    const onExpandedChange = vi.fn()
    setup(
      <Table.Frame expanded={false} onExpandedChange={onExpandedChange}>
        <Table.Header>
          <Table.ExpandTrigger />
        </Table.Header>
        <Table.Root>
          <Table.Table aria-label="T">
            <Table.Body>
              <Table.Row>
                <Table.Cell>x</Table.Cell>
              </Table.Row>
            </Table.Body>
          </Table.Table>
        </Table.Root>
      </Table.Frame>,
    )
    await userEvent.setup().click(screen.getByRole("button", { name: "Full page" }))
    expect(onExpandedChange).toHaveBeenCalledWith(true, expect.anything())
    expect(screen.queryByRole("dialog")).toBeNull()
  })
})

describe("table row count", () => {
  it("announces the last count once after typing settles; not on mount", async () => {
    vi.useFakeTimers() // fake-time: the quiet period runs on the faked window timers
    try {
      function Searchable() {
        const [count, setCount] = useState(87)
        return (
          <>
            <button type="button" onClick={() => setCount(40)}>
              Forty
            </button>
            <button type="button" onClick={() => setCount(12)}>
              Twelve
            </button>
            <Table.Root rowCount={count}>
              <Table.Table aria-label="Rows">
                <Table.Body>
                  <Table.Row>
                    <Table.Cell>x</Table.Cell>
                  </Table.Row>
                </Table.Body>
              </Table.Table>
            </Table.Root>
          </>
        )
      }
      const { log } = setup(<Searchable />)
      await act(async () => vi.advanceTimersByTime(1000))
      expect(log).toEqual([])
      await act(async () => screen.getByRole("button", { name: "Forty" }).click())
      await act(async () => vi.advanceTimersByTime(200))
      await act(async () => screen.getByRole("button", { name: "Twelve" }).click())
      await act(async () => vi.advanceTimersByTime(399))
      expect(log).toEqual([])
      await act(async () => vi.advanceTimersByTime(1))
      expect(log.map((a) => [a.message, a.priority])).toEqual([["12 rows", "polite"]])
    } finally {
      vi.useRealTimers()
    }
  })
})

describe("table title", () => {
  it("without a Caption the Title names the table and the full-page view", async () => {
    setup(
      <Table.Frame>
        <Table.Header>
          <Table.Title>Components</Table.Title>
          <Table.ExpandTrigger />
        </Table.Header>
        <Table.Root>
          <Table.Table>
            <Table.Body>
              <Table.Row>
                <Table.Cell>x</Table.Cell>
              </Table.Row>
            </Table.Body>
          </Table.Table>
        </Table.Root>
      </Table.Frame>,
    )
    await waitFor(() => expect(screen.getByRole("table", { name: "Components" })).toBeTruthy())
    await userEvent.setup().click(screen.getByRole("button", { name: "Full page" }))
    expect(await screen.findByRole("dialog", { name: "Components" })).toBeTruthy()
  })
})

function Expandable({ multiple }: { readonly multiple?: boolean }) {
  const rows = ["Accordion", "Alert"]
  return (
    <Table.Root {...(multiple === undefined ? {} : { multiple })}>
      <Table.Table>
        <Table.Caption>Expandable</Table.Caption>
        <Table.Head>
          <Table.Row>
            <Table.ColumnHeader>Component</Table.ColumnHeader>
            <Table.ColumnHeader>Details</Table.ColumnHeader>
          </Table.Row>
        </Table.Head>
        <Table.Body>
          {rows.flatMap((name) => [
            <Table.Row key={name} id={name}>
              <Table.RowHeader>{name}</Table.RowHeader>
              <Table.Cell>
                <Table.RowTrigger>▸</Table.RowTrigger>
              </Table.Cell>
            </Table.Row>,
            <Table.RowDetails key={`${name}-details`} rowId={name}>
              <Table.Root>
                <Table.Table>
                  <Table.Caption>{`${name} parts`}</Table.Caption>
                  <Table.Head>
                    <Table.Row>
                      <Table.ColumnHeader sortable id="part">
                        <Table.SortTrigger>Part</Table.SortTrigger>
                      </Table.ColumnHeader>
                    </Table.Row>
                  </Table.Head>
                  <Table.Body>
                    <Table.Row>
                      <Table.Cell>Root</Table.Cell>
                    </Table.Row>
                  </Table.Body>
                </Table.Table>
              </Table.Root>
            </Table.RowDetails>,
          ])}
        </Table.Body>
      </Table.Table>
    </Table.Root>
  )
}

describe("table expandable rows", () => {
  it("open and close; aria-expanded and aria-controls; hidden while closed", async () => {
    setup(<Expandable />)
    const user = userEvent.setup()
    const trigger = await screen.findByRole("button", { name: "Show details Accordion" })
    const details = document.getElementById(trigger.getAttribute("aria-controls") ?? "")
    expect(details?.hasAttribute("hidden")).toBe(true)
    expect(details?.querySelector("td")?.getAttribute("colspan")).toBe("2")
    await user.click(trigger)
    expect(trigger.getAttribute("aria-expanded")).toBe("true")
    expect(details?.hasAttribute("hidden")).toBe(false)
    expect(await getTable(screen, { name: "Expandable" }).expandedRows()).toEqual(["Accordion"])
    await user.click(trigger)
    expect(trigger.getAttribute("aria-expanded")).toBe("false")
    expect(details?.hasAttribute("hidden")).toBe(true)
  })

  it("multiple={false}: one at a time (driver)", async () => {
    setup(<Expandable multiple={false} />)
    const d = getTable(screen, { name: "Expandable" })
    await d.toggleRow("Accordion")
    await d.toggleRow("Alert")
    expect(await d.expandedRows()).toEqual(["Alert"])
  })

  it("a nested table keeps its own name and sort", async () => {
    setup(<Expandable />)
    const d = getTable(screen, { name: "Expandable" })
    await d.toggleRow("Accordion")
    const inner = getTable(screen, { name: "Accordion parts" })
    await inner.sortBy("Part")
    expect(await inner.sort()).toEqual({ column: "Part", direction: "ascending" })
    expect(await d.sort()).toBeNull()
  })
})
