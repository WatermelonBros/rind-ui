// The family matrix is asserted as data. Many of these components do not exist yet (each lands
// with its own change); the theme tests of those changes render them, these pin the matrix.
import { describe, expect, it } from "vitest"
import { allComponents, familyMatrix, familyOf, noFamily, rowOf } from "./families"

const defaultOf = (scope: string) => rowOf(scope)?.variants[0]

describe("family matrix", () => {
  it("puts every component in exactly one row, none of them structural", () => {
    expect(new Set(allComponents).size).toBe(allComponents.length)
    for (const s of noFamily) expect(allComponents).not.toContain(s)
  })

  it("has the twelve families and a default first in every variant list", () => {
    expect(new Set(familyMatrix.map((r) => r.family)).size).toBe(12)
    for (const r of familyMatrix) {
      if (r.size === "own") expect(r.sizes[0]).toBe("md")
      else expect(r.sizes).toEqual([])
    }
  })

  it("Structural components have no family", () => {
    expect(noFamily).toEqual(["label", "field", "fieldset", "form", "heading"])
    for (const s of ["label", "field", "fieldset", "form"]) expect(familyOf(s)).toBeUndefined()
  })

  it("Heading has no family", () => {
    expect(noFamily).toContain("heading")
    expect(familyOf("heading")).toBeUndefined()
  })

  it("Separator has no variant or size", () => {
    expect(familyOf("separator")).toBe("decoration")
    expect(rowOf("separator")).toMatchObject({ variants: [], size: "none" })
  })

  it("Skeleton and Image ignore variant and size", () => {
    for (const s of ["skeleton", "image"]) {
      expect(familyOf(s)).toBe("decoration")
      expect(rowOf(s)).toMatchObject({ variants: [], size: "none" })
    }
  })

  it("Avatar defaults to the identity family's soft variant", () => {
    for (const s of ["avatar", "avatar-group"]) {
      expect(familyOf(s)).toBe("identity")
      expect(defaultOf(s)).toBe("soft")
      expect(rowOf(s)?.variants).toEqual(["soft", "solid", "outline"])
      expect(rowOf(s)?.sizes[0]).toBe("md")
    }
  })

  it("Toolbar and menubar items share the toggle item look", () => {
    for (const s of ["toolbar-button", "toolbar-link", "menubar-trigger", "toggle-group-item"]) {
      expect(familyOf(s)).toBe("toggle item")
      expect(defaultOf(s)).toBe("ghost")
      expect(rowOf(s)?.sizes[0]).toBe("md")
    }
  })

  it("Links have no variant or size", () => {
    for (const s of ["link", "breadcrumbs-link", "navigation-menu-content-link"]) {
      expect(familyOf(s)).toBe("link")
      expect(rowOf(s)).toMatchObject({ variants: [], size: "none" })
    }
  })

  it("Navigation Menu parts follow Menubar's families", () => {
    for (const s of ["navigation-menu-trigger", "navigation-menu-link"]) {
      expect(familyOf(s)).toBe(familyOf("menubar-trigger"))
      expect(defaultOf(s)).toBe("ghost")
    }
    for (const s of ["navigation-menu-viewport", "navigation-menu-content"]) {
      expect(familyOf(s)).toBe(familyOf("menubar"))
      expect(familyOf(s)).toBe("panel")
    }
  })

  it("Calendar and date fields follow existing families", () => {
    for (const s of ["calendar", "range-calendar"]) expect(familyOf(s)).toBe("panel")
    for (const s of ["calendar-day", "range-calendar-day"])
      expect(familyOf(s)).toBe("collection item")
    for (const s of ["date-field", "time-field"]) {
      expect(familyOf(s)).toBe("field")
      expect(defaultOf(s)).toBe("outline")
      expect(rowOf(s)?.sizes[0]).toBe("md")
    }
  })

  it("Date pickers and range fields follow existing families", () => {
    for (const s of ["date-picker", "date-range-picker", "date-range-field", "time-range-field"]) {
      expect(familyOf(s)).toBe("field")
      expect(defaultOf(s)).toBe("outline")
    }
    for (const s of [
      "date-picker-content",
      "date-range-picker-content",
      "month-picker",
      "year-picker",
    ])
      expect(familyOf(s)).toBe("panel")
    for (const s of ["month-picker-cell", "year-picker-cell"])
      expect(familyOf(s)).toBe("collection item")
  })

  it("range family has solid and soft; panel sizes only on dialog and drawer", () => {
    expect(rowOf("slider")?.variants).toEqual(["solid", "soft"])
    expect(rowOf("dialog")).toMatchObject({ variants: [], size: "inherited" })
    expect(rowOf("dialog")?.sizedComponents).toEqual(["dialog", "drawer"])
  })
})
