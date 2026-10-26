// add-timer 4.1: the Timer stylesheet with the Button's, on the markup core renders: tabular
// figures, the ActionTriggers styled as keys (button.css), the completed tint at 4.5:1, and the
// digits not shifting width as they change.
import { afterEach, describe, expect, it } from "vitest"
import button from "./button.css?inline"
import { cleanup, files, inject, mount, q } from "./test-css"
import timer from "./timer.css?inline"

afterEach(cleanup)

const sheet = () =>
  inject(
    `@layer rind.tokens, rind.themes, rind.components, rind.preferences;\n${files.tokens}\n${files.calm}\n${files.base}\n${files.variants}\n${button}\n${timer}`,
  )

const a = (part: string, state: string, extra = "") =>
  `data-scope="timer" data-part="${part}" data-instance="t" data-state="${state}" ${extra}`

const markup = (state: string, seconds = "05") => `<div ${a("root", state)}>
  <div role="timer" aria-label="5 seconds" ${a("area", state)}>
    <div ${a("item", state, 'data-type="minutes"')}><span ${a("item-value", state, 'data-type="minutes"')}>01</span></div>
    <span aria-hidden="true" ${a("separator", state)}>:</span>
    <div ${a("item", state, 'data-type="seconds"')}><span ${a("item-value", state, 'data-type="seconds"')}>${seconds}</span></div>
  </div>
  <div ${a("control", state)}>
    <button type="button" ${a("action-trigger", state, 'data-action="toggle"')}>Start</button>
  </div>
</div>`

/** Any CSS colour (computed styles may be oklch) as sRGB channels, through a canvas pixel. */
function rgbOf(color: string): [number, number, number] {
  const ctx = document.createElement("canvas").getContext("2d")
  if (!ctx) throw new Error("no canvas")
  ctx.fillStyle = color
  ctx.fillRect(0, 0, 1, 1)
  const [r = 0, g = 0, b = 0] = ctx.getImageData(0, 0, 1, 1).data
  return [r, g, b]
}

function luminance(color: string) {
  const [r = 0, g = 0, b = 0] = rgbOf(color).map((c) => {
    const s = c / 255
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
const ratio = (a: string, b: string) => {
  const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number]
  return (l1 + 0.05) / (l2 + 0.05)
}

describe("Timer stylesheet", () => {
  it("tabular figures: the time does not change width as digits change", () => {
    sheet()
    const w1 = q(mount(markup("running", "11")), '[data-part="area"]').getBoundingClientRect().width
    cleanup()
    sheet()
    const w2 = q(mount(markup("running", "00")), '[data-part="area"]').getBoundingClientRect().width
    expect(Math.abs(w1 - w2)).toBeLessThan(0.5)
  })

  it("an ActionTrigger is a key: the Button's background and at least 24 px", () => {
    sheet()
    const trigger = q(mount(markup("idle")), '[data-part="action-trigger"]')
    const style = getComputedStyle(trigger)
    expect(style.backgroundColor).not.toBe("rgba(0, 0, 0, 0)")
    expect(trigger.getBoundingClientRect().height).toBeGreaterThanOrEqual(24)
  })

  it("completed is tinted, at 4.5:1 on the page", () => {
    sheet()
    const idle = getComputedStyle(q(mount(markup("idle")), '[data-part="area"]')).color
    cleanup()
    sheet()
    const done = getComputedStyle(q(mount(markup("completed")), '[data-part="area"]')).color
    expect(done).not.toBe(idle)
    const bg = getComputedStyle(document.body).backgroundColor
    const page = bg === "rgba(0, 0, 0, 0)" ? "rgb(255, 255, 255)" : bg
    expect(ratio(done, page)).toBeGreaterThanOrEqual(4.5)
  })
})
