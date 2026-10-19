// add-reasoning 4.1: the Reasoning stylesheet alone: the caret turns with the state (mirrored
// in RTL), the shimmer runs only while thinking and stops under reduced motion, the trigger
// is at least 24 px tall.
import { afterEach, describe, expect, it } from "vitest"
import reasoning from "./reasoning.css?inline"
import { cleanup, files, inject, mount, q } from "./test-css"

afterEach(cleanup)

const sheet = () =>
  inject(
    `@layer rind.tokens, rind.themes, rind.components, rind.preferences;\n${files.tokens}\n${files.calm}\n${files.base}\n${files.variants}\n${files.icons}\n${reasoning}`,
  )

const markup = (state: "open" | "closed", thinking: boolean, dir = "ltr") => {
  const a = (part: string) =>
    `data-scope="reasoning" data-part="${part}" data-instance="r" data-state="${state}" ${thinking ? "data-thinking" : ""}`
  return `<div dir="${dir}" ${a("root")}><button type="button" aria-expanded="${state === "open"}" ${a("trigger")}>Thinking…</button></div>`
}

const trigger = (host: HTMLElement) => q(host, '[data-part="trigger"]')

describe("Reasoning stylesheet", () => {
  it("the caret points down open, to the inline end closed (mirrored in RTL)", () => {
    const rot = (state: "open" | "closed", dir: string) => {
      sheet()
      const r = getComputedStyle(trigger(mount(markup(state, false, dir))), "::after").rotate
      cleanup()
      return r
    }
    expect(rot("open", "ltr")).toBe("none")
    expect(rot("closed", "ltr")).toBe("-90deg")
    expect(rot("closed", "rtl")).toBe("90deg")
  })

  it("the shimmer runs only while thinking; the trigger is at least 24 px tall", () => {
    sheet()
    const t = trigger(mount(markup("open", true)))
    expect(getComputedStyle(t).animationName).toBe("rind-reasoning-shimmer")
    expect(t.getBoundingClientRect().height).toBeGreaterThanOrEqual(24)
    cleanup()
    sheet()
    expect(getComputedStyle(trigger(mount(markup("open", false)))).animationName).toBe("none")
  })

  it("reduced motion stops the shimmer; forced colours use system colours", () => {
    expect(reasoning).toMatch(/@media \(prefers-reduced-motion: reduce\)[\s\S]*animation: none/)
    expect(reasoning).toMatch(/@media \(forced-colors: active\)[\s\S]*CanvasText/)
  })
})
