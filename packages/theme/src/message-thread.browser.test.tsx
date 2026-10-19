// add-message-thread 6.1: the Message Thread stylesheet alone: the user's messages at the
// inline end (mirrored in RTL), the jump key's size and icon, focus rings, forced colours.
import { afterEach, describe, expect, it } from "vitest"
import thread from "./message-thread.css?inline"
import { cleanup, files, inject, mount, q } from "./test-css"

afterEach(cleanup)

const sheet = () =>
  inject(
    `@layer rind.tokens, rind.themes, rind.components, rind.preferences;\n${files.tokens}\n${files.calm}\n${files.base}\n${files.variants}\n${files.icons}\n${thread}`,
  )

const attrs = (part: string, extra = "") =>
  `data-scope="message-thread" data-part="${part}" data-instance="t" data-state="detached" data-anchor="bottom" ${extra}`

const markup = (
  dir = "ltr",
) => `<div dir="${dir}" style="inline-size:400px;block-size:300px" ${attrs("root")}>
  <div role="feed" aria-label="Conversation" tabindex="0" style="overflow-y:auto" ${attrs("viewport")}>
    <div role="article" aria-label="You" tabindex="-1" ${attrs("message", 'data-from="user"')}>Hello</div>
    <div role="article" aria-label="Assistant" tabindex="-1" data-focus-visible ${attrs("message", 'data-from="assistant"')}>Hi there</div>
  </div>
  <button type="button" aria-label="Jump to latest message" ${attrs("jump-to-latest")}></button>
</div>`

describe("Message Thread stylesheet", () => {
  it("the user's message sits at the inline end, mirrored in RTL", () => {
    for (const dir of ["ltr", "rtl"]) {
      sheet()
      const host = mount(markup(dir))
      const view = q(host, '[data-part="viewport"]').getBoundingClientRect()
      const user = q(host, '[data-from="user"]').getBoundingClientRect()
      const endGap = dir === "ltr" ? view.right - user.right : user.left - view.left
      const startGap = dir === "ltr" ? user.left - view.left : view.right - user.right
      expect(endGap).toBeLessThan(startGap)
      cleanup()
    }
  })

  it("the jump key is at least 24 px and draws an arrow; focus rings on articles", () => {
    sheet()
    const host = mount(markup())
    const jump = q(host, '[data-part="jump-to-latest"]')
    const box = jump.getBoundingClientRect()
    expect(box.width).toBeGreaterThanOrEqual(24)
    expect(box.height).toBeGreaterThanOrEqual(24)
    expect(getComputedStyle(jump, "::before").maskImage).toContain("data:image/svg+xml")
    const focused = q(host, "[data-focus-visible]")
    expect(getComputedStyle(focused).outlineStyle).toBe("solid")
  })

  it("forced colours use system colours", () => {
    expect(thread).toMatch(/@media \(forced-colors: active\)[\s\S]*ButtonText/)
  })
})
