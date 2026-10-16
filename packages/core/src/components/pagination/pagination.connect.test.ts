import { afterEach, describe, expect, it, vi } from "vitest"
import {
  paginationConnect,
  warnControlledWithoutHandler,
  warnPaginationInputs,
} from "./pagination.connect"
import { paginationState } from "./pagination.machine"
import { paginationMessages } from "./pagination.messages"

const api = (page: number, totalPages: number, disabled = false) =>
  paginationConnect({
    instance: "i",
    state: paginationState({ totalPages }, { page, pageSize: 10 }),
    messages: paginationMessages,
    disabled,
  })

afterEach(() => vi.restoreAllMocks())

describe("paginationConnect", () => {
  it("root: named Pagination unless labelled; data-disabled", () => {
    expect(api(1, 3).root(false)).toMatchObject({
      "aria-label": "Pagination",
      "data-scope": "pagination",
    })
    expect(api(1, 3).root(true)["aria-label"]).toBeUndefined()
    expect(api(1, 3, true).root(false)["data-disabled"]).toBe("")
  })

  it("page: aria-current and data-current only on the current page; names contain the number", () => {
    const a = api(3, 3)
    expect(a.page(3, false).props).toMatchObject({
      "aria-current": "page",
      "data-current": "",
      "aria-label": "Page 3",
      "data-value": "3",
    })
    expect(a.page(3, false).disabled).toBe(false)
    expect(a.page(2, false).props["aria-current"]).toBeUndefined()
    expect(a.page(2, false).props["data-current"]).toBeUndefined()
    expect(a.page(2, true).props["aria-label"]).toBeUndefined()
  })

  it("triggers: unavailable at the ends, data-disabled agrees (bits-ui#911)", () => {
    const last = api(3, 3)
    expect(last.trigger("next", false)).toMatchObject({
      disabled: true,
      props: { "data-disabled": "", "data-direction": "next", "aria-label": "Next page" },
    })
    expect(last.trigger("previous", false).disabled).toBe(false)
    expect(last.trigger("previous", false).props["data-disabled"]).toBeUndefined()
    const one = api(1, 1)
    for (const d of ["first", "previous", "next", "last"] as const) {
      expect(one.trigger(d, false).disabled).toBe(true)
    }
  })

  it("triggers with their own text take no message name", () => {
    expect(api(2, 3).trigger("previous", true).props["aria-label"]).toBeUndefined()
  })

  it("disabled: every control is unavailable", () => {
    const a = api(2, 3, true)
    expect(a.page(1, false).disabled).toBe(true)
    expect(a.page(1, false).props["data-disabled"]).toBe("")
    expect(a.trigger("next", false).disabled).toBe(true)
  })

  it("item and ellipsis", () => {
    expect(api(1, 3).item("ellipsis")["data-type"]).toBe("ellipsis")
    expect(api(1, 3).ellipsis("end")).toMatchObject({
      "aria-hidden": "true",
      "data-position": "end",
    })
    expect(api(1, 3).ellipsis("end")["role"]).toBeUndefined()
    expect(api(1, 3).ellipsis("end")["tabIndex"]).toBeUndefined()
  })

  it("pages: the visible range", () => {
    expect(
      api(10, 20)
        .pages()
        .map((e) => e.key),
    ).toContain("ellipsis-end")
  })
})

describe("development warnings", () => {
  it("controlled without handler (ark#3724)", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    warnControlledWithoutHandler("pageSize", true, false)
    expect(warn.mock.calls[0]?.[0]).toMatch(/pageSize is controlled without onPageSizeChange/)
    warnControlledWithoutHandler("page", true, true)
    expect(warn).toHaveBeenCalledTimes(1)
  })

  it("invalid inputs", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    warnPaginationInputs({ totalPages: 2.5, count: 10 })
    expect(warn).toHaveBeenCalledTimes(1)
    expect(warn.mock.calls[0]?.[0]).toMatch(/totalPages 2.5/)
  })
})
