// Badge attributes and render-time warnings that need no DOM (openspec badge). Regressions:
// Kobalte role="status", mui/material-ui#22070.
import { afterEach, describe, expect, it, vi } from "vitest"
import { badgeConnect, badgeWarnings } from "./badge.connect"

const warn = () => vi.spyOn(console, "warn").mockImplementation(() => {})
afterEach(() => vi.restoreAllMocks())

describe("badgeConnect", () => {
  it("root: scoping attributes and the instance id, no role, no live attributes", () => {
    const root = badgeConnect({ instance: "b1" }).root()
    expect(root).toEqual({
      "data-scope": "badge",
      "data-part": "root",
      "data-instance": "b1",
      id: "b1",
    })
  })

  it("without label: no wrapper, no hidden label (a plain badge is one element)", () => {
    const api = badgeConnect({ instance: "b1" })
    expect(api.content()).toBeNull()
    expect(api.label()).toBeNull()
  })

  it("with label: content aria-hidden, label visually hidden (mui/material-ui#22070)", () => {
    const api = badgeConnect({ instance: "b1", label: "more than 99 notifications" })
    expect(api.content()).toEqual({ "aria-hidden": "true" })
    const label = api.label()
    expect(label?.["data-visually-hidden"]).toBe("")
    expect(label?.["style"]).toMatchObject({ position: "fixed", width: "1px" })
  })

  it("an empty label still replaces the content", () => {
    expect(badgeConnect({ instance: "b1", label: "" }).content()).toEqual({ "aria-hidden": "true" })
  })
})

describe("badgeWarnings", () => {
  it.each(["status", "alert", "log"])("role=%s warns and names the Announcer (Kobalte)", (role) => {
    const w = warn()
    badgeWarnings({ role })
    expect(w).toHaveBeenCalledOnce()
    expect(String(w.mock.calls[0]?.[0])).toMatch(/Announcer/)
  })

  it("aria-live warns", () => {
    const w = warn()
    badgeWarnings({ "aria-live": "polite" })
    expect(w).toHaveBeenCalledOnce()
  })

  it.each(["aria-label", "aria-labelledby"])("%s warns and recommends label", (name) => {
    const w = warn()
    badgeWarnings({ [name]: "x" })
    expect(w).toHaveBeenCalledOnce()
    expect(String(w.mock.calls[0]?.[0])).toMatch(/label prop/)
  })

  it("a non-live role, aria-hidden and data-* do not warn", () => {
    const w = warn()
    badgeWarnings({ role: "presentation", "aria-hidden": "true", "data-tone": "danger" })
    expect(w).not.toHaveBeenCalled()
  })
})
