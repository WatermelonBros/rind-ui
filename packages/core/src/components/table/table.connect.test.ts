import { describe, expect, it } from "vitest"
import { platforms } from "../../dom/platform"
import { quirkActive } from "../../dom/quirks"
import { type TableConnectInput, tableConnect, tableFrameConnect } from "./table.connect"
import { tableContract } from "./table.contract"
import { tableMachine } from "./table.machine"
import { tableMessages } from "./table.messages"
import { tableMeta } from "./table.meta"

const input = (over: Partial<TableConnectInput> = {}): TableConnectInput => ({
  instance: "t",
  sort: { column: "name", direction: "descending" },
  messages: tableMessages,
  tabStop: true,
  holdsControls: false,
  overflow: { x: true, y: true },
  edges: { xStart: true, xEnd: true, yStart: false, yEnd: true },
  focused: true,
  modality: "keyboard",
  stickyFirstColumn: true,
  empty: true,
  captionId: "cap",
  tableLabel: undefined,
  describeSort: true,
  pinned: { start: ["name"], end: [] },
  expandedRows: ["r1"],
  ...over,
})

const dataKeys = (p: Record<string, unknown>) =>
  Object.keys(p)
    .filter((k) => k.startsWith("data-") && p[k] !== undefined)
    .sort()

describe("table meta matches the code", () => {
  it("contract and states", () => {
    const actions = Object.fromEntries(
      Object.entries(tableContract.actions).map(([name, a]) => [
        name,
        [
          ...(["pointer", "keyboard", "touch"] as const).filter((m) => m in a),
          ...("pointer" in a ? ["virtual"] : []),
        ],
      ]),
    )
    expect(tableMeta.contract.actions).toEqual(actions)
    expect(tableMeta.contract.queries).toEqual(Object.keys(tableContract.queries))
    expect(tableMeta.contract.traits).toEqual(tableContract.traits)
    expect(Object.keys(tableMeta.states)).toEqual(Object.keys(tableMachine.def.states))
  })

  it("data attributes", () => {
    const a = tableConnect(input())
    const parts = {
      root: a.root(),
      table: a.table({ loading: true }),
      caption: a.caption("cap"),
      head: a.head(),
      body: a.body(),
      foot: a.foot(),
      row: a.row("r1"),
      "row-trigger": a.rowTrigger("r1", {
        text: "R",
        named: false,
        focused: true,
        modality: "keyboard",
      }),
      "row-details": a.rowDetails("r1"),
      "column-header": a.columnHeader({ column: "name", sortable: true }),
      "row-header": a.rowHeader({}),
      cell: a.cell(),
      "sort-trigger": a.sortTrigger("name", { focused: true, modality: "keyboard" }),
      "sort-indicator": a.sortIndicator("name"),
      empty: a.empty(),
      "filter-trigger": a.filterTrigger("name", { text: "Name", active: true, named: false }),
      "filter-indicator": a.filterIndicator(true),
    }
    for (const [part, props] of Object.entries(parts)) {
      const meta = tableMeta.dataAttributes[part as keyof typeof tableMeta.dataAttributes]
      expect(Object.keys(meta).sort(), part).toEqual(dataKeys(props))
    }
  })
})

describe("table connect: columns, filters, frame", () => {
  it("pinned headers carry their side and column", () => {
    const a = tableConnect(input({ pinned: { start: ["name"], end: ["actions"] } }))
    expect(a.columnHeader({ column: "name" })).toMatchObject({
      "data-column": "name",
      "data-pinned": "start",
    })
    expect(a.columnHeader({ column: "actions" })["data-pinned"]).toBe("end")
    expect(a.columnHeader({ column: "price" })["data-pinned"]).toBeUndefined()
  })
  it("a header holding a filter is named by its text (MUI-X#19239)", () => {
    const a = tableConnect(input())
    expect(a.columnHeader({ column: "name", controls: true, text: "Name" })["aria-label"]).toBe(
      "Name",
    )
    expect(a.columnHeader({ column: "name", text: "Name" })["aria-label"]).toBeUndefined()
  })
  it("filter trigger: Filter {column}, described while active", () => {
    const a = tableConnect(input())
    const on = a.filterTrigger("name", { text: "Name", active: true, named: false })
    expect(on).toMatchObject({ "aria-label": "Filter Name", "data-active": "" })
    expect(on["aria-describedby"]).toBe(a.filterState("name", true)?.id)
    expect(a.filterState("name", true)?.text).toBe("Filtered")
    const off = a.filterTrigger("name", { text: "Name", active: false, named: false })
    expect(off["aria-describedby"]).toBeUndefined()
    expect(a.filterIndicator(true)).toMatchObject({ "aria-hidden": "true", "data-active": "" })
  })
  it("the frame is a named modal dialog only while expanded", () => {
    const f = (expanded: boolean) =>
      tableFrameConnect({
        instance: "t",
        expanded,
        messages: tableMessages,
        captionId: "cap",
        ids: { frame: "fr", expandTrigger: "ex" },
      })
    expect(f(true).frame()).toMatchObject({
      role: "dialog",
      "aria-modal": "true",
      "aria-labelledby": "cap",
      "data-expanded": "",
    })
    expect(f(false).frame()["role"]).toBeUndefined()
    const t = { named: false, focused: false, modality: "pointer" as const }
    expect(f(true).expandTrigger(t)).toMatchObject({
      type: "button",
      "aria-pressed": "true",
      "aria-label": "Full page",
    })
  })
})

describe("table connect: expandable rows", () => {
  it("trigger controls the details; hidden while collapsed", () => {
    const a = tableConnect(input({ expandedRows: [] }))
    const t = a.rowTrigger("r", {
      text: "Alpha",
      named: false,
      focused: false,
      modality: "pointer",
    })
    expect(t).toMatchObject({
      type: "button",
      "aria-expanded": "false",
      "aria-label": "Show details Alpha",
    })
    expect(t["aria-controls"]).toBe(a.rowDetails("r")["id"])
    expect(a.rowDetails("r")["hidden"]).toBe(true)
    const open = tableConnect(input({ expandedRows: ["r"] }))
    expect(open.rowDetails("r")["hidden"]).toBeUndefined()
    expect(open.row("r")["data-expanded"]).toBe("")
  })
})

describe("table connect", () => {
  it("the Root is a named group and tab stop only while it is a stop", () => {
    expect(tableConnect(input()).root()).toMatchObject({
      tabindex: 0,
      role: "group",
      "aria-labelledby": "cap",
    })
    const label = tableConnect(input({ captionId: undefined, tableLabel: "Plans" })).root()
    expect(label).toMatchObject({ role: "group", "aria-label": "Plans" })
    const controls = tableConnect(input({ tabStop: false, holdsControls: true })).root()
    expect(controls["tabindex"]).toBe(-1)
    expect(controls["role"]).toBeUndefined()
    const off = tableConnect(input({ tabStop: false })).root()
    expect(off["tabindex"]).toBeUndefined()
    expect(off["role"]).toBeUndefined()
    expect(off["aria-labelledby"]).toBeUndefined()
  })

  it("scope by span; aria-sort on the sorted header only", () => {
    const a = tableConnect(input())
    expect(a.columnHeader({})["scope"]).toBe("col")
    expect(a.columnHeader({ colSpan: 3 })["scope"]).toBe("colgroup")
    expect(a.rowHeader({})["scope"]).toBe("row")
    expect(a.rowHeader({ rowSpan: 2 })["scope"]).toBe("rowgroup")
    expect(a.columnHeader({ column: "name", sortable: true })["aria-sort"]).toBe("descending")
    expect(a.columnHeader({ column: "price", sortable: true })["aria-sort"]).toBeUndefined()
    expect(a.columnHeader({})["aria-sort"]).toBeUndefined()
    for (const part of [
      a.table({ loading: false }),
      a.row(),
      a.cell(),
      a.columnHeader({}),
      a.rowHeader({}),
    ]) {
      expect(part["role"]).toBeUndefined()
    }
  })

  it("direction on triggers and indicators; the indicator is hidden", () => {
    const a = tableConnect(input())
    expect(a.sortTrigger("name")).toMatchObject({ type: "button", "data-direction": "descending" })
    expect(a.sortIndicator("price")).toMatchObject({
      "aria-hidden": "true",
      "data-direction": "none",
    })
  })

  it("the TalkBack description only on the sorted trigger, only with the quirk", () => {
    const on = tableConnect(input())
    expect(on.sortState("name")?.text).toBe("sorted descending")
    expect(on.sortTrigger("name")["aria-describedby"]).toBe(on.sortState("name")?.id)
    expect(on.sortState("price")).toBeNull()
    const off = tableConnect(input({ describeSort: false }))
    expect(off.sortState("name")).toBeNull()
    expect(off.sortTrigger("name")["aria-describedby"]).toBeUndefined()
  })

  it("loading and empty on the table", () => {
    expect(tableConnect(input()).table({ loading: true })).toMatchObject({
      "aria-busy": "true",
      "data-loading": "",
      "data-empty": "",
      "data-sorted": "",
    })
    expect(tableConnect(input()).table({ loading: false })["aria-busy"]).toBeUndefined()
  })
})

// quirk talkback-aria-sort: TalkBack does not read aria-sort on a column header (the device
// check is in the manual protocol); the description is gated on Android only.
describe("quirk talkback-aria-sort", () => {
  it("active on Android, not on macOS, iOS, Windows or Linux", () => {
    expect(quirkActive("talkback-aria-sort", { platform: platforms.android } as never)).toBe(true)
    for (const p of [platforms.apple, platforms.ios, platforms.windows, platforms.linux]) {
      expect(quirkActive("talkback-aria-sort", { platform: p } as never)).toBe(false)
    }
  })
})
