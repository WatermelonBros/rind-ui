import { describe, expect, it } from "vitest"
import { collator as searchCollator } from "../i18n/messages"
import { toKey } from "./key"
import { createListCollection } from "./list"
import { navigableWhen } from "./navigation"
import { idleTypeahead, type TypeaheadOptions, type TypeaheadState, typeahead } from "./typeahead"

interface Row {
  text: string
  disabled?: boolean
  keywords?: string[]
}

const list = (rows: (string | Row)[]) =>
  createListCollection<Row>({
    items: rows.map((r) => (typeof r === "string" ? { text: r } : r)),
    getKey: (r) => r.text,
    getText: (r) => r.text,
    getKeywords: (r) => r.keywords ?? [],
    isDisabled: (r) => r.disabled === true,
  })

const options = (over: Partial<TypeaheadOptions> = {}): TypeaheadOptions => ({
  timeout: 1000,
  collator: searchCollator("en"),
  navigable: navigableWhen(false),
  ...over,
})

/** Types chars 10 ms apart, moving the highlight to each match like the machine does. */
function type(
  rows: (string | Row)[],
  chars: string[],
  start: string | null = null,
  o: TypeaheadOptions = options(),
  startState: TypeaheadState = idleTypeahead,
) {
  const c = list(rows)
  let state = startState
  let from = start === null ? null : toKey(start)
  const trail: (string | null)[] = []
  const consumed: boolean[] = []
  let t = 0
  for (const char of chars) {
    t += 10
    const r = typeahead(state, { char, now: t }, c, from, o)
    state = r.state
    if (r.key !== null) from = r.key
    trail.push(r.key)
    consumed.push(r.consumed)
  }
  return { state, from, trail, consumed }
}

describe("typeahead", () => {
  it("Space inside a search: Item 10, Space consumed", () => {
    const r = type(["Item 1", "Item 10", "Other"], ["I", "t", "e", "m", " ", "1", "0"])
    expect(r.from).toBe("Item 10")
    expect(r.consumed[4]).toBe(true)
  })

  it("Space with no search is not consumed and starts nothing", () => {
    const r = type(["Item 1"], [" "])
    expect(r.consumed).toEqual([false])
    expect(r.trail).toEqual([null])
    expect(r.state).toEqual(idleTypeahead)
  })

  it("Accent-insensitive", () => {
    const r = type(["Bureau", "École"], ["e"], null, options({ collator: searchCollator("fr") }))
    expect(r.from).toBe("École")
  })

  it("Repeated letter cycles", () => {
    const r = type(["Dog", "Duck", "Deer"], ["d", "d", "d"])
    expect(r.trail).toEqual(["Dog", "Duck", "Deer"])
  })

  it("Repeated letters that form a word", () => {
    const r = type(["Apple", "Aaron"], ["a", "a"])
    expect(r.trail).toEqual(["Apple", "Aaron"])
    expect(r.from).toBe("Aaron")
  })

  it("Growing query stays, never bouncing back", () => {
    const r = type(["Bob A", "Bob B"], ["B", "o", "b", " ", "B"])
    expect(r.trail.slice(0, 4)).toEqual(["Bob A", "Bob A", "Bob A", "Bob A"])
    expect(r.trail[4]).toBe("Bob B")
    const grow = type(["Bob A", "Bob B"], ["B", "o", "b", " ", "A"])
    expect(grow.trail[4]).toBe("Bob A")
  })

  it("Timeout: a 1100 ms gap starts a new search", () => {
    const c = list(["ba", "b", "a"])
    const o = options()
    const first = typeahead(idleTypeahead, { char: "b", now: 0 }, c, null, o)
    expect(first.state.buffer).toBe("b")
    const late = typeahead(first.state, { char: "a", now: 1100 }, c, first.key, o)
    expect(late.state.buffer).toBe("a")
    expect(late.key).toBe("a")
    const soon = typeahead(first.state, { char: "a", now: 900 }, c, first.key, o)
    expect(soon.state.buffer).toBe("ba")
    expect(soon.key).toBe("ba")
  })

  it("No match: highlight unchanged, state reset, next char starts anew", () => {
    const c = list(["apple", "xylophone"])
    const o = options()
    const miss = typeahead(idleTypeahead, { char: "q", now: 0 }, c, toKey("apple"), o)
    expect(miss.key).toBeNull()
    expect(miss.state).toEqual(idleTypeahead)
    expect(miss.consumed).toBe(true)
    const next = typeahead(miss.state, { char: "x", now: 10 }, c, toKey("apple"), o)
    expect(next.state.buffer).toBe("x")
    expect(next.key).toBe("xylophone")
  })

  it("Disabled skipped unless navigable", () => {
    const rows = ["Alpha", { text: "Apex", disabled: true }, "Beta"]
    expect(type(rows, ["a", "p"], "Alpha").from).toBe("Alpha")
    expect(type(rows, ["a"], "Alpha").from).toBe("Alpha")
    const focusable = options({ navigable: navigableWhen(true) })
    expect(type(rows, ["a"], "Alpha", focusable).from).toBe("Apex")
  })

  it("wraps from the end to the start", () => {
    expect(type(["Apple", "Beta", "Avocado"], ["a"], "Avocado").from).toBe("Apple")
  })

  it("Keywords are not typeahead", () => {
    const r = type([{ text: "Settings", keywords: ["preferences"] }, "Profile"], ["p"])
    expect(r.from).toBe("Profile")
  })

  it("a single character searches after the highlight", () => {
    expect(type(["Apple", "Avocado"], ["a"], "Apple").from).toBe("Avocado")
  })
})
