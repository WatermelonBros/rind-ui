// Broken consumer wrappers fail readably (task 6.2): each mutation of the rendered Date Field
// is caught by its invariant, and the correct component passes.
import { cleanup, render } from "@testing-library/react"
import { useLayoutEffect } from "react"
import { describe, expect, it } from "vitest"
import { dateFieldStepInvariants, domEnv, testMachine } from "../index"
import { type Config, modelContract, oracle, Story, settle } from "./date-field-model"

/** Re-applies `mutate` after every DOM change (a wrapper that keeps breaking the markup). */
function Breaker({ mutate }: { readonly mutate: () => void }) {
  useLayoutEffect(() => {
    mutate()
    const observer = new MutationObserver(() => {
      observer.disconnect()
      mutate()
      observer.observe(document.body, { subtree: true, childList: true, attributes: true })
    })
    observer.observe(document.body, { subtree: true, childList: true, attributes: true })
    return () => observer.disconnect()
  })
  return null
}

/** Sets an attribute only when it differs (a no-op set still queues a mutation record). */
const set = (el: Element, name: string, value: string) => {
  if (el.getAttribute(name) !== value) el.setAttribute(name, value)
}
const segments = () => [...document.querySelectorAll<HTMLInputElement>("[data-editable]")]

const variants: Record<string, () => void> = {
  "contenteditable segment": () => {
    const first = segments()[0]
    if (first) set(first, "contenteditable", "true")
  },
  // A wrapper that clamps what a segment reports (one below the typed value).
  "clamped segment value": () => {
    for (const s of segments()) {
      const now = s.getAttribute("aria-valuenow")
      if (now !== null && s.dataset["clamped"] !== now) {
        const lower = String(Math.max(0, Number(now) - 1))
        s.dataset["clamped"] = lower
        s.setAttribute("aria-valuenow", lower)
      }
    }
  },
  "stale hidden value": () => {
    const hidden = document.querySelector<HTMLInputElement>('[data-part="hidden-input"]')
    if (hidden && hidden.value !== "1999-01-01") hidden.value = "1999-01-01"
  },
  "unresolved IDREF": () => {
    const first = segments()[0]
    const ids = first?.getAttribute("aria-labelledby") ?? ""
    if (first && !ids.includes("missing-name")) set(first, "aria-labelledby", `${ids} missing-name`)
  },
  "extra focusable": () => {
    const literal = document.querySelector('[data-type="literal"]')
    if (literal) set(literal, "tabindex", "0")
  },
}

async function failuresOf(mutate: (() => void) | null, cfg: Config = {}) {
  const tests: { name: string; fn: () => Promise<void> }[] = []
  testMachine(modelContract(), {
    test: (name: string, fn: () => Promise<void>) => tests.push({ name, fn }),
    setup: async () => {
      const view = render(<Story cfg={cfg}>{mutate ? <Breaker mutate={mutate} /> : null}</Story>)
      await settle(cfg)
      return view
    },
    target: () => domEnv({ timeout: 300 }),
    anchor: [{ name: "Birthday" }],
    props: oracle({}) as never,
    invariants: dateFieldStepInvariants().invariants,
    modalities: ["keyboard"],
  } as never)
  const out: string[] = []
  // Paths that put a value in a segment are enough to see a structural break.
  for (const t of tests.slice(0, 8)) {
    const error = await t.fn().then(
      () => null,
      (e: Error) => e.message,
    )
    if (error) out.push(error)
    // Unmounts through React: a portalled popover cannot be wiped from under it.
    cleanup()
  }
  return out
}

describe("date-field broken variants fail readably", () => {
  it("the correct component passes", { timeout: 120_000 }, async () => {
    expect(await failuresOf(null)).toEqual([])
  })

  const expected: Record<string, RegExp> = {
    "contenteditable segment": /date-segment-native-inputs|contenteditable/,
    "clamped segment value": /aria-valuenow/,
    "stale hidden value": /date-segment-hidden-mirrors-value|hidden input/,
    "unresolved IDREF": /missing-name/,
    "extra focusable": /date-field-tab-stops-are-segments|tab stops/,
  }
  for (const [name, mutate] of Object.entries(variants)) {
    it(`${name} fails, naming it`, { timeout: 120_000 }, async () => {
      const errors = await failuresOf(mutate)
      expect(errors.length).toBeGreaterThan(0)
      expect(errors.some((e) => expected[name]?.test(e))).toBe(true)
    })
  }
})

// date-field "Picker — Picker Invariants": a picker that holds a picked date aside (its calendar
// selects a day the field does not hold) fails on views-agree.
describe("date-field picker broken variant", () => {
  const heldAside = () => {
    const cell = document.querySelector(
      '[data-scope="calendar"][data-part="cell"][data-value="2026-10-21"]',
    )
    if (cell) set(cell, "aria-selected", "true")
  }
  it("the correct open picker passes", { timeout: 120_000 }, async () => {
    expect(await failuresOf(null, { picker: "open" })).toEqual([])
  })
  it("a date held aside fails, naming date-picker-views-agree", { timeout: 120_000 }, async () => {
    const errors = await failuresOf(heldAside, { picker: "open" })
    expect(errors.some((e) => /date-picker-views-agree/.test(e))).toBe(true)
  })
})
