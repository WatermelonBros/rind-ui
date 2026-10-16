// The Pagination machine in Node: guards, the page-size rule, clamping, controlled mode.
import { describe, expect, it, vi } from "vitest"
import { createService } from "../../machine/service"
import {
  type PaginationMachineProps,
  paginationMachine,
  paginationState,
  totalPagesOf,
} from "./pagination.machine"

function make(over: PaginationMachineProps = {}) {
  const onPageChange = vi.fn()
  const onPageSizeChange = vi.fn()
  let props: PaginationMachineProps = { onPageChange, onPageSizeChange, totalPages: 5, ...over }
  const s = createService(paginationMachine, props, {})
  s.start()
  const view = () => paginationState(props, s.view(props).values)
  return {
    s,
    onPageChange,
    onPageSizeChange,
    page: () => view().page,
    view,
    setProps: (next: PaginationMachineProps) => {
      props = { ...props, ...next }
      s.setProps(props)
    },
    calls: () => onPageChange.mock.calls.map((c) => [c[0], c[1].reason]),
  }
}
const m = "keyboard" as const

describe("events and guards", () => {
  it("NEXT, PREV, FIRST, LAST move and report the reason", () => {
    const p = make()
    p.s.send({ type: "NEXT", modality: m })
    p.s.send({ type: "LAST", modality: m })
    p.s.send({ type: "PREV", modality: m })
    p.s.send({ type: "FIRST", modality: m })
    expect(p.calls()).toEqual([
      [2, "NEXT"],
      [5, "LAST"],
      [4, "PREV"],
      [1, "FIRST"],
    ])
  })

  it("boundaries: PREV and FIRST on page 1, NEXT and LAST on the last page do nothing (bits-ui#911)", () => {
    const p = make()
    p.s.send({ type: "PREV", modality: m })
    p.s.send({ type: "FIRST", modality: m })
    expect(p.page()).toBe(1)
    const q = make({ defaultPage: 5 })
    q.s.send({ type: "NEXT", modality: m })
    q.s.send({ type: "LAST", modality: m })
    expect(q.page()).toBe(5)
    expect([...p.calls(), ...q.calls()]).toEqual([])
  })

  it("SET_PAGE: the current page and out-of-range pages do nothing", () => {
    const p = make({ defaultPage: 3 })
    p.s.send({ type: "SET_PAGE", page: 3, modality: m })
    p.s.send({ type: "SET_PAGE", page: 0, modality: m })
    p.s.send({ type: "SET_PAGE", page: 6, modality: m })
    expect(p.calls()).toEqual([])
    p.s.send({ type: "SET_PAGE", page: 5, modality: m })
    expect(p.calls()).toEqual([[5, "SET_PAGE"]])
  })

  it("disabled ignores every page event", () => {
    const p = make({ disabled: true })
    p.s.send({ type: "NEXT", modality: m })
    p.s.send({ type: "SET_PAGE", page: 3, modality: m })
    expect(p.page()).toBe(1)
  })

  it("the callback receives the new page (bits-ui#646)", () => {
    const p = make()
    p.s.send({ type: "NEXT", modality: m })
    // The runtime reports before it commits (so cancel() can veto): the argument is the
    // new page, the stored value follows right after the callback returns.
    expect(p.onPageChange.mock.calls[0]?.[0]).toBe(2)
    expect(p.page()).toBe(2)
  })
})

describe("total and clamping", () => {
  it("empty data is one page (zag#2921, bits-ui#894)", () => {
    expect(totalPagesOf({ count: 0 }, 10)).toBe(1)
    const p = make({ totalPages: undefined, count: 0 })
    p.s.send({ type: "NEXT", modality: m })
    expect(p.page()).toBe(1)
    expect(p.view().range).toEqual({ start: 0, end: 0 })
  })

  it("count versus pages (reka-ui#1043)", () => {
    expect(totalPagesOf({ count: 100 }, 10)).toBe(10)
    expect(totalPagesOf({ count: 101 }, 10)).toBe(11)
  })

  it("non-integer and negative inputs floor to 0, then the total is at least 1", () => {
    expect(totalPagesOf({ totalPages: 3.7 }, 10)).toBe(3)
    expect(totalPagesOf({ totalPages: -4 }, 10)).toBe(1)
    expect(totalPagesOf({ count: -1 }, 10)).toBe(1)
  })

  it("last row deleted: clamps with reason COUNT.CHANGE (kobaltedev/kobalte#461)", () => {
    const p = make({ totalPages: undefined, count: 30, defaultPage: 3 })
    p.setProps({ count: 20 })
    expect(p.page()).toBe(2)
    expect(p.calls()).toEqual([[2, "COUNT.CHANGE"]])
  })

  it("range is one-based (bits-ui#1346)", () => {
    const p = make({ totalPages: undefined, count: 95 })
    expect(p.view().range).toEqual({ start: 1, end: 10 })
    p.s.send({ type: "LAST", modality: m })
    expect(p.view().range).toEqual({ start: 91, end: 95 })
  })
})

describe("page size", () => {
  it("keeps the reader's place: page 3 of size 10 → size 25 is page 1", () => {
    const p = make({ totalPages: undefined, count: 95, defaultPage: 3 })
    p.s.send({ type: "SET_PAGE_SIZE", pageSize: 25 })
    expect(p.page()).toBe(1)
    expect(p.calls()).toEqual([[1, "SET_PAGE_SIZE"]])
    expect(p.onPageSizeChange.mock.calls[0]?.[0]).toBe(25)
  })

  it("item 31 on size 10 (page 4) is on page 2 of size 25", () => {
    const p = make({ totalPages: undefined, count: 95, defaultPage: 4 })
    p.s.send({ type: "SET_PAGE_SIZE", pageSize: 25 })
    expect(p.page()).toBe(2)
  })
})

describe("controlled", () => {
  it("proposes and refuses: the parent keeps the page", () => {
    const p = make({ page: 2 })
    p.s.send({ type: "NEXT", modality: m })
    expect(p.onPageChange.mock.calls[0]?.[0]).toBe(3)
    p.setProps({ page: 2 })
    expect(p.page()).toBe(2)
  })

  it("accepts: the parent applies the page", () => {
    const p = make({ page: 2 })
    p.s.send({ type: "NEXT", modality: m })
    p.setProps({ page: 3 })
    expect(p.page()).toBe(3)
  })
})

describe("controlled page size from the parent", () => {
  it("keeps the first item visible, reported as SET_PAGE_SIZE", () => {
    const p = make({ totalPages: undefined, count: 95, pageSize: 10, defaultPage: 3 })
    p.setProps({ pageSize: 25 })
    expect(p.page()).toBe(1)
    expect(p.calls()).toEqual([[1, "SET_PAGE_SIZE"]])
  })

  it("an applied SET_PAGE_SIZE proposal does not move the page twice", () => {
    const p = make({ totalPages: undefined, count: 95, pageSize: 10, defaultPage: 4 })
    p.s.send({ type: "SET_PAGE_SIZE", pageSize: 25 })
    p.setProps({ pageSize: 25 })
    expect(p.page()).toBe(2)
    expect(p.calls()).toEqual([[2, "SET_PAGE_SIZE"]])
  })
})
