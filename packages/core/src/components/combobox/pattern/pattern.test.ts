// combobox-pattern derivations in Node: query, filtering, exposure, completion, exact match.
import { describe, expect, it } from "vitest"
import { createListCollection } from "../../../collection/list"
import {
  completion,
  exactMatch,
  isEmptyState,
  isExposed,
  isStale,
  listedPositions,
  patternQuery,
  patternResults,
} from "./pattern"

const cities = (names: string[], sections?: (string | undefined)[]) =>
  createListCollection({
    items: names.map((n, i) => ({ n, s: sections?.[i] })),
    getKey: (x) => x.n.toLowerCase(),
    getText: (x) => x.n,
    getSection: (x) => (x.s ? { key: x.s, label: x.s } : undefined),
  })

describe("query and results", () => {
  it("a trigger or arrow open with nothing typed shows everything (showAllItems)", () => {
    expect(patternQuery({ inputValue: "Italy", dirty: false, openReason: "trigger" })).toBe("")
    expect(patternQuery({ inputValue: "Italy", dirty: false, openReason: "arrow" })).toBe("")
    expect(patternQuery({ inputValue: "it", dirty: true, openReason: "trigger" })).toBe("it")
    expect(patternQuery({ inputValue: "it", dirty: true, openReason: "input" })).toBe("it")
  })

  it("accents and case are ignored", () => {
    const c = cities(["São Paulo", "Rome"])
    expect(patternResults(c, "sao", undefined, "pt-BR").size).toBe(1)
  })

  it("filter null means off (mui/base-ui#4196)", () => {
    const c = cities(["Rome", "Paris"])
    expect(patternResults(c, "zz", null, "en").size).toBe(2)
  })

  it("empty sections are hidden", () => {
    const c = cities(["Rome", "Paris"], ["IT", "FR"])
    const r = patternResults(c, "ro", undefined, "en")
    expect([...r].map((n) => n.key)).toEqual(["IT", "rome"])
  })
})

describe("exposure and empty state", () => {
  const empty = cities([])
  it("empty settled results hide the list but keep the popup open", () => {
    expect(isExposed({ open: true, results: empty, query: "x" })).toBe(false)
    expect(isEmptyState({ open: true, results: empty, query: "x" })).toBe(true)
  })

  it("stale or loading results are not the empty state", () => {
    expect(isStale({ query: "rom", itemsQuery: "ro" })).toBe(true)
    expect(isEmptyState({ open: true, results: empty, query: "rom", itemsQuery: "ro" })).toBe(false)
    expect(isEmptyState({ open: true, results: empty, query: "x", loading: "loading" })).toBe(false)
  })
})

describe("inline completion", () => {
  it("completes a prefix, keeping the typed text", () => {
    expect(completion("ca", "Canada", "en")).toBe("canada")
  })

  it("refuses when the option does not start with the query", () => {
    expect(completion("na", "Canada", "en")).toBe(null)
  })

  it("refuses decomposed accents (ariakit#6315)", () => {
    expect(completion("café", "Cafeteria", "en")).toBe(null)
  })
})

describe("exact text match", () => {
  it("one option matches case and accent blind", () => {
    expect(exactMatch(cities(["Rome", "Paris"]), "rome", "en")).toBe("rome")
  })

  it("two options with the same text: none (react-spectrum#7387)", () => {
    const c = createListCollection({
      items: [
        { k: "a", t: "Alex Kim" },
        { k: "b", t: "Alex Kim" },
      ],
      getKey: (x) => x.k,
      getText: (x) => x.t,
    })
    expect(exactMatch(c, "Alex Kim", "en")).toBe(null)
  })
})

describe("set metadata", () => {
  it("a group then loose options: 1 to 5 (ariakit#6301)", () => {
    const c = cities(["A", "B", "C", "D", "E"], ["G", "G", undefined, undefined, undefined])
    expect([...listedPositions(c).values()]).toEqual([1, 2, 3, 4, 5])
  })
})
