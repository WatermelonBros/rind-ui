// Separator role / orientation rules that need no DOM (openspec separator). Regressions:
// ariakit#721, #6302, mui/base-ui#4647, #5398, bits-ui#2090, radix-ui/primitives#216.
import { afterEach, describe, expect, it, vi } from "vitest"
import {
  droppedNameProps,
  type SeparatorContext,
  type SeparatorOrientation,
  separatorConnect,
  separatorOrientation,
  separatorProps,
  separatorWarnings,
} from "./separator.connect"

const warn = () => vi.spyOn(console, "warn").mockImplementation(() => {})
afterEach(() => vi.restoreAllMocks())

const orientations: unknown[] = ["horizontal", "vertical", undefined, "diagonal"]
const decoratives = [false, true]
const tags = ["div", "hr", "span"]
const contexts: SeparatorContext[] = ["content", "menu", "toolbar", "listbox"]
const defaults: (SeparatorOrientation | undefined)[] = [undefined, "horizontal", "vertical"]

const combos = orientations.flatMap((orientation) =>
  decoratives.flatMap((decorative) =>
    tags.flatMap((tag) =>
      contexts.flatMap((context) =>
        defaults.map((defaultOrientation) => ({
          orientation,
          decorative,
          tag,
          context,
          defaultOrientation,
        })),
      ),
    ),
  ),
)

describe("every combination", () => {
  it.each(combos)("%o", (c) => {
    const p = separatorProps({ ...c, instance: "i" })
    const none = c.decorative || c.context === "listbox"
    const own =
      c.orientation === "horizontal" || c.orientation === "vertical"
        ? c.orientation
        : c.orientation === undefined
          ? (c.defaultOrientation ?? "horizontal")
          : "horizontal"
    // Only three outcomes: role separator, role none, implicit (hr).
    expect(p["role"]).toBe(none ? "none" : c.tag === "hr" ? undefined : "separator")
    expect(p["aria-orientation"]).toBe(!none && own === "vertical" ? "vertical" : undefined)
    expect(p["data-orientation"]).toBe(own)
    expect(p["data-decorative"]).toBe(none ? "" : undefined)
    expect(p["data-scope"]).toBe("separator")
    expect(p["data-part"]).toBe("root")
  })
})

describe("named cases", () => {
  const base = { instance: "i", tag: "div" }
  it("vertical div (role + aria-orientation)", () => {
    const p = separatorProps({ ...base, orientation: "vertical" })
    expect(p["role"]).toBe("separator")
    expect(p["aria-orientation"]).toBe("vertical")
  })
  it("horizontal hr has neither role nor aria-orientation (ariakit#721)", () => {
    const p = separatorProps({ ...base, tag: "hr" })
    expect(p["role"]).toBeUndefined()
    expect(p["aria-orientation"]).toBeUndefined()
  })
  it("explicit orientation wins over the toolbar default (ariakit#6302)", () => {
    const p = separatorProps({
      ...base,
      context: "toolbar",
      defaultOrientation: "vertical",
      orientation: "horizontal",
    })
    expect(p["data-orientation"]).toBe("horizontal")
    expect(p["aria-orientation"]).toBeUndefined()
  })
  it("toolbar default is vertical (mui/base-ui#4647)", () => {
    const p = separatorProps({ ...base, context: "toolbar", defaultOrientation: "vertical" })
    expect(p["data-orientation"]).toBe("vertical")
    expect(p["aria-orientation"]).toBe("vertical")
  })
  it("listbox is always none, even vertical and labelled (mui/base-ui#5398)", () => {
    const p = separatorProps({ ...base, context: "listbox", orientation: "vertical" })
    expect(p["role"]).toBe("none")
    expect(p["aria-orientation"]).toBeUndefined()
    expect(p["data-decorative"]).toBe("")
    expect(droppedNameProps({ ...base, context: "listbox" })).toEqual([
      "aria-label",
      "aria-labelledby",
    ])
  })
  it("a host scope gives data-scope=<host> data-part=separator", () => {
    const p = separatorProps({ ...base, scope: "toolbar" })
    expect(p["data-scope"]).toBe("toolbar")
    expect(p["data-part"]).toBe("separator")
  })
  it("separatorConnect().root() uses the separator scope", () => {
    const p = separatorConnect({ ...base }).root()
    expect(p["data-scope"]).toBe("separator")
    expect(p["data-part"]).toBe("root")
  })
  it("separatorOrientation", () => {
    expect(separatorOrientation(undefined)).toBe("horizontal")
    expect(separatorOrientation(undefined, "vertical")).toBe("vertical")
    expect(separatorOrientation("diagonal", "vertical")).toBe("horizontal")
    expect(separatorOrientation("horizontal", "vertical")).toBe("horizontal")
  })
})

describe("separatorWarnings", () => {
  const base = { instance: "i", tag: "div" }
  it("an invalid orientation warns naming the value", () => {
    const w = warn()
    separatorWarnings({ ...base, orientation: "diagonal" })
    expect(w).toHaveBeenCalledTimes(1)
    expect(String(w.mock.calls[0]?.[0])).toContain('"diagonal"')
  })
  it("undefined orientation is silent (radix-ui/primitives#216)", () => {
    const w = warn()
    separatorWarnings({ ...base, orientation: undefined })
    expect(w).not.toHaveBeenCalled()
  })
  it("valid orientations are silent", () => {
    const w = warn()
    separatorWarnings({ ...base, orientation: "vertical", own: { "aria-label": "x" } })
    expect(w).not.toHaveBeenCalled()
  })
  it.each([
    ["tabIndex 0", { tabIndex: 0 }],
    ["tabIndex 2", { tabIndex: 2 }],
    ["aria-valuenow", { "aria-valuenow": 50 }],
    ["aria-valuetext", { "aria-valuetext": "half" }],
  ])("%s warns naming Splitter", (_n, own) => {
    const w = warn()
    separatorWarnings({ ...base, own })
    expect(w).toHaveBeenCalledTimes(1)
    expect(String(w.mock.calls[0]?.[0])).toContain("Splitter")
  })
  it("tabIndex -1 is silent", () => {
    const w = warn()
    separatorWarnings({ ...base, own: { tabIndex: -1 } })
    expect(w).not.toHaveBeenCalled()
  })
  it("a name on a decorative or listbox separator warns", () => {
    const w = warn()
    separatorWarnings({ ...base, decorative: true, own: { "aria-label": "x" } })
    separatorWarnings({ ...base, context: "listbox", own: { "aria-labelledby": "y" } })
    expect(w).toHaveBeenCalledTimes(2)
  })
  it("a name on a semantic separator is silent", () => {
    const w = warn()
    separatorWarnings({ ...base, own: { "aria-label": "x" } })
    expect(w).not.toHaveBeenCalled()
  })
})

describe("droppedNameProps", () => {
  it("nothing for a semantic separator, the name props for a none one", () => {
    expect(droppedNameProps({ instance: "i", tag: "div" })).toEqual([])
    expect(droppedNameProps({ instance: "i", tag: "div", decorative: true })).toEqual([
      "aria-label",
      "aria-labelledby",
    ])
  })
})
