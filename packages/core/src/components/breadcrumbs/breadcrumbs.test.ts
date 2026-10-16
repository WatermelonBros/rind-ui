// add-breadcrumbs 2.5: the trail derivation for every length and collapse setting, the part
// attributes and the development warnings (react-spectrum#2923, #6561).
import { afterEach, describe, expect, it, vi } from "vitest"
import {
  type BreadcrumbsTrailItem,
  breadcrumbsConnect,
  breadcrumbsItemState,
  deriveTrail,
} from "./breadcrumbs.connect"
import { breadcrumbsMessages } from "./breadcrumbs.messages"

const trail = (n: number, extra: Partial<Record<number, Partial<BreadcrumbsTrailItem>>> = {}) =>
  Array.from({ length: n }, (_, i) => ({ key: `k${i}`, textValue: `Item ${i}`, ...extra[i] }))

describe("deriveTrail: current item", () => {
  it("the last item by default", () => {
    expect(deriveTrail({ items: trail(3) }).currentKey).toBe("k2")
  })
  it("an explicit current wins", () => {
    expect(deriveTrail({ items: trail(3, { 1: { current: true } }) }).currentKey).toBe("k1")
  })
  it("current={false} on the last item opts out (react-spectrum#6561)", () => {
    expect(deriveTrail({ items: trail(3, { 2: { current: false } }) }).currentKey).toBeNull()
  })
  it("no items: nothing current, nothing collapsed", () => {
    expect(deriveTrail({ items: [], maxItems: 2 })).toEqual({
      currentKey: null,
      collapsed: [],
      lastVisibleKey: null,
    })
  })
})

describe("deriveTrail: collapse table (react-spectrum#2923)", () => {
  // Written by hand from the spec rule: past `maxItems`, the items between the first
  // `before` and the last `after` collapse, except the current one, and only when at least
  // two would be hidden. `current`: an explicit current index, else the last item.
  const cases: readonly {
    readonly n: number
    readonly max: number
    readonly before?: number
    readonly after?: number
    readonly current?: number
    readonly lastNotCurrent?: boolean
    readonly expected: readonly string[]
  }[] = [
    { n: 0, max: 2, expected: [] },
    { n: 1, max: 0, expected: [] },
    { n: 2, max: 1, expected: [] },
    { n: 3, max: 1, expected: [] },
    { n: 3, max: 2, expected: [] },
    { n: 4, max: 2, expected: ["k1", "k2"] },
    { n: 4, max: 4, expected: [] },
    { n: 5, max: 4, expected: ["k1", "k2", "k3"] },
    { n: 6, max: 4, expected: ["k1", "k2", "k3", "k4"] },
    { n: 8, max: 5, current: 4, expected: ["k1", "k2", "k3", "k5", "k6"] },
    { n: 8, max: 5, current: 1, expected: ["k2", "k3", "k4", "k5", "k6"] },
    { n: 6, max: 3, current: 3, expected: ["k1", "k2", "k4"] },
    { n: 4, max: 2, current: 1, expected: [] },
    { n: 5, max: 3, before: 0, after: 1, expected: ["k0", "k1", "k2", "k3"] },
    { n: 6, max: 4, before: 2, after: 1, expected: ["k2", "k3", "k4"] },
    { n: 6, max: 4, before: 1, after: 2, expected: ["k1", "k2", "k3"] },
    { n: 5, max: 4, before: 2, after: 2, expected: [] },
    { n: 5, max: 3, lastNotCurrent: true, expected: ["k1", "k2", "k3"] },
  ]
  for (const c of cases) {
    it(`n=${c.n} max=${c.max} before=${c.before ?? 1} after=${c.after ?? 1} current=${c.current ?? "last"}`, () => {
      const items = trail(c.n, {
        ...(c.current === undefined ? {} : { [c.current]: { current: true } }),
        ...(c.lastNotCurrent ? { [c.n - 1]: { current: false } } : {}),
      })
      const t = deriveTrail({
        items,
        maxItems: c.max,
        ...(c.before === undefined ? {} : { itemsBeforeCollapse: c.before }),
        ...(c.after === undefined ? {} : { itemsAfterCollapse: c.after }),
      })
      expect(t.collapsed).toEqual(c.expected)
    })
  }

  it("six items, maxItems 4: items 2–5 collapse", () => {
    expect(deriveTrail({ items: trail(6), maxItems: 4 }).collapsed).toEqual([
      "k1",
      "k2",
      "k3",
      "k4",
    ])
  })

  it("maxItems undefined shows every item", () => {
    expect(deriveTrail({ items: trail(8) }).collapsed).toEqual([])
  })

  it("the last visible item is the last one shown", () => {
    expect(deriveTrail({ items: trail(4) }).lastVisibleKey).toBe("k3")
  })
})

describe("breadcrumbsConnect", () => {
  const t = deriveTrail({ items: trail(6), maxItems: 4 })
  const api = (labelled = false) =>
    breadcrumbsConnect({ instance: "i", trail: t, labelled, label: breadcrumbsMessages.label })

  it("Root is named by the label unless labelled; data-collapsed while collapsed", () => {
    expect(api().root()).toMatchObject({
      "data-scope": "breadcrumbs",
      "data-part": "root",
      "aria-label": "Breadcrumbs",
      "data-collapsed": "",
    })
    expect(api(true).root()["aria-label"]).toBeUndefined()
  })

  it("a collapsed Item is hidden with data-collapsed; the current one has data-current", () => {
    const collapsed = breadcrumbsItemState(t, "k2", false, "page")
    expect(api().item(collapsed)).toMatchObject({ hidden: true, "data-collapsed": "" })
    const current = breadcrumbsItemState(t, "k5", false, "page")
    expect(api().item(current)).toMatchObject({ "data-current": "" })
    expect(api().item(current)["hidden"]).toBeUndefined()
  })

  it("the current text: aria-current, tabindex -1, no role", () => {
    const s = breadcrumbsItemState(t, "k5", false, "location")
    const props = api().currentText(s)
    expect(props).toMatchObject({ "aria-current": "location", tabIndex: -1, "data-current": "" })
    expect(props["role"]).toBeUndefined()
    expect(api().currentText(breadcrumbsItemState(t, "k5", false, true))["aria-current"]).toBe(
      "true",
    )
  })

  it("separators are aria-hidden; data-last only in the last visible Item", () => {
    expect(api().separator(breadcrumbsItemState(t, "k0", false, "page"))).toMatchObject({
      "aria-hidden": "true",
    })
    expect(
      api().separator(breadcrumbsItemState(t, "k0", false, "page"))["data-last"],
    ).toBeUndefined()
    expect(api().separator(breadcrumbsItemState(t, "k5", false, "page"))["data-last"]).toBe("")
  })

  it("the Ellipsis exists only while collapsed, with its count", () => {
    expect(api().ellipsis("Show 4 more breadcrumbs")).toMatchObject({
      "data-part": "ellipsis",
      "data-count": "4",
    })
    const none = breadcrumbsConnect({
      instance: "i",
      trail: deriveTrail({ items: trail(3) }),
      labelled: false,
      label: "Breadcrumbs",
    })
    expect(none.ellipsis("x")).toBeNull()
  })
})

describe("messages", () => {
  it("pluralises the ellipsis label", () => {
    expect(breadcrumbsMessages.showCollapsed(1)).toBe("Show 1 more breadcrumb")
    expect(breadcrumbsMessages.showCollapsed(2)).toBe("Show 2 more breadcrumbs")
  })
})

describe("development warnings", () => {
  afterEach(() => vi.restoreAllMocks())

  it("warns for Breadcrumbs inside a listbox popup (react-spectrum#7790)", async () => {
    const { warnBreadcrumbsInPopup } = await import("./breadcrumbs.connect")
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    const root = { getAttribute: () => "nav-1", parentElement: { closest: () => ({}) } }
    warnBreadcrumbsInPopup(root as unknown as Element) // a minimal element: only these reads
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('"nav-1"'))
  })

  it("warns for a current Item without aria-current", async () => {
    const { warnCurrentWithoutAria } = await import("./breadcrumbs.connect")
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    const item = { hasAttribute: () => false, querySelector: () => null, textContent: "Docs" }
    warnCurrentWithoutAria(item as unknown as Element) // a minimal element: only these reads
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("aria-current"))
  })
})
