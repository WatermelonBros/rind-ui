// The collection-related generic/trait invariants against hand-written DOM.
import type { Trait } from "@rind-ui/core"
import { afterEach, describe, expect, it } from "vitest"
import { collectDom } from "./collect"
import { type StepFacts, traitInvariants } from "./invariants"

const part = (name: string, attrs = "") =>
  `data-scope="x" data-instance="i" data-part="${name}" ${attrs}`

function base(over: Partial<StepFacts> = {}): StepFacts {
  const after = collectDom({ scope: "x", instance: "i" })
  return {
    before: null,
    after,
    baseline: after,
    from: null,
    state: "open",
    open: true,
    expected: () => ({ dataState: undefined }),
    atInitial: false,
    anchorCount: 1,
    errors: [],
    traits: [],
    semantics: {},
    values: {},
    ...over,
  }
}
function facts(html: string, over: Partial<StepFacts> = {}): StepFacts {
  document.body.innerHTML = html
  return base(over)
}
const trait = (name: Trait, f: StepFacts) => traitInvariants[name]?.(f) ?? []
const item = (key: string, attrs = "") =>
  `<div ${part("item", `id="i-${key}" role="option" data-key="${key}" ${attrs}`)}>${key}</div>`

afterEach(() => {
  document.body.innerHTML = ""
})

describe("composite-roving (collections)", () => {
  it("the container is the stop when no item is navigable", () => {
    const f = facts(
      `<div ${part("list", 'tabindex="0"')}>${item("a", 'tabindex="-1" aria-disabled="true"')}</div>`,
    )
    expect(trait("composite-roving", f)).toEqual([])
  })

  it("no stop at all (container not tabbable either) fails", () => {
    const f = facts(`<div ${part("list", 'tabindex="-1"')}>${item("a", 'tabindex="-1"')}</div>`)
    expect(trait("composite-roving", f)[0]).toMatch(/0 items have tabindex="0"/)
  })

  it("item-control elements are not counted (controls inside a row)", () => {
    const f = facts(
      `<div ${part("list")}>${item("a", 'tabindex="0"')}` +
        `<button ${part("item-control", 'tabindex="0"')}>x</button>` +
        `${item("b", 'tabindex="-1"')}</div>`,
    )
    expect(trait("composite-roving", f)).toEqual([])
  })

  it("focus on body after an item with focus was removed fails", () => {
    document.body.innerHTML = `<div ${part("list")}>${item("a", 'tabindex="0"')}${item("b", 'tabindex="-1"')}</div>`
    document.body.querySelector<HTMLElement>('[data-key="a"]')?.focus()
    const before = collectDom({ scope: "x", instance: "i" })
    expect(before.focus.inInstance).toBe(true)
    document.body.querySelector('[data-key="a"]')?.remove()
    document.body.querySelector('[data-key="b"]')?.setAttribute("tabindex", "0")
    const out = trait("composite-roving", base({ before }))
    expect(out.some((m) => /focus fell to <body>/.test(m))).toBe(true)
  })
})

describe("highlight checks", () => {
  it("two highlighted items fail naming both", () => {
    const f = facts(
      `<div ${part("list")}>${item("a", "data-highlighted")}${item("b", "data-highlighted")}</div>`,
    )
    for (const name of ["composite-roving", "composite-activedescendant"] as const) {
      const msg = trait(name, f).find((m) => /data-highlighted/.test(m)) ?? ""
      expect(msg).toMatch(/^2 items are data-highlighted/)
      expect(msg).toContain("div#i-a")
      expect(msg).toContain("div#i-b")
    }
  })

  it("a mismatch with context.highlightedKey fails; a match and null pass", () => {
    const html = `<div ${part("list", 'tabindex="-1"')}>${item("a", 'tabindex="0" data-highlighted')}${item("b", 'tabindex="-1"')}</div>`
    const bad = trait("composite-roving", facts(html, { context: { highlightedKey: "b" } }))
    expect(bad).toEqual([`the highlighted item is "a", the machine's is "b"`])
    expect(trait("composite-roving", facts(html, { context: { highlightedKey: "a" } }))).toEqual([])
    const none = trait("composite-roving", facts(html, { context: { highlightedKey: null } }))
    expect(none[0]).toMatch(/is "a", the machine's is none/)
    const lit = facts(`<div ${part("list", 'tabindex="0"')}>${item("a", 'tabindex="-1"')}</div>`, {
      context: { highlightedKey: "a" },
    })
    expect(trait("composite-roving", lit)[0]).toMatch(/is none, the machine's is "a"/)
  })
})

describe("selectable (collections)", () => {
  const sel = (key: string, on: boolean, extra = "") =>
    item(key, `aria-selected="${on}" ${on ? "data-selected" : ""} ${extra}`)

  it("a disabled item added by the step fails; an already selected one passes", () => {
    document.body.innerHTML = `<div ${part("list")}>${sel("a", false, 'aria-disabled="true"')}</div>`
    const before = collectDom({ scope: "x", instance: "i" })
    document.body.innerHTML = `<div ${part("list")}>${sel("a", true, 'aria-disabled="true"')}</div>`
    const out = trait("selectable", base({ before }))
    expect(out.some((m) => /disabled but the step added it/.test(m))).toBe(true)
    // Already selected before the step: not "added".
    const stay = trait("selectable", base({ before: base().after }))
    expect(stay).toEqual([])
  })

  it("values are compared only for rendered items", () => {
    const f = facts(`<div ${part("list")}>${sel("a", true)}${sel("b", false)}</div>`, {
      values: { value: ["a", "z"] },
    })
    // "z" is not rendered (filtered/virtualized): ignored.
    expect(trait("selectable", f)).toEqual([])
    const bad = facts(`<div ${part("list")}>${sel("a", true)}${sel("b", false)}</div>`, {
      values: { value: ["b"] },
    })
    expect(trait("selectable", bad)[0]).toMatch(/differ from the machine's value \[b\]/)
  })

  it("falls back to data-key when items have no data-value", () => {
    const f = facts(`<div ${part("list")}>${sel("a", true)}${sel("b", false)}</div>`, {
      values: { value: "b" },
    })
    expect(trait("selectable", f)[0]).toMatch(/\[a\].*\[b\]/)
    const withValue = facts(
      `<div ${part("list")}>${sel("a", true, 'data-value="v1"')}${sel("b", false, 'data-value="v2"')}</div>`,
      { values: { value: "v1" } },
    )
    expect(trait("selectable", withValue)).toEqual([])
  })

  it("value 'all' is not compared", () => {
    const f = facts(`<div ${part("list", 'aria-multiselectable="true"')}>${sel("a", true)}</div>`, {
      values: { value: "all" },
    })
    expect(trait("selectable", f)).toEqual([])
  })
})

describe("set-metadata (collection size)", () => {
  const row = (pos: number, size: number) =>
    item(`k${pos}`, `aria-posinset="${pos}" aria-setsize="${size}"`)

  it("setsize must equal the collection size (virtualized windows included)", () => {
    const ok = facts(`<div ${part("list")}>${row(5, 100)}${row(6, 100)}</div>`, {
      collectionSize: 100,
    })
    expect(trait("set-metadata", ok)).toEqual([])
    const bad = facts(`<div ${part("list")}>${row(1, 2)}${row(2, 2)}</div>`, {
      collectionSize: 3,
    })
    const out = trait("set-metadata", bad)
    expect(out).toHaveLength(2)
    expect(out[0]).toMatch(/aria-setsize=2, the collection has 3 items/)
  })

  it("tree items (aria-level) are exempt from the size check", () => {
    const f = facts(
      `<div ${part("list")}>${item("a", 'aria-level="1" aria-posinset="1" aria-setsize="2"')}</div>`,
      { collectionSize: 9 },
    )
    expect(trait("set-metadata", f)).toEqual([])
  })

  it("without collectionSize nothing is compared", () => {
    expect(trait("set-metadata", facts(`<div ${part("list")}>${row(1, 7)}</div>`))).toEqual([])
  })
})
