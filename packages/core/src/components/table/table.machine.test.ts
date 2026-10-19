// The sort write path and the scroll tab stop, in Node: a recording announcer, no DOM.
import { describe, expect, it } from "vitest"
import type { Announcement, Scheduler } from "../../env"
import { createService } from "../../machine/service"
import { type TableEvent, type TableProps, tableMachine } from "./table.machine"
import { tableMessages } from "./table.messages"
import {
  nextSort,
  type SortDescriptor,
  type SortDirection,
  sortItems,
  type TableSortValue,
} from "./table.sort"

function manualScheduler() {
  let now = 0
  const timers = new Map<number, { at: number; fn: () => void }>()
  let next = 1
  const scheduler: Scheduler = {
    setTimeout: (fn, ms) => {
      timers.set(next, { at: now + ms, fn })
      return next++
    },
    clearTimeout: (h) => {
      timers.delete(h as number)
    },
    requestAnimationFrame: () => 0,
    cancelAnimationFrame: () => {},
  }
  const advance = (ms: number) => {
    now += ms
    for (const [id, t] of [...timers]) {
      if (t.at <= now) {
        timers.delete(id)
        t.fn()
      }
    }
  }
  return { scheduler, advance }
}

function make(over: Partial<TableProps> = {}) {
  const time = manualScheduler()
  const log: Announcement[] = []
  const changes: (SortDescriptor | null)[] = []
  let props: TableProps = {
    root: "t1",
    messages: tableMessages,
    onSortChange: (s) => changes.push(s.value),
    ...over,
  }
  const env = {
    scheduler: time.scheduler,
    announcer: {
      announce: (a: Announcement) => {
        log.push(a)
      },
      prepare: () => () => {},
      cancel: () => {},
    },
  }
  const s = createService(tableMachine, props, env)
  s.start()
  const sort = () => s.view(props as never).values.sort.value
  const ctx = () => s.getSnapshot().context
  const setProps = (next: Partial<TableProps>) => {
    props = { ...props, ...next }
    s.setProps(props)
  }
  return { s, log, changes, sort, ctx, setProps, advance: time.advance }
}

const press = (column: string, name = column, firstDirection: SortDirection = "ascending") =>
  ({ type: "SORT", column, name, firstDirection, modality: "pointer" }) as TableEvent
const said = (log: readonly Announcement[]) => log.map((a) => a.message)
const box = (value: SortDescriptor | null): TableSortValue => ({ value })

describe("nextSort", () => {
  it("another column starts at its first direction; the sorted column flips", () => {
    expect(nextSort(null, "name")).toEqual({ column: "name", direction: "ascending" })
    expect(nextSort({ column: "name", direction: "ascending" }, "name")).toEqual({
      column: "name",
      direction: "descending",
    })
    expect(nextSort({ column: "name", direction: "ascending" }, "price", "descending")).toEqual({
      column: "price",
      direction: "descending",
    })
  })
  it("allowUnsorted clears at the opposite of the first direction", () => {
    const desc = { column: "name", direction: "descending" } as const
    expect(nextSort(desc, "name", "ascending", true)).toBeNull()
    expect(nextSort(desc, "name", "ascending", false)?.direction).toBe("ascending")
    const asc = { column: "p", direction: "ascending" } as const
    expect(nextSort(asc, "p", "descending", true)).toBeNull()
  })
})

describe("table machine: sorting", () => {
  it("first press ascending, second descending; each announced once, politely", () => {
    const { s, sort, changes, log } = make()
    s.send(press("name", "Name"))
    expect(sort()).toEqual({ column: "name", direction: "ascending" })
    s.send(press("name", "Name"))
    expect(changes).toEqual([
      { column: "name", direction: "ascending" },
      { column: "name", direction: "descending" },
    ])
    expect(said(log)).toEqual(["Sorted by Name, ascending", "Sorted by Name, descending"])
    expect(log[0]).toMatchObject({ priority: "polite", key: "table-t1" })
  })

  it("descending first for a column that asks for it", () => {
    const { s, sort } = make({ defaultSort: box({ column: "name", direction: "ascending" }) })
    s.send(press("price", "Price", "descending"))
    expect(sort()).toEqual({ column: "price", direction: "descending" })
  })

  it("allowUnsorted: back to null, announced as cleared", () => {
    const { s, sort, log } = make({
      allowUnsorted: true,
      defaultSort: box({ column: "name", direction: "descending" }),
    })
    s.send(press("name", "Name"))
    expect(sort()).toBeNull()
    expect(said(log)).toEqual(["Sort cleared"])
  })

  it("uncontrolled cancel: nothing changes, nothing is said", () => {
    const { s, sort, log } = make({ onSortChange: (_s, d) => d.cancel() })
    s.send(press("name"))
    expect(sort()).toBeNull()
    expect(log).toEqual([])
  })

  it("controlled refusal: the sort stays and nothing is announced", () => {
    const { s, sort, log, changes } = make({
      sort: box({ column: "name", direction: "ascending" }),
    })
    s.send(press("name", "Name"))
    expect(changes).toEqual([{ column: "name", direction: "descending" }])
    expect(sort()).toEqual({ column: "name", direction: "ascending" })
    expect(log).toEqual([])
  })

  it("controlled arrival of the proposal is announced once", () => {
    const { s, sort, log, setProps } = make({ sort: box(null) })
    s.send(press("name", "Name"))
    expect(log).toEqual([])
    setProps({ sort: box({ column: "name", direction: "ascending" }) })
    expect(sort()).toEqual({ column: "name", direction: "ascending" })
    expect(said(log)).toEqual(["Sorted by Name, ascending"])
  })

  it("a parent change nobody proposed is silent", () => {
    const { sort, log, setProps } = make({ sort: box(null) })
    setProps({ sort: box({ column: "price", direction: "descending" }) })
    expect(sort()).toEqual({ column: "price", direction: "descending" })
    expect(log).toEqual([])
  })
})

describe("table machine: scroll tab stop", () => {
  const measured = (x: boolean, tabbable = false): TableEvent => ({
    type: "MEASURED",
    overflow: { x, y: false },
    edges: { xStart: false, xEnd: x, yStart: false, yEnd: false },
    tabbable,
  })

  it("only measured, overflowing and with nothing tabbable inside", () => {
    const { s, ctx } = make()
    expect(ctx().tabStop).toBe(false)
    s.send(measured(true))
    expect(ctx().tabStop).toBe(true)
    s.send(measured(true, true))
    expect(ctx().tabStop).toBe(false)
    s.send(measured(false))
    expect(ctx().tabStop).toBe(false)
  })

  it("kept while focused when overflow ends, dropped on blur", () => {
    const { s, ctx } = make()
    s.send(measured(true))
    s.send({ type: "ROOT.FOCUS" })
    s.send(measured(false))
    expect(ctx().tabStop).toBe(true)
    s.send({ type: "ROOT.BLUR" })
    expect(ctx().tabStop).toBe(false)
  })

  it("the tracking capability starts with the service and stops with it", () => {
    let stopped = false
    let root = ""
    const s = createService(
      tableMachine,
      { root: "t9", messages: tableMessages },
      {
        scheduler: manualScheduler().scheduler,
        announcer: { announce: () => {}, prepare: () => () => {}, cancel: () => {} },
        tableMetrics: {
          track: (r) => {
            root = r
            return () => {
              stopped = true
            }
          },
        },
      },
    )
    s.start()
    expect(root).toBe("t9")
    s.stop()
    expect(stopped).toBe(true)
  })
})

describe("table machine: expandable rows", () => {
  const toggle = (row: string) => ({ type: "ROW.TOGGLE", row }) as TableEvent
  const open = (s: ReturnType<typeof make>["s"], props: TableProps) =>
    s.view(props as never).values.expandedRows
  it("toggles; several open by default", () => {
    const m = make()
    m.s.send(toggle("a"))
    m.s.send(toggle("b"))
    expect(open(m.s, {} as TableProps)).toEqual(["a", "b"])
    m.s.send(toggle("a"))
    expect(open(m.s, {} as TableProps)).toEqual(["b"])
  })
  it("multiple={false}: opening one closes the others", () => {
    const m = make({ multiple: false })
    m.s.send(toggle("a"))
    m.s.send(toggle("b"))
    expect(open(m.s, {} as TableProps)).toEqual(["b"])
  })
})

describe("table machine: row count", () => {
  it("announced once after the quiet period; the first render is silent", () => {
    const { log, setProps, advance } = make({ rowCount: 87 })
    advance(1000)
    expect(log).toEqual([])
    setProps({ rowCount: 40 })
    advance(200)
    setProps({ rowCount: 12 })
    advance(399)
    expect(log).toEqual([])
    advance(1)
    expect(said(log)).toEqual(["12 rows"])
  })

  it("a row range is announced instead of the count", () => {
    const { log, setProps, advance } = make({ rowRange: { from: 1, to: 10, total: 87 } })
    setProps({ rowRange: { from: 11, to: 20, total: 87 } })
    advance(400)
    expect(said(log)).toEqual(["Rows 11 to 20 of 87"])
  })

  it("an equal range is no change", () => {
    const { log, setProps, advance } = make({ rowRange: { from: 1, to: 10, total: 87 } })
    setProps({ rowRange: { from: 1, to: 10, total: 87 } })
    advance(400)
    expect(log).toEqual([])
  })
})

describe("sortItems", () => {
  const v = (x: unknown) => x
  const sorted = (items: readonly unknown[], direction: SortDirection) =>
    sortItems(items, { column: "c", direction }, v)

  it("natural order, empty values last in both directions (TanStack/table#6086)", () => {
    const items = ["item 10", null, "item 2", "", "Item 1"]
    expect(sorted(items, "ascending")).toEqual(["Item 1", "item 2", "item 10", null, ""])
    expect(sorted(items, "descending")).toEqual(["item 10", "item 2", "Item 1", null, ""])
  })

  it("stable for equal values; the input is untouched", () => {
    const rows = [
      { id: 1, g: "b" },
      { id: 2, g: "a" },
      { id: 3, g: "b" },
      { id: 4, g: "a" },
    ]
    const copy = [...rows]
    const out = sortItems(rows, { column: "g", direction: "ascending" }, (r) => r.g)
    expect(out.map((r) => r.id)).toEqual([2, 4, 1, 3])
    expect(rows).toEqual(copy)
    expect(out).not.toBe(rows)
  })

  it("numbers, NaN, bigints, dates and booleans by value", () => {
    expect(sorted([3, Number.NaN, 1, 2], "ascending")).toEqual([1, 2, 3, Number.NaN])
    expect(sorted([10n, 2n], "ascending")).toEqual([2n, 10n])
    const [a, b] = [new Date(2026, 0, 2), new Date(2026, 0, 1)]
    expect(sorted([a, b], "ascending")).toEqual([b, a])
    expect(sorted([true, false], "ascending")).toEqual([false, true])
  })

  it("mixed types: a total order by type name", () => {
    const out = sorted(["b", 2, "a", 1], "ascending")
    expect(out).toEqual([1, 2, "a", "b"])
  })

  it("null sort returns a copy in the original order", () => {
    const items = [3, 1, 2]
    const out = sortItems(items, null, v)
    expect(out).toEqual([3, 1, 2])
    expect(out).not.toBe(items)
  })
})
