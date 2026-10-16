// Each invariant against a hand-written DOM that violates it, and one that does not.
import type { Trait } from "@rind-ui/core"
import { afterEach, describe, expect, it } from "vitest"
import { collectDom, type DomSnapshot } from "./collect"
import { checkGeneric, genericInvariants, type StepFacts, traitInvariants } from "./invariants"

const part = (name: string, attrs = "") =>
  `data-scope="x" data-instance="i" data-part="${name}" ${attrs}`

/** Expectations as the runner builds them from a contract's data-state. */
function ds(value: string | Record<string, string>): Pick<StepFacts, "expected" | "open"> {
  return {
    open: typeof value === "string" ? value === "open" : Object.values(value).includes("open"),
    expected: (el) => ({
      dataState:
        el.part === null
          ? undefined
          : typeof value === "string"
            ? el.part === "item"
              ? undefined
              : value
            : value[el.part],
    }),
  }
}

/** Renders `html`, then collects facts for it. */
function facts(html: string, over: Partial<StepFacts> = {}): StepFacts {
  document.body.innerHTML = html
  return base(over)
}

/** Facts for the current DOM, without re-rendering it. */
function base(over: Partial<StepFacts> = {}): StepFacts {
  const after = collectDom({ scope: "x", instance: "i" })
  return {
    before: null,
    after,
    baseline: after,
    from: null,
    state: "open",
    ...ds("open"),
    atInitial: false,
    anchorCount: 1,
    errors: [],
    traits: [],
    semantics: { trigger: "trigger", content: "content" },
    values: {},
    ...over,
  }
}
const ids: Record<string, string> = {
  noErrors: "no-errors",
  dataState: "data-state",
  machineAttrs: "machine-attrs",
  labelText: "label-text",
  nameSourcesNotInert: "name-sources-not-inert",
  stateAttrs: "state-attrs",
  hiddenFocus: "hidden-focus",
  focusKept: "focus-kept",
  liveRegions: "live-regions",
  documentClean: "document-clean",
  nameNotDescription: "name-not-description",
}
const generic = (name: string, f: StepFacts) =>
  (genericInvariants as Record<string, ((f: StepFacts) => readonly string[]) | undefined>)[
    ids[name] ?? name
  ]?.(f) ?? []
const trait = (name: Trait, f: StepFacts) => traitInvariants[name]?.(f) ?? []

afterEach(() => {
  document.body.innerHTML = ""
  document.documentElement.removeAttribute("aria-hidden")
})

describe("generic invariants", () => {
  it("unnamed control fails naming the part", () => {
    const out = generic("names", facts(`<button ${part("trigger")}></button>`))
    expect(out[0]).toMatch(/data-part=trigger.*no accessible name/)
    expect(generic("names", facts(`<button ${part("trigger")}>Ok</button>`))).toEqual([])
  })

  it("dangling relation fails naming the attribute and the id", () => {
    const out = generic(
      "refs",
      facts(`<button ${part("trigger", 'aria-controls="gone"')}>A</button>`),
    )
    expect(out[0]).toMatch(/aria-controls="gone".*no element has id "gone"/)
  })

  it("duplicate ids fail", () => {
    const out = generic(
      "refs",
      facts(`<div ${part("root")}><span id="d">a</span></div><span id="d">b</span>`),
    )
    expect(out).toContain('id "d" is not unique in the document')
  })

  it("name sources inside inert fail", () => {
    const out = generic(
      "nameSourcesNotInert",
      facts(
        `<div inert><span id="l">Label</span></div><button ${part("trigger", 'aria-labelledby="l"')}></button>`,
      ),
    )
    expect(out[0]).toMatch(/inside an inert subtree/)
  })

  it("aria and data state attributes must agree", () => {
    const out = generic(
      "stateAttrs",
      facts(
        `<button ${part("trigger", 'aria-expanded="true" data-state="closed" aria-disabled="true"')}>A</button>`,
      ),
    )
    expect(out).toHaveLength(2)
  })

  it("focus inside aria-hidden fails; focusable inside aria-hidden fails", () => {
    const f = facts(`<div ${part("root", 'aria-hidden="true"')}><button>A</button></div>`)
    expect(generic("hiddenFocus", f)[0]).toMatch(/focusable inside aria-hidden/)
  })

  it("focus leaving the component fails", () => {
    const inside = facts(`<button ${part("trigger")}>A</button>`)
    ;(document.querySelector("button") as HTMLElement).focus()
    const before = collectDom({ scope: "x", instance: "i" })
    ;(document.activeElement as HTMLElement).blur()
    const after = collectDom({ scope: "x", instance: "i" })
    expect(generic("focusKept", { ...inside, before, after })[0]).toMatch(
      /focus left the component/,
    )
  })

  it("own live regions fail without the live-region trait", () => {
    const f = facts(`<div ${part("root")}><div role="status">x</div></div>`)
    expect(generic("liveRegions", f)[0]).toMatch(/live region/)
    expect(generic("liveRegions", { ...f, traits: ["live-region"] })).toEqual([])
  })

  it("aria-hidden on <html> fails; leftovers outside the parts fail once closed", () => {
    const baseline = facts(`<button ${part("trigger")}>A</button>`).after
    document.documentElement.setAttribute("aria-hidden", "true")
    document.body.style.overflow = "hidden"
    const f = facts(`<button ${part("trigger")}>A</button>`, { baseline, atInitial: true })
    const out = generic("documentClean", f)
    expect(out).toContain("<html> has aria-hidden")
    // Names the element, the property and both values (radix#1241).
    expect(out).toContain('<body> style overflow: "hidden" was not restored to ""')
    document.body.removeAttribute("style")
  })

  it("identical name and description fail", () => {
    const f = facts(
      `<span id="d">Save</span><button ${part("trigger", 'aria-describedby="d"')}>Save</button>`,
    )
    expect(generic("nameNotDescription", f)[0]).toMatch(/both "Save"/)
  })

  it("anchor count and errors", () => {
    const f = facts("<div></div>", { anchorCount: 2, errors: ["boom"] })
    expect(generic("anchor", f)[0]).toMatch(/found 2/)
    expect(generic("noErrors", f)[0]).toMatch(/boom/)
  })
})

describe("accessible names (dom-accessibility-api)", () => {
  const cases: [string, string][] = [
    [`<button ${part("p", 'id="t"')}><img alt="Close" src="x.png"></button>`, "Close"],
    [`<input type="button" value="Go" ${part("p", 'id="t"')}>`, "Go"],
    [`<input type="submit" ${part("p", 'id="t"')}>`, "Submit"],
    [`<input type="image" alt="Go" ${part("p", 'id="t"')}>`, "Go"],
    [`<button ${part("p", 'id="t"')}><span hidden>Close</span></button>`, ""],
    [`<button ${part("p", 'id="t"')}><span style="display:none">Close</span></button>`, ""],
    [`<label for="t">Country</label><div role="combobox" ${part("p", 'id="t"')}></div>`, ""],
    [`<label for="t">A</label><label for="t">B</label><input ${part("p", 'id="t"')}>`, "A B"],
  ]
  it.each(cases)("%s → %j", (html, name) => {
    const f = facts(html)
    expect(f.after.parts[0]?.name).toBe(name)
  })
})

describe("review fixes", () => {
  it("aria-live=off is not a live region", () => {
    expect(
      generic("liveRegions", facts(`<div ${part("root", 'aria-live="off"')}>x</div>`)),
    ).toEqual([])
  })

  it("labelText checks the label's text against what it labels", () => {
    const f = facts(
      `<span ${part("label", 'id="lab"')}>Email</span><input ${part("input", 'aria-labelledby="lab" aria-label="Wrong"')}>`,
      { semantics: { label: "label" } },
    )
    expect(generic("labelText", f)).toEqual([])
    const g = facts(
      `<span ${part("label", 'id="lab"')}>Email</span><input ${part("input", 'aria-labelledby="lab other"')}><span id="other">x</span>`,
      { semantics: { label: "label" } },
    )
    expect(generic("labelText", g)).toEqual([])
  })

  it("dataState skips items and accepts per-part values", () => {
    const f = facts(
      `<div ${part("root", 'data-state="open"')}></div><div ${part("item", 'data-state="closed"')}>a</div><div ${part("trigger", 'data-state="active"')}>t</div>`,
      { ...ds({ root: "open", trigger: "active" }) },
    )
    expect(generic("dataState", f)).toEqual([])
  })

  it("aria-checked agrees with data-state", () => {
    const f = facts(
      `<button ${part("p", 'role="checkbox" aria-checked="true" data-state="unchecked"')}>x</button>`,
    )
    expect(generic("stateAttrs", f)[0]).toMatch(/aria-checked="true"/)
  })

  it("leftovers on body's other children fail once back in the initial state", () => {
    const baseline = facts(`<main>app</main><div ${part("root")}>x</div>`).after
    document.querySelector("main")?.setAttribute("aria-hidden", "true")
    const out = generic("documentClean", { ...base(), baseline, atInitial: true })
    expect(out).toContainEqual(
      expect.stringMatching(/main inert|main aria-hidden="true" was not restored/),
    )
  })

  it("activedescendant must point inside the controlled popup", () => {
    const f = facts(
      `<input aria-label="x" ${part("input", 'aria-activedescendant="o1" aria-controls="pop"')}>` +
        `<div id="pop" ${part("content")}></div><div id="o1" data-highlighted ${part("item", 'role="option" tabindex="-1"')}>a</div>`,
    )
    expect(
      trait("composite-activedescendant", f).some((m) => /outside the controlled popup/.test(m)),
    ).toBe(true)
  })

  it("selectable: the selected set equals the machine value", () => {
    const f = facts(
      `<div ${part("item", 'role="option" aria-selected="true" data-selected data-value="a"')}>a</div>` +
        `<div ${part("item", 'role="option" aria-selected="false" data-value="b"')}>b</div>`,
      { values: { value: "b" } },
    )
    expect(trait("selectable", f).some((m) => /differ from the machine's value/.test(m))).toBe(true)
  })
})

describe("second-pass review (invariants)", () => {
  it("items are checked against their own declared state; a declared part without data-state fails", () => {
    const f = facts(
      `<div ${part("item", 'data-value="a" data-state="active"')}>a</div>` +
        `<div ${part("item", 'data-value="b" data-state="active"')}>b</div>` +
        `<div ${part("list")}>l</div>`,
      {
        expected: (el) =>
          el.part === "item"
            ? { dataState: el.attrs["data-value"] === "a" ? "active" : "inactive" }
            : el.part === "list"
              ? { dataState: "idle" }
              : {},
      },
    )
    const out = generic("dataState", f)
    expect(out.some((m) => /data-value|item.*"active", expected "inactive"/.test(m))).toBe(true)
    expect(out.some((m) => /data-part=list\] has no data-state/.test(m))).toBe(true)
  })

  it("ARIA state attributes are compared with what the machine's state implies", () => {
    const f = facts(`<button ${part("trigger", 'aria-pressed="false"')}>x</button>`, {
      expected: (el) =>
        el.part === "trigger" ? { attrs: { "aria-pressed": "true", "aria-disabled": null } } : {},
    })
    expect(generic("machineAttrs", f)[0]).toMatch(/aria-pressed="false", expected "true"/)
  })

  it("valued: aria-valuetext and the value-text part follow the machine value", () => {
    const f = facts(
      `<div ${part("thumb", 'role="slider" aria-label="v" aria-valuenow="4" aria-valuetext="3"')}></div>` +
        `<span ${part("value-text")}>2 items</span>`,
      { traits: ["valued"], values: { value: 4 } },
    )
    const out = trait("valued", f)
    expect(out.some((m) => /aria-valuetext="3", machine value 4/.test(m))).toBe(true)
    expect(out.some((m) => /shows "2 items", expected "3"/.test(m))).toBe(true)
  })

  it("documentClean keys outside elements by identity and checks ancestor siblings", () => {
    document.body.innerHTML = `<main id="app">app</main><div id="wrap"><aside id="side">s</aside><div ${part("root")}>x</div></div>`
    const baseline = collectDom({ scope: "x", instance: "i" })
    // A node inserted before everything must not shift the keys; the nested sibling counts.
    document.body.insertAdjacentHTML("afterbegin", "<div>toast</div>")
    document.getElementById("side")?.setAttribute("inert", "")
    const after = collectDom({ scope: "x", instance: "i" })
    const out = generic("documentClean", { ...base(), after, baseline, atInitial: true })
    expect(out).toContainEqual(expect.stringMatching(/aside#side inert=""/))
  })
})

describe("trait invariants", () => {
  it("disclosure: trigger mirrors open state; content hidden once closed", () => {
    const f = facts(
      `<button ${part("trigger", 'aria-expanded="true"')}>A</button><div ${part("content")}>B</div>`,
      { state: "closed", ...ds("closed") },
    )
    const out = trait("disclosure", f)
    expect(out[0]).toMatch(/aria-expanded="true" but the state is closed/)
    expect(out[1]).toMatch(/still visible while closed/)
    const ok = facts(
      `<button ${part("trigger", 'aria-expanded="false"')}>A</button><div ${part("content", 'hidden="until-found"')}>B</div>`,
      { state: "closed", ...ds("closed") },
    )
    expect(trait("disclosure", ok)).toEqual([])
  })

  it("layer: focus on body while open fails", () => {
    expect(trait("layer", facts(`<div ${part("content")}>x</div>`))).toEqual([
      "focus is on <body> while the layer is open",
    ])
  })

  it("restores-focus: after closing, focus must be on the trigger", () => {
    const f = facts(`<button ${part("trigger")}>A</button><button>B</button>`, {
      from: "open",
      state: "closed",
      ...ds("closed"),
    })
    expect(trait("restores-focus", f)[0]).toMatch(/expected the trigger part/)
  })

  it("composite-roving: exactly one tabindex=0", () => {
    const f = facts(
      `<div ${part("item", 'tabindex="0"')}>a</div><div ${part("item", 'tabindex="0"')}>b</div>`,
    )
    expect(trait("composite-roving", f)[0]).toMatch(/2 items/)
  })

  it("composite-activedescendant: points at a highlighted item; items not tabbable", () => {
    const f = facts(
      `<input ${part("input", 'aria-activedescendant="o1"')} aria-label="x"><div id="o1" ${part("item", 'role="option" tabindex="0"')}>a</div>`,
    )
    const out = trait("composite-activedescendant", f)
    expect(out.some((m) => /is tabbable/.test(m))).toBe(true)
    expect(out.some((m) => /not data-highlighted/.test(m))).toBe(true)
  })

  it("selectable: explicit state, single selection, follows data-selected", () => {
    const f = facts(
      `<div ${part("item", 'role="option" aria-selected="true" data-selected')}>a</div>` +
        `<div ${part("item", 'role="option" aria-selected="true" data-highlighted')}>b</div>` +
        `<div ${part("item", 'role="option"')}>c</div>`,
    )
    const out = trait("selectable", f)
    expect(out.some((m) => /no explicit aria-selected/.test(m))).toBe(true)
    expect(out.some((m) => /disagrees with data-selected/.test(m))).toBe(true)
    expect(out.some((m) => /2 items are selected/.test(m))).toBe(true)
  })

  it("set-metadata: per set, in range, unique, in order; tree levels and windows pass", () => {
    const bad = facts(
      `<div ${part("item", 'aria-posinset="2" aria-setsize="2"')}>a</div>` +
        `<div ${part("item", 'aria-posinset="2" aria-setsize="2"')}>b</div>` +
        `<div ${part("item", 'aria-posinset="5" aria-setsize="2"')}>c</div>` +
        `<div ${part("item", 'aria-posinset="1" aria-setsize="2"')}>d</div>`,
    )
    const out = trait("set-metadata", bad)
    expect(out.some((m) => /repeats aria-posinset=2/.test(m))).toBe(true)
    expect(out.some((m) => /outside \[1, 2\]/.test(m))).toBe(true)
    expect(out.some((m) => /comes after 5/.test(m))).toBe(true)
    const tree = facts(
      `<div ${part("item", 'aria-level="1" aria-posinset="1" aria-setsize="2"')}>a</div>` +
        `<div ${part("item", 'aria-level="2" aria-posinset="1" aria-setsize="1"')}>a1</div>` +
        `<div ${part("item", 'aria-level="1" aria-posinset="2" aria-setsize="2"')}>b</div>`,
    )
    expect(trait("set-metadata", tree)).toEqual([])
    const window = facts(
      `<div ${part("item", 'aria-posinset="50" aria-setsize="100"')}>50</div>` +
        `<div ${part("item", 'aria-posinset="51" aria-setsize="100"')}>51</div>`,
    )
    expect(trait("set-metadata", window)).toEqual([])
  })

  it("valued: aria-valuenow equals the machine value", () => {
    const f = facts(
      `<div ${part("thumb", 'role="slider" aria-valuenow="3" aria-label="v"')}></div>`,
      {
        values: { value: 4 },
      },
    )
    expect(trait("valued", f)[0]).toMatch(/machine value 4/)
  })

  it("valued: a multi-thumb mismatch names the thumb", () => {
    const thumb = (v: number) =>
      `<input type="range" ${part("hidden-input", `aria-label="t" aria-valuenow="${v}"`)}>`
    const f = facts(`<div ${part("root")}>${thumb(20)}${thumb(79)}</div>`, {
      valued: { values: [20, 80] },
    })
    const out = trait("valued", f)
    expect(out).toHaveLength(1)
    expect(out[0]).toMatch(/aria-valuenow="79", machine value 80/)
    expect(
      trait(
        "valued",
        facts(`<div ${part("root")}>${thumb(20)}${thumb(80)}</div>`, {
          valued: { values: [20, 80] },
        }),
      ),
    ).toEqual([])
  })

  it("valued: a null value carries no aria-valuenow", () => {
    const f = facts(
      `<div ${part("root", 'role="progressbar" aria-label="p" aria-valuenow="0"')}></div>`,
      {
        valued: { values: [null] },
      },
    )
    expect(trait("valued", f)[0]).toMatch(/aria-valuenow="0", expected none/)
  })

  it("valued: locale grouping is not misread; a declared text is compared", () => {
    const html = `<div ${part("root", 'role="slider" aria-label="s" aria-valuenow="1200" aria-valuetext="1.200"')}></div>`
    expect(trait("valued", facts(html, { valued: { values: [1200] } }))).toEqual([])
    const declared = trait(
      "valued",
      facts(html, { valued: { values: [1200], valueText: () => "1,200" } }),
    )
    expect(declared[0]).toMatch(/expected "1,200"/)
  })

  it("live-region: exists before the first message, never hidden", () => {
    const baseline = facts(`<div ${part("root")}></div>`).after
    const f = facts(
      `<div ${part("root", 'aria-hidden="true"')}><div aria-live="polite">hi</div></div>`,
      {
        baseline,
        traits: ["live-region"],
      },
    )
    const out = trait("live-region", f)
    expect(out.some((m) => /inside aria-hidden/.test(m))).toBe(true)
    expect(out.some((m) => /did not exist before/.test(m))).toBe(true)
  })

  it("checkGeneric runs generic and trait invariants together", () => {
    const f = facts(`<button ${part("trigger", 'aria-expanded="false"')}></button>`, {
      traits: ["disclosure"],
    })
    const out = checkGeneric(f)
    expect(out.some((m) => /no accessible name/.test(m))).toBe(true)
    expect(out.some((m) => /aria-expanded="false" but the state is open/.test(m))).toBe(true)
  })
})

export type { DomSnapshot }
