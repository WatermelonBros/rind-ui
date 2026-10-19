// Table through its driver (spec table): native structure and roles, scopes and spans, the name,
// sorting by every activation path, controlled sort, announcements, the TalkBack description,
// Empty and loading, server HTML.
import { platforms, type SortDescriptor, sortItems } from "@rind-ui/core"
import { RindProvider, Table, type TableRootProps } from "@rind-ui/react"
import { act, render, screen, waitFor } from "@testing-library/react"
import { userEvent } from "@testing-library/user-event"
import { StrictMode, useState } from "react"
import { hydrateRoot } from "react-dom/client"
import { renderToString } from "react-dom/server"
import { afterEach, describe, expect, it, vi } from "vitest"
import { getTable, recordingAnnouncer } from "../index"

afterEach(() => vi.restoreAllMocks())

const rows = [
  { name: "Banana", price: 3 },
  { name: "apple", price: 10 },
  { name: "Cherry", price: 1 },
]

function Fruits(props: Partial<TableRootProps> & { readonly sorted?: boolean }) {
  const { sorted = true, ...root } = props
  const [sort, setSort] = useState<SortDescriptor | null>(null)
  const shown = sortItems(rows, root.sort ?? sort, (r, c) => r[c as "name" | "price"])
  return (
    <Table.Root
      {...root}
      onSortChange={(next, details) => {
        setSort(next)
        root.onSortChange?.(next, details)
      }}
    >
      <Table.Table>
        <Table.Caption>Fruits</Table.Caption>
        <Table.Head>
          <Table.Row>
            <Table.ColumnHeader sortable={sorted} id="name">
              <Table.SortTrigger>
                Name <Table.SortIndicator>▲</Table.SortIndicator>
              </Table.SortTrigger>
            </Table.ColumnHeader>
            <Table.ColumnHeader sortable id="price" firstDirection="descending">
              <Table.SortTrigger>
                Price <Table.SortIndicator />
              </Table.SortTrigger>
            </Table.ColumnHeader>
          </Table.Row>
        </Table.Head>
        <Table.Body>
          {shown.map((r) => (
            <Table.Row key={r.name}>
              <Table.RowHeader>{r.name}</Table.RowHeader>
              <Table.Cell>{r.price}</Table.Cell>
            </Table.Row>
          ))}
        </Table.Body>
      </Table.Table>
    </Table.Root>
  )
}

function setup(node: React.ReactNode, platform = platforms.linux) {
  const rec = recordingAnnouncer()
  render(
    <RindProvider announcer={rec.announcer} environment={{ platform }}>
      {node}
    </RindProvider>,
  )
  return { log: rec.log }
}

function ApiTable() {
  return (
    <Table.Root>
      <Table.Table>
        <Table.Caption>Props</Table.Caption>
        <Table.Head>
          <Table.Row>
            <Table.ColumnHeader>Prop</Table.ColumnHeader>
            <Table.ColumnHeader>Type</Table.ColumnHeader>
            <Table.ColumnHeader>Default</Table.ColumnHeader>
          </Table.Row>
        </Table.Head>
        <Table.Body>
          <Table.Row>
            <Table.RowHeader>value</Table.RowHeader>
            <Table.Cell>string</Table.Cell>
            <Table.Cell>—</Table.Cell>
          </Table.Row>
          <Table.Row>
            <Table.RowHeader>disabled</Table.RowHeader>
            <Table.Cell>boolean</Table.Cell>
            <Table.Cell>false</Table.Cell>
          </Table.Row>
        </Table.Body>
      </Table.Table>
    </Table.Root>
  )
}

describe("table structure", () => {
  it("div > table > caption, thead, tbody; native roles, no role attribute", async () => {
    setup(<ApiTable />)
    const table = screen.getByRole("table", { name: "Props" })
    const root = table.parentElement as HTMLElement
    expect(root.tagName).toBe("DIV")
    expect(root.children).toHaveLength(1)
    expect([...table.children].map((c) => c.tagName)).toEqual(["CAPTION", "THEAD", "TBODY"])
    expect(screen.getAllByRole("columnheader")).toHaveLength(3)
    expect(screen.getAllByRole("rowheader").map((h) => h.textContent)).toEqual([
      "value",
      "disabled",
    ])
    expect(screen.getAllByRole("cell")).toHaveLength(4)
    expect(document.querySelectorAll("table [role], table[role]")).toHaveLength(0)
    expect(screen.getAllByRole("columnheader")[0]?.getAttribute("scope")).toBe("col")
    expect(screen.getAllByRole("rowheader")[0]?.getAttribute("scope")).toBe("row")
    const d = getTable(screen, { name: "Props" })
    expect(await d.name()).toBe("Props")
    expect(await d.rows()).toEqual([
      ["value", "string", "—"],
      ["disabled", "boolean", "false"],
    ])
  })

  it("grouped columns: colspan with scope=colgroup", () => {
    setup(
      <Table.Root>
        <Table.Table aria-label="Pricing">
          <Table.Head>
            <Table.Row>
              <Table.ColumnHeader colSpan={3}>Plans</Table.ColumnHeader>
            </Table.Row>
            <Table.Row>
              <Table.ColumnHeader>Free</Table.ColumnHeader>
              <Table.ColumnHeader>Pro</Table.ColumnHeader>
              <Table.ColumnHeader>Team</Table.ColumnHeader>
            </Table.Row>
          </Table.Head>
          <Table.Body>
            <Table.Row>
              <Table.Cell>0</Table.Cell>
              <Table.Cell>9</Table.Cell>
              <Table.Cell>19</Table.Cell>
            </Table.Row>
          </Table.Body>
        </Table.Table>
      </Table.Root>,
    )
    const plans = screen.getByRole("columnheader", { name: "Plans" })
    expect(plans.getAttribute("colspan")).toBe("3")
    expect(plans.getAttribute("scope")).toBe("colgroup")
    expect(screen.getByRole("table", { name: "Pricing" })).toBeTruthy()
  })

  it("rows and cells carry no handlers: a drag selects text, nothing changes", async () => {
    setup(<ApiTable />)
    const user = userEvent.setup()
    const cell = screen.getAllByRole("cell")[0] as HTMLElement
    await user.pointer([
      { keys: "[MouseLeft>]", target: cell, offset: 0 },
      { target: cell, offset: 3 },
      { keys: "[/MouseLeft]" },
    ])
    expect(document.getSelection()?.toString()).toBe("str")
  })

  it("a table without a name warns in development", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    setup(
      <Table.Root id="nameless">
        <Table.Table>
          <Table.Body>
            <Table.Row>
              <Table.Cell>x</Table.Cell>
            </Table.Row>
          </Table.Body>
        </Table.Table>
      </Table.Root>,
    )
    await waitFor(() => expect(warn.mock.calls.flat().join(" ")).toMatch(/table needs a name/))
  })
})

describe("table sorting", () => {
  it("first press ascending, second descending; announced once each (driver)", async () => {
    const onSortChange = vi.fn()
    const { log } = setup(<Fruits defaultSort={null} onSortChange={onSortChange} />)
    const d = getTable(screen, { name: "Fruits" })
    await d.sortBy("Name")
    expect(await d.sort()).toEqual({ column: "Name", direction: "ascending" })
    expect((await d.rows()).map((r) => r[0])).toEqual(["apple", "Banana", "Cherry"])
    await d.sortBy("Name")
    expect(await d.sort()).toEqual({ column: "Name", direction: "descending" })
    expect(onSortChange.mock.calls.map((c) => c[0])).toEqual([
      { column: "name", direction: "ascending" },
      { column: "name", direction: "descending" },
    ])
    expect(log.map((a) => [a.message, a.priority])).toEqual([
      ["Sorted by Name, ascending", "polite"],
      ["Sorted by Name, descending", "polite"],
    ])
  })

  it("descending first; aria-sort moves to one header only", async () => {
    setup(<Fruits />)
    const d = getTable(screen)
    await d.sortBy("Name")
    await d.sortBy("Price")
    expect(await d.sort()).toEqual({ column: "Price", direction: "descending" })
    expect(document.querySelectorAll("[aria-sort]")).toHaveLength(1)
    const name = screen.getByRole("columnheader", { name: "Name" })
    expect(name.hasAttribute("aria-sort")).toBe(false)
  })

  it("allowUnsorted: back to null, no aria-sort, Sort cleared", async () => {
    const { log } = setup(<Fruits allowUnsorted />)
    const d = getTable(screen)
    await d.sortBy("Name")
    await d.sortBy("Name")
    await d.sortBy("Name")
    expect(await d.sort()).toBeNull()
    expect(document.querySelectorAll("[aria-sort]")).toHaveLength(0)
    expect(log.at(-1)?.message).toBe("Sort cleared")
  })

  it("every activation path proposes once: pointer, Enter, Space, a bare click", async () => {
    const onSortChange = vi.fn()
    setup(<Fruits onSortChange={onSortChange} />)
    const user = userEvent.setup()
    const trigger = screen.getByRole("button", { name: "Name" })
    await user.click(trigger)
    trigger.focus()
    await user.keyboard("{Enter}")
    await user.keyboard(" ")
    await act(async () => {
      trigger.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, detail: 0 }))
    })
    expect(onSortChange).toHaveBeenCalledTimes(4)
  })

  it("trigger names are the column text; header names too (mui-x#16456)", () => {
    setup(<Fruits />)
    expect(screen.getByRole("button", { name: "Name" })).toBeTruthy()
    expect(screen.getByRole("button", { name: "Price" })).toBeTruthy()
    expect(screen.getByRole("columnheader", { name: "Name" })).toBeTruthy()
    expect(
      document.querySelector('[data-part="sort-indicator"]')?.getAttribute("aria-hidden"),
    ).toBe("true")
  })

  it("controlled refusal: aria-sort stays, nothing announced", async () => {
    const { log } = setup(
      <Fruits sort={{ column: "name", direction: "ascending" }} onSortChange={() => {}} />,
    )
    const d = getTable(screen)
    await d.sortBy("Name")
    expect(await d.sort()).toEqual({ column: "Name", direction: "ascending" })
    expect(log).toEqual([])
  })

  it("controlled: the parent applies, announced on arrival; a parent change is silent", async () => {
    function Parent() {
      const [sort, setSort] = useState<SortDescriptor | null>(null)
      return (
        <>
          <Fruits sort={sort} onSortChange={setSort} />
          <button
            type="button"
            onClick={() => setSort({ column: "price", direction: "descending" })}
          >
            Parent sort
          </button>
        </>
      )
    }
    const { log } = setup(<Parent />)
    const d = getTable(screen)
    await d.sortBy("Name")
    expect(await d.sort()).toEqual({ column: "Name", direction: "ascending" })
    expect(log.map((a) => a.message)).toEqual(["Sorted by Name, ascending"])
    await userEvent.setup().click(screen.getByRole("button", { name: "Parent sort" }))
    expect(await d.sort()).toEqual({ column: "Price", direction: "descending" })
    expect(log).toHaveLength(1)
  })

  it("data-direction on indicators and triggers", async () => {
    setup(<Fruits defaultSort={{ column: "name", direction: "descending" }} />)
    const indicators = document.querySelectorAll('[data-part="sort-indicator"]')
    expect(indicators[0]?.getAttribute("data-direction")).toBe("descending")
    expect(indicators[1]?.getAttribute("data-direction")).toBe("none")
    expect(document.querySelector('[data-part="table"]')?.hasAttribute("data-sorted")).toBe(true)
  })

  it("TalkBack: the sorted trigger is described by its state on Android only", async () => {
    setup(<Fruits defaultSort={{ column: "name", direction: "descending" }} />, platforms.android)
    const trigger = screen.getByRole("button", { name: "Name" })
    await waitFor(() => expect(trigger.getAttribute("aria-describedby")).not.toBeNull())
    const id = trigger.getAttribute("aria-describedby") ?? ""
    expect(document.getElementById(id)?.textContent).toBe("sorted descending")
  })

  it("no description on macOS", async () => {
    setup(<Fruits defaultSort={{ column: "name", direction: "descending" }} />, platforms.apple)
    await act(async () => {})
    expect(screen.getByRole("button", { name: "Name" }).hasAttribute("aria-describedby")).toBe(
      false,
    )
  })
})

describe("table empty and loading", () => {
  it("Empty spans every leaf column; the table carries data-empty; sort buttons stay tabbable", async () => {
    setup(
      <Table.Root>
        <Table.Table aria-label="Results" loading>
          <Table.Head>
            <Table.Row>
              {["a", "b", "c", "d"].map((c) => (
                <Table.ColumnHeader key={c} sortable id={c}>
                  <Table.SortTrigger>{c}</Table.SortTrigger>
                </Table.ColumnHeader>
              ))}
            </Table.Row>
          </Table.Head>
          <Table.Body>
            <Table.Empty>No results</Table.Empty>
          </Table.Body>
        </Table.Table>
      </Table.Root>,
    )
    const cell = screen.getByText("No results")
    await waitFor(() => expect(cell.getAttribute("colspan")).toBe("4"))
    const d = getTable(screen, { name: "Results" })
    expect(await d.isEmpty()).toBe(true)
    expect(await d.isLoading()).toBe(true)
    const user = userEvent.setup()
    await user.tab()
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "a" }))
  })
})

describe("table server rendering", () => {
  it("every row and the sort state in the server HTML; no measured attribute; hydrates clean", async () => {
    const tree = (
      <StrictMode>
        <RindProvider>
          <Fruits defaultSort={{ column: "price", direction: "descending" }} />
        </RindProvider>
      </StrictMode>
    )
    const container = document.createElement("div")
    container.innerHTML = renderToString(tree)
    expect(container.querySelectorAll("tbody tr")).toHaveLength(3)
    expect(container.querySelector("[aria-sort]")?.getAttribute("aria-sort")).toBe("descending")
    const root = container.querySelector('[data-part="root"]') as HTMLElement
    expect(root.hasAttribute("tabindex")).toBe(false)
    expect(root.hasAttribute("role")).toBe(false)
    expect(root.getAttribute("style") ?? "").not.toContain("--rind-table")
    document.body.append(container)
    const error = vi.spyOn(console, "error").mockImplementation(() => {})
    let r: ReturnType<typeof hydrateRoot> | undefined
    await act(async () => {
      r = hydrateRoot(container, tree, { onRecoverableError: (e) => error(String(e)) })
    })
    expect(error.mock.calls).toEqual([])
    await act(async () => r?.unmount())
    container.remove()
  })
})
