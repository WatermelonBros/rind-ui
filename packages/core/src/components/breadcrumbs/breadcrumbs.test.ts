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
  // Reference: the items between `before` and `n - after`, cut at the current item, kept only
  // when at least two would be hidden and the trail is longer than maxItems.
  const expected = (n: number, max: number, before: number, after: number, current: number) => {
    if (n <= max || n - before - after < 2) return []
    const out: string[] = []
    for (let i = before; i < n - after; i++) {
      if (i === current) break
      out.push(`k${i}`)
    }
    return out.length >= 2 ? out : []
  }
  for (let n = 0; n <= 8; n++) {
    for (const max of [1, 2, 3, 4, 6]) {
      for (const [before, after] of [
        [1, 1],
        [0, 1],
        [2, 1],
        [1, 2],
      ] as const) {
        for (const current of [n - 1, Math.floor(n / 2)]) {
          it(`n=${n} max=${max} before=${before} after=${after} current=${current}`, () => {
            const items = trail(n, current >= 0 ? { [current]: { current: true } } : {})
            const t = deriveTrail({
              items,
              maxItems: max,
              itemsBeforeCollapse: before,
              itemsAfterCollapse: after,
            })
            expect(t.collapsed).toEqual(expected(n, max, before, after, current))
            if (current >= 0) expect(t.collapsed).not.toContain(`k${current}`)
          })
        }
      }
    }
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
