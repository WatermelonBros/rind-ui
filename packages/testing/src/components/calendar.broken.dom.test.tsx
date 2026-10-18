// Broken consumer wrappers fail readably (task 6.2): each mutation of the rendered Calendar
// is caught by its invariant, and the correct component passes.
import { calendarContract } from "@rind-ui/core"
import { render } from "@testing-library/react"
import { useLayoutEffect } from "react"
import { describe, expect, it } from "vitest"
import { domEnv, testMachine } from "../index"
import { type Config, oracle, Story } from "./calendar-model"

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
const set = (el: HTMLElement, name: string, value: string) => {
  if (el.getAttribute(name) !== value) el.setAttribute(name, value)
}
const cells = () => [...document.querySelectorAll<HTMLElement>('[role="gridcell"]')]

const variants: Record<string, () => void> = {
  // Unselected cells lose aria-selected (the selectable invariant).
  "aria-selected missing": () => {
    for (const c of cells())
      if (c.getAttribute("aria-selected") === "false") c.removeAttribute("aria-selected")
  },
  // A second ring: every cell of the first week claims focus.
  "two focus rings": () => {
    for (const c of cells().slice(0, 2)) set(c, "data-focus", "")
  },
  // Placeholders of another month made focusable.
  "placeholder focusable": () => {
    for (const c of cells()) if (c.hasAttribute("data-outside-month")) set(c, "tabindex", "-1")
  },
  // Two tab stops in the grid.
  "two tab stops": () => {
    const inMonth = cells().filter((c) => !c.hasAttribute("data-outside-month"))
    for (const c of inMonth.slice(0, 2)) set(c, "tabindex", "0")
  },
}

/** A focusable button inside every cell (a consumer wrapper's button per day). */
const buttonInCells = () => {
  for (const c of cells()) {
    if (c.querySelector("button")) continue
    const b = document.createElement("button")
    b.type = "button"
    b.textContent = "•"
    c.append(b)
  }
}

async function failuresOf(mutate: (() => void) | null, cfg: Config = {}) {
  const tests: { name: string; fn: () => Promise<void> }[] = []
  testMachine(calendarContract, {
    test: (name: string, fn: () => Promise<void>) => tests.push({ name, fn }),
    setup: () => render(<Story cfg={cfg}>{mutate ? <Breaker mutate={mutate} /> : null}</Story>),
    target: () => domEnv({ timeout: 300 }),
    anchor: [{ name: "Departure" }],
    props: oracle(cfg) as never,
    modalities: ["keyboard"],
  } as never)
  const out: string[] = []
  // A few paths are enough to see a structural break.
  for (const t of tests.slice(0, 6)) {
    const error = await t.fn().then(
      () => null,
      (e: Error) => e.message,
    )
    if (error) out.push(error)
    document.body.innerHTML = ""
  }
  return out
}

describe("calendar broken variants fail readably", () => {
  it("the correct component passes", { timeout: 120_000 }, async () => {
    expect(await failuresOf(null)).toEqual([])
  })

  const expected: Record<string, RegExp> = {
    "aria-selected missing": /aria-selected/,
    "two focus rings": /calendar-one-focus|data-focus/,
    "placeholder focusable": /calendar-placeholders-inert|placeholder/,
    "two tab stops": /calendar-one-tab-stop|tabindex/,
  }
  it("the correct month view passes", { timeout: 120_000 }, async () => {
    expect(await failuresOf(null, { minView: "months" })).toEqual([])
  })

  for (const cfg of [{}, { minView: "months" }] as const) {
    it(`a button inside cells fails on the roving tab stop (${cfg.minView ?? "days"} view)`, {
      timeout: 120_000,
    }, async () => {
      const errors = await failuresOf(buttonInCells, cfg)
      expect(errors.length).toBeGreaterThan(0)
      expect(errors[0]).toMatch(/calendar-one-tab-stop|roving|focusable/)
    })
  }

  for (const [name, mutate] of Object.entries(variants)) {
    it(`${name} fails, naming it`, { timeout: 120_000 }, async () => {
      const errors = await failuresOf(mutate)
      expect(errors.length).toBeGreaterThan(0)
      expect(errors.some((e) => expected[name]?.test(e))).toBe(true)
    })
  }
})
