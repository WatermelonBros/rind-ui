// Announcement parity per platform (round 2 E1): item, count and section announcements.
import { type PlatformFlags, platforms, withEngine } from "@rind-ui/core"
import { describe, expect, it } from "vitest"
import { collectDom, type DomSnapshot } from "./collect"
import { checkGeneric, type StepFacts } from "./invariants"

const attrs = (part: string, extra = "") =>
  `data-scope="x" data-instance="i" data-part="${part}" ${extra}`
/** A combobox with two sections; `h` is the highlighted option index (-1: none). */
const snap = (h: number): DomSnapshot => {
  const option = (i: number) =>
    `<div role="option" tabindex="-1" aria-selected="false" id="o${i}" ${attrs("item", i === h ? "data-highlighted data-focus-visible" : "")}>O${i}</div>`
  document.body.innerHTML =
    `<input role="combobox" aria-label="F" aria-controls="l" ${attrs("input")} ${h >= 0 ? `aria-activedescendant="o${h}"` : ""}>` +
    `<div role="listbox" aria-label="L" id="l" ${attrs("listbox")}>` +
    `<div role="group" aria-label="Fruit">${[0, 1].map(option).join("")}</div>` +
    `<div role="group" aria-label="Veg">${[2, 3].map(option).join("")}</div></div>`
  return collectDom({ scope: "x", instance: "i" })
}
function parity(
  from: number,
  to: number,
  platform: PlatformFlags,
  said: string[],
  section = true,
): string[] {
  const before = snap(from)
  const after = snap(to)
  const facts: StepFacts = {
    before,
    after,
    baseline: after,
    from: "open",
    state: "open",
    expected: () => ({}),
    open: true,
    atInitial: false,
    anchorCount: 1,
    errors: [],
    traits: ["composite-activedescendant"],
    semantics: {},
    values: {},
    modality: "keyboard",
    platform,
    stepAnnouncements: said.map((message) => ({ message, priority: "polite" })),
    observed: { h: `O${to}`, section: to < 2 ? "Fruit" : "Veg" },
    announcements: {
      focusAnnouncement: (o: never) => (o as { h: string }).h,
      countAnnouncement: () => "4 results",
      selectionAnnouncement: () => "",
      ...(section
        ? { sectionAnnouncement: (o: never) => `${(o as { section: string }).section}, 2 options` }
        : {}),
    },
  }
  return [...checkGeneric(facts)].filter((m) => m.startsWith("announcement-parity"))
}
const safari = platforms.apple
const chromeMac = withEngine(platforms.apple, "blink")

describe("announcement parity", () => {
  it("Safari: entering a section announces the section and the item — passes", () => {
    expect(parity(-1, 0, safari, ["Fruit, 2 options", "O0"])).toEqual([])
    expect(parity(1, 2, safari, ["Veg, 2 options", "O2"])).toEqual([])
  })

  it("Safari: a stale item announcement besides the right one fails", () => {
    expect(parity(0, 1, safari, ["O0", "O1"])).toEqual([
      'announcement-parity: expected exactly one item announcement, the focus announcement "O1"; heard ["O0","O1"]',
    ])
  })

  it("Safari: a missing section announcement fails", () => {
    expect(parity(1, 2, safari, ["O2"])).toEqual([
      'announcement-parity: expected the section announcement "Veg, 2 options", heard ["O2"]',
    ])
  })

  it("Chrome on macOS: section only, no item (RA PR #10503) — passes; an item fails", () => {
    expect(parity(1, 2, chromeMac, ["Veg, 2 options"])).toEqual([])
    expect(parity(1, 2, chromeMac, ["Veg, 2 options", "O2"])[0]).toContain("double speech")
  })

  it("Windows: no section and no item; another item's name also counts as double speech", () => {
    expect(parity(1, 2, platforms.windows, [])).toEqual([])
    expect(parity(1, 2, platforms.windows, ["O3"])[0]).toContain('announced ["O3"]')
    expect(parity(1, 2, platforms.windows, ["Veg, 2 options"])[0]).toContain(
      'announced the section "Veg, 2 options"',
    )
  })

  it("without a declared section announcement, other messages are not checked", () => {
    expect(parity(1, 2, safari, ["Veg, 4 options", "O2"], false)).toEqual([])
  })
})
