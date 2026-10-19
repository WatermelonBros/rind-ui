// add-streaming-message 6.1: the Streaming Message stylesheet alone: the Caret blinks in steps,
// sits inline after the text, and holds still under reduced motion; forced colours.
import { afterEach, describe, expect, it } from "vitest"
import streaming from "./streaming-message.css?inline"
import { cleanup, files, inject, mount, q } from "./test-css"

afterEach(cleanup)

const sheet = () =>
  inject(
    `@layer rind.tokens, rind.themes, rind.components, rind.preferences;\n${files.tokens}\n${files.calm}\n${files.base}\n${files.variants}\n${streaming}`,
  )

const attrs = (part: string) =>
  `data-scope="streaming-message" data-part="${part}" data-instance="m" data-state="streaming" data-busy`

const message = `<div style="inline-size:320px" ${attrs("root")}>
  <div aria-busy="true" ${attrs("content")}>The answer is</div><span aria-hidden="true" ${attrs("caret")}></span>
</div>`

describe("Streaming Message stylesheet", () => {
  it("the caret is a visible inline bar that blinks in steps", () => {
    sheet()
    const caret = q(mount(message), '[data-part="caret"]')
    const cs = getComputedStyle(caret)
    expect(cs.animationName).toBe("rind-streaming-caret")
    expect(cs.animationTimingFunction).toContain("steps(1")
    expect(caret.getBoundingClientRect().width).toBeGreaterThan(0)
  })

  it("the caret follows the text on the same line", () => {
    sheet()
    const host = mount(message)
    const text = q(host, '[data-part="content"]').getBoundingClientRect()
    const caret = q(host, '[data-part="caret"]').getBoundingClientRect()
    expect(caret.left).toBeGreaterThanOrEqual(text.right - 1)
    expect(Math.abs(caret.bottom - text.bottom)).toBeLessThan(8)
  })

  it("reduced motion stops the blink; forced colours paint it CanvasText", () => {
    expect(streaming).toMatch(/@media \(prefers-reduced-motion: reduce\)[\s\S]*animation: none/)
    expect(streaming).toMatch(/@media \(forced-colors: active\)[\s\S]*CanvasText/)
  })
})
