// The `anchored` trait invariant against hand-made snapshots (no layout needed, so it runs
// the same in jsdom and in a browser).
import { describe, expect, it } from "vitest"
import type { DomSnapshot, ElementInfo } from "./collect"
import { layoutInvariant, type StepFacts } from "./invariants"

type Rect = { x: number; y: number; width: number; height: number }
const el = (part: string | null, id: string, rect: Rect, attrs: Record<string, string> = {}) =>
  ({
    describe: part ? `div#${id}[data-part=${part}]` : `button#${id}`,
    node: 0,
    rect,
    part,
    role: null,
    name: "",
    description: "",
    text: "",
    id,
    attrs,
    hidden: false,
    inAriaHidden: false,
    inInert: false,
    focusable: false,
    animations: 0,
    group: "",
    within: [],
  }) satisfies ElementInfo

const trigger = el("trigger", "t", { x: 100, y: 100, width: 60, height: 30 })

/** A placed popup of 100x50 at (x, y), with the variables the tracker writes. */
function facts(opts: {
  x: number
  y: number
  side?: string
  padding?: string
  anchorId?: string
  layout?: boolean
  extra?: ElementInfo[]
}): StepFacts {
  const style = `--rind-collision-padding: ${opts.padding ?? "8px 8px 8px 8px"}; --rind-anchor-id: ${opts.anchorId ?? "t"};`
  const popup = el(
    "positioner",
    "p",
    { x: opts.x, y: opts.y, width: 100, height: 50 },
    { style, "data-side": opts.side ?? "bottom" },
  )
  const after = {
    parts: [trigger, popup, ...(opts.extra ?? [])],
    elements: [],
    refs: [],
    duplicateIds: [],
    focus: { onBody: true, part: null, inInstance: false, element: null },
    viewport: { x: 0, y: 0, width: 800, height: 600, layout: opts.layout ?? true },
  } as unknown as DomSnapshot
  return { after, semantics: {} } as unknown as StepFacts
}
const run = (f: StepFacts) => layoutInvariant(f).join("\n")

describe("anchored layout invariant", () => {
  it("fails a popup 4 px from the right edge with padding 8, naming edge and padding", () => {
    // right edge at 796 = 4 px inside a 800 px viewport; padding 8 asks for 8.
    const out = run(facts({ x: 696, y: 200 }))
    expect(out).toMatch(/inside the right collision padding \(8 px\) by 4 px/)
    expect(out).toMatch(/collision padding/)
  })

  it("passes the same popup with padding 0", () => {
    expect(run(facts({ x: 696, y: 200, padding: "0px 0px 0px 0px" }))).toBe("")
  })

  it("does not run the side check for a point-anchored popup overlapping the trigger", () => {
    // side=bottom but the popup starts above the trigger's bottom: wrong for an element anchor.
    const f = facts({ x: 100, y: 110, anchorId: "" })
    expect(run(f)).toBe("")
  })

  it("fails an element-anchored popup on the wrong side", () => {
    expect(run(facts({ x: 100, y: 110 }))).toMatch(/is not on the bottom of .*#t/)
  })

  it("checks the arrow only against the anchor element", () => {
    const arrow = el("arrow", "ar", { x: 400, y: 190, width: 10, height: 10 })
    // The arrow tip (405) is outside the trigger (100..160): fails for an element anchor...
    expect(run(facts({ x: 100, y: 200, extra: [arrow] }))).toMatch(/does not point at/)
    // ...and is not checked for a point or virtual anchor.
    expect(run(facts({ x: 100, y: 200, anchorId: "", extra: [arrow] }))).toBe("")
  })

  it("Invariant catches an overflowing popup: names popup, side and edge", () => {
    // 20 px past the right edge (800 - 100 + 20), padding 0 as in the spec scenario.
    const out = run(facts({ x: 720, y: 200, padding: "0px" }))
    expect(out).toMatch(/positioner.*side bottom.*overflows the viewport's right edge by 20 px/)
  })

  it("Invariant in jsdom: without layout only the focus rule runs", () => {
    const f = facts({ x: 720, y: 200, layout: false })
    expect(run(f)).toBe("")
    const placing = el(
      "positioner",
      "p",
      { x: 0, y: 0, width: 0, height: 0 },
      { "data-placing": "" },
    )
    const g = facts({ x: 720, y: 200, layout: false, extra: [] })
    const after = {
      ...g.after,
      parts: [placing],
      focus: { ...g.after.focus, element: el(null, "p", placing.rect) },
    } as DomSnapshot
    expect(run({ ...g, after })).toMatch(/focus entered .* before its first placement/)
  })
})
