// add-floating-positioning 7.1/7.2: small viewports, text resizing and 320 px reflow.
// Visual-viewport tests (pinch-zoom, on-screen keyboard) are Chromium-only: see 7.3 notes in
// viewport.pw.test.ts.
import { render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { page } from "vitest/browser"
import { createDriver } from "../../src/index"
import { anchoredContract } from "./anchored.contract"
import {
  At,
  layoutProblems,
  Pop,
  positioner,
  q,
  rect,
  trapErrors,
  triggerOf,
} from "./anchored.harness"
import { AnchoredExample } from "./anchored.react"

let trap: ReturnType<typeof trapErrors>
let style: HTMLStyleElement
beforeEach(() => {
  style = document.createElement("style")
  // The default theme's caps for lists and popups.
  style.textContent =
    "*{margin:0;box-sizing:border-box}body{margin:0}" +
    "[data-part=content]{max-width:var(--rind-available-width);max-height:var(--rind-available-height);overflow:auto}"
  document.head.append(style)
  trap = trapErrors()
})
afterEach(() => {
  trap.stop()
  style.remove()
  document.documentElement.style.cssText = ""
  expect(trap.seen.filter((m) => m.includes("ResizeObserver loop"))).toEqual([])
})
const poll = (fn: () => void) => vi.waitFor(fn, { timeout: 2000, interval: 30 })
const open = async (label = "Open") => {
  const d = createDriver(anchoredContract, screen, label).via("pointer")
  await d.open()
  return d
}

describe("Reflow at 320 px", () => {
  const spots = [
    ["top-left", 0, 0],
    ["top-right", 270, 0],
    ["bottom-left", 0, 455],
    ["bottom-right", 270, 455],
    ["centre", 135, 230],
  ] as const
  for (const preset of ["popup", "dropdown"] as const) {
    it.each(spots)(`Reflow at 320 px, ${preset} preset, anchor at %s`, async (_name, x, y) => {
      await page.viewport(320, 480)
      render(
        <At x={x} y={y}>
          <Pop
            id="a"
            preset={preset}
            width={600}
            height={900}
            triggerStyle={{ width: 50, height: 25 }}
          />
        </At>,
      )
      await open()
      await poll(() => {
        const r = rect(positioner())
        expect(r.left).toBeGreaterThanOrEqual(-0.5)
        expect(r.top).toBeGreaterThanOrEqual(-0.5)
        expect(r.right).toBeLessThanOrEqual(320.5)
        expect(r.bottom).toBeLessThanOrEqual(480.5)
      })
      const content = q('[data-part="content"]')
      expect(content.scrollHeight).toBeGreaterThan(content.clientHeight)
      expect(layoutProblems("a")).toEqual([])
    })
  }

  it("Reflow at 320 px, the fixture component itself", async () => {
    await page.viewport(320, 480)
    render(
      <At x={130} y={200}>
        <AnchoredExample id="a" />
      </At>,
    )
    await open()
    const r = rect(positioner())
    expect(r.left).toBeGreaterThanOrEqual(-0.5)
    expect(r.right).toBeLessThanOrEqual(320.5)
    expect(layoutProblems("a")).toEqual([])
  })
})

describe("Accessibility Of Positioning at small sizes", () => {
  it("Tooltip does not cover its focused trigger", async () => {
    await page.viewport(320, 480)
    render(
      <At x={120} y={200}>
        <Pop id="a" positioning={{ side: "top", sideOffset: 4 }} width={250} height={30} />
      </At>,
    )
    triggerOf().focus()
    const d = createDriver(anchoredContract, screen, "Open").via("keyboard")
    await d.open()
    const p = rect(positioner())
    const t = rect(triggerOf())
    const overlap = p.left < t.right && p.right > t.left && p.top < t.bottom && p.bottom > t.top
    expect(overlap).toBe(false)
  })

  it("Text resized while open", async () => {
    await page.viewport(400, 600)
    render(
      <At x={150} y={200}>
        <Pop
          id="a"
          triggerStyle={{ fontSize: "1rem" }}
          contentStyle={{ width: "10rem", fontSize: "1rem" }}
          width={10}
          height={40}
        />
      </At>,
    )
    await open()
    const before = rect(positioner())
    document.documentElement.style.fontSize = "32px"
    await poll(() => {
      const p = rect(positioner())
      expect(p.width).toBeGreaterThan(before.width * 1.5)
      expect(Math.abs(p.top - rect(triggerOf()).bottom)).toBeLessThanOrEqual(0.6)
      expect(p.right).toBeLessThanOrEqual(400.5)
      expect(p.left).toBeGreaterThanOrEqual(-0.5)
    })
  })
})
