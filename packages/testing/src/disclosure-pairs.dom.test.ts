// The generic disclosure and presence traits check each trigger-content pair (aria-controls)
// when an instance has several triggers (an accordion).
import { afterEach, describe, expect, it } from "vitest"
import { collectDom } from "./collect"
import { type StepFacts, traitInvariants } from "./invariants"

const part = (name: string, attrs = "") =>
  `data-scope="x" data-instance="i" data-part="${name}" ${attrs}`

/** Two disclosures: `a` and `b`, each with its expanded flag and whether its content is hidden. */
function pairs(a: { open: boolean; hidden: boolean }, b: { open: boolean; hidden: boolean }) {
  const one = (id: string, p: { open: boolean; hidden: boolean }) =>
    `<button ${part("trigger", `aria-expanded="${p.open}" aria-controls="c-${id}"`)}>${id}</button>` +
    `<div ${part("content", `id="c-${id}" data-state="${p.open ? "open" : "closed"}"${p.hidden ? ' hidden=""' : ""}`)}>text</div>`
  document.body.innerHTML = one("A", a) + one("B", b)
  const after = collectDom({ scope: "x", instance: "i" })
  return {
    before: null,
    after,
    baseline: after,
    from: null,
    state: "closed",
    open: false,
    expected: () => ({}),
    atInitial: false,
    anchorCount: 1,
    errors: [],
    traits: [],
    semantics: { trigger: "trigger", content: "content" },
    values: {},
  } as StepFacts
}

afterEach(() => {
  document.body.innerHTML = ""
})

describe("disclosure and presence on several trigger-content pairs", () => {
  const consistent = pairs({ open: true, hidden: false }, { open: false, hidden: true })

  it("a consistent instance has no failure", () => {
    expect(traitInvariants.disclosure?.(consistent)).toEqual([])
    expect(traitInvariants.presence?.(consistent)).toEqual([])
  })

  it("an expanded trigger whose content is hidden fails naming the pair", () => {
    const out = traitInvariants.disclosure?.(
      pairs({ open: true, hidden: true }, { open: false, hidden: true }),
    )
    expect(out).toHaveLength(1)
    expect(out?.[0]).toMatch(/hidden while .*expanded/)
    expect(out?.[0]).toContain("A")
  })

  it("a collapsed trigger whose content is visible fails, only for that pair", () => {
    const f = pairs({ open: true, hidden: false }, { open: false, hidden: false })
    const out = traitInvariants.disclosure?.(f)
    expect(out).toHaveLength(1)
    expect(out?.[0]).toMatch(/still visible while .*collapsed/)
    expect(out?.[0]).toContain("c-B")
  })

  it("presence judges only the contents of collapsed triggers", () => {
    // B is collapsed but still mounted with data-state=closed and no animation: fails;
    // A is open and mounted: fine.
    const out = traitInvariants.presence?.(
      pairs({ open: true, hidden: false }, { open: false, hidden: false }),
    )
    expect(out).toHaveLength(1)
    expect(out?.[0]).toContain("c-B")
  })
})
