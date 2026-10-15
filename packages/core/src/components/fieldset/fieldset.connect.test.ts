// Fieldset part props need no DOM (openspec fieldset "Group Name And Description").
import { afterEach, describe, expect, it, vi } from "vitest"
import { type FieldsetConnectState, fieldsetConnect } from "./fieldset.connect"

let n = 0
const state = (over: Partial<FieldsetConnectState> = {}): FieldsetConnectState => ({
  instance: `i${++n}`,
  disabled: false,
  invalid: false,
  rootTag: "fieldset",
  nativeLegend: true,
  ids: {},
  ...over,
})

afterEach(() => vi.restoreAllMocks())

describe("root, native", () => {
  it("is a plain fieldset: no role, no aria-labelledby with a native legend (ark#3614)", () => {
    const p = fieldsetConnect(state({ ids: { legend: "L" } })).root()
    expect(p["role"]).toBeUndefined()
    expect(p["aria-labelledby"]).toBeUndefined()
    expect(p["aria-disabled"]).toBeUndefined()
    expect(p["disabled"]).toBeUndefined()
  })

  it("carries the native disabled attribute, not aria-disabled", () => {
    const p = fieldsetConnect(state({ disabled: true })).root()
    expect(p["disabled"]).toBe(true)
    expect(p["aria-disabled"]).toBeUndefined()
    expect(p["role"]).toBeUndefined()
  })

  it("a substituted legend gets aria-labelledby (base-ui#3044)", () => {
    const p = fieldsetConnect(state({ nativeLegend: false, ids: { legend: "L" } })).root()
    expect(p["aria-labelledby"]).toBe("L")
    expect(p["role"]).toBeUndefined()
  })

  it("no legend, no aria-labelledby", () => {
    expect(
      fieldsetConnect(state({ nativeLegend: false })).root()["aria-labelledby"],
    ).toBeUndefined()
  })
})

describe("root, substituted", () => {
  it("is role group with aria-disabled while disabled, and no disabled attribute", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {})
    const p = fieldsetConnect(state({ rootTag: "div", disabled: true })).root()
    expect(p["role"]).toBe("group")
    expect(p["aria-disabled"]).toBe("true")
    expect(p["disabled"]).toBeUndefined()
  })

  it("is role group without aria-disabled while enabled, and does not warn", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    const p = fieldsetConnect(state({ rootTag: "div" })).root()
    expect(p["role"]).toBe("group")
    expect(p["aria-disabled"]).toBeUndefined()
    expect(warn).not.toHaveBeenCalled()
  })

  it("always labels by the legend id, even when it is native", () => {
    const p = fieldsetConnect(state({ rootTag: "div", ids: { legend: "L" } })).root()
    expect(p["aria-labelledby"]).toBe("L")
  })

  it("warns once per instance while disabled, naming the limit", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    const api = fieldsetConnect(state({ rootTag: "div", disabled: true }))
    api.root()
    api.root()
    expect(warn).toHaveBeenCalledOnce()
    expect(String(warn.mock.calls[0]?.[0])).toContain("does not disable native controls")
    fieldsetConnect(state({ rootTag: "section", disabled: true })).root()
    expect(warn).toHaveBeenCalledTimes(2)
  })

  it("does not warn for a native root", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    fieldsetConnect(state({ disabled: true })).root()
    expect(warn).not.toHaveBeenCalled()
  })
})

describe("aria-describedby", () => {
  const describedby = (s: Partial<FieldsetConnectState>) =>
    fieldsetConnect(state(s)).root()["aria-describedby"]

  it("is absent, never an empty string, with nothing registered (ark#3707)", () => {
    expect(describedby({})).toBeUndefined()
    expect(describedby({ describedBy: "" })).toBeUndefined()
    expect(describedby({ ids: { legend: "L" } })).toBeUndefined()
  })

  it("lists the description, then the consumer's ids", () => {
    expect(describedby({ ids: { description: "D" } })).toBe("D")
    expect(describedby({ ids: { description: "D" }, describedBy: "mine" })).toBe("D mine")
    expect(describedby({ describedBy: "mine" })).toBe("mine")
  })

  it("adds the error message only while invalid, after the description (base-ui#3260)", () => {
    const ids = { description: "D", "error-message": "E" }
    expect(describedby({ ids })).toBe("D")
    expect(describedby({ ids, invalid: true })).toBe("D E")
    expect(describedby({ ids, invalid: true, describedBy: "mine" })).toBe("D E mine")
    expect(describedby({ ids: { "error-message": "E" }, invalid: true })).toBe("E")
  })
})

describe("data attributes", () => {
  const parts = (s: FieldsetConnectState) => {
    const api = fieldsetConnect(s)
    return {
      root: api.root(),
      legend: api.legend("l"),
      description: api.description("d"),
      "error-message": api.errorMessage("e"),
    }
  }

  it("every part has scope, part and instance", () => {
    const s = state()
    for (const [part, p] of Object.entries(parts(s))) {
      expect(p).toMatchObject({
        "data-scope": "fieldset",
        "data-part": part,
        "data-instance": s.instance,
      })
    }
  })

  it("every part has data-disabled / data-invalid exactly when they apply", () => {
    for (const p of Object.values(parts(state()))) {
      expect(p["data-disabled"]).toBeUndefined()
      expect(p["data-invalid"]).toBeUndefined()
    }
    for (const p of Object.values(parts(state({ disabled: true, invalid: true })))) {
      expect(p["data-disabled"]).toBeDefined()
      expect(p["data-invalid"]).toBeDefined()
    }
    const onlyInvalid = parts(state({ invalid: true }))
    for (const p of Object.values(onlyInvalid)) {
      expect(p["data-disabled"]).toBeUndefined()
      expect(p["data-invalid"]).toBeDefined()
    }
  })

  it("legend, description and error message carry their id", () => {
    const p = parts(state())
    expect([p.legend["id"], p.description["id"], p["error-message"]["id"]]).toEqual(["l", "d", "e"])
  })
})
