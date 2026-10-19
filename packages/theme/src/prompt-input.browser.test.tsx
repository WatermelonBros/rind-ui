// add-prompt-input: the Prompt Input stylesheet alone: target sizes, the Submit glyph per
// action, the blocked Submit's non-colour cue, over-limit and drag cues, the content-sized
// draft with a maximum, remove buttons that never hide behind hover, tokens, forced colors.
import { afterEach, describe, expect, it } from "vitest"
import promptInput from "./prompt-input.css?inline"
import { cleanup, files, inject, mount, q } from "./test-css"

afterEach(cleanup)

const a = (part: string, extra = "") => `data-scope="prompt-input" data-part="${part}" ${extra}`

const markup = (root = "", submit = 'data-action="send"') => `<form ${a("root", root)}>
  <div role="toolbar" aria-label="Attachments" ${a("chips")}>
    <span ${a("chip")}><span ${a("chip-text")}>q1.pdf</span><button type="button" aria-label="Remove q1.pdf" ${a("chip-remove")}>x</button></span>
  </div>
  <textarea aria-label="Message" rows="1" ${a("textarea")}></textarea>
  <button type="button" aria-label="Attach files" ${a("attach-trigger")}></button>
  <span ${a("character-count")}>3/10</span>
  <button type="submit" aria-label="Send message" ${a("submit", submit)}></button>
</form>`

const sheet = () =>
  inject(
    `@layer rind.tokens, rind.themes, rind.components, rind.preferences;\n${files.tokens}\n${files.calm}\n${files.base}\n${files.variants}\n${files.icons}\n${promptInput}`,
  )

const root = (host: HTMLElement) => q(host, '[data-part="root"]')
const submit = (host: HTMLElement) => q(host, '[data-part="submit"]')

describe("Prompt Input stylesheet", () => {
  it("Submit, AttachTrigger and the remove button are at least 24px", () => {
    sheet()
    const host = mount(markup())
    for (const s of [
      '[data-part="submit"]',
      '[data-part="attach-trigger"]',
      '[data-part="chip-remove"]',
    ]) {
      const el = q(host, s)
      expect(el.offsetWidth, s).toBeGreaterThanOrEqual(24)
      expect(el.offsetHeight, s).toBeGreaterThanOrEqual(24)
    }
  })

  it("the Submit glyph follows data-action (send arrow, stop square)", () => {
    sheet()
    const glyph = (action: string) =>
      getComputedStyle(submit(mount(markup("", `data-action="${action}"`))), "::before").maskImage
    expect(glyph("send")).not.toBe("none")
    expect(glyph("stop")).not.toBe("none")
    expect(glyph("send")).not.toBe(glyph("stop"))
  })

  it("a blocked Submit gets an edge and loses its fill (not colour alone)", () => {
    sheet()
    const live = getComputedStyle(submit(mount(markup())))
    const blocked = getComputedStyle(
      submit(mount(markup("", 'data-action="send" data-disabled aria-disabled="true"'))),
    )
    expect(blocked.backgroundColor).not.toBe(live.backgroundColor)
    expect(blocked.borderTopColor).not.toBe("rgba(0, 0, 0, 0)")
    expect(live.borderTopColor).toBe("rgba(0, 0, 0, 0)")
  })

  it("over the limit doubles the border; a drag draws a dashed outline", () => {
    sheet()
    const w = (host: HTMLElement) => Number.parseFloat(getComputedStyle(root(host)).borderTopWidth)
    expect(w(mount(markup("data-over-limit")))).toBeGreaterThan(w(mount(markup())))
    expect(getComputedStyle(root(mount(markup("data-dragging")))).outlineStyle).toBe("dashed")
    expect(getComputedStyle(root(mount(markup("data-focus")))).outlineStyle).toBe("solid")
  })

  it("the draft is content-sized with a maximum, then it scrolls; it never resizes by hand", () => {
    sheet()
    const host = mount(`<div style="--rind-prompt-input-max-block-size:5lh">${markup()}</div>`)
    const area = q<HTMLTextAreaElement>(host, '[data-part="textarea"]')
    const s = getComputedStyle(area)
    expect(s.resize).toBe("none")
    expect(s.overflowY).toBe("auto")
    if (CSS.supports("field-sizing", "content")) {
      const empty = area.offsetHeight
      area.value = Array.from({ length: 30 }, (_, i) => `line ${i}`).join("\n")
      const tall = area.offsetHeight
      expect(tall).toBeGreaterThan(empty)
      expect(tall).toBeLessThanOrEqual(Number.parseFloat(s.lineHeight) * 5 + 16)
    }
  })

  it("the remove button stays visible without hover (ai-elements#507)", () => {
    sheet()
    const s = getComputedStyle(q(mount(markup()), '[data-part="chip-remove"]'))
    expect(s.display).not.toBe("none")
    expect(s.opacity).toBe("1")
    expect(s.visibility).toBe("visible")
  })

  it("reads the --rind-prompt-input-* tokens", () => {
    sheet()
    const host = mount(
      `<div style="--rind-prompt-input-radius:9px;--rind-prompt-input-submit-bg:rgb(1, 2, 3)">${markup()}</div>`,
    )
    expect(getComputedStyle(root(host)).borderTopLeftRadius).toBe("9px")
    expect(getComputedStyle(submit(host)).backgroundColor).toBe("rgb(1, 2, 3)")
  })

  it("forced colors: system colours for the card, the keys and the chips; no [hidden] rule", () => {
    const css = promptInput.replace(/\/\*[\s\S]*?\*\//g, "")
    expect(css).toMatch(/@media \(forced-colors: active\)[\s\S]*background: Field[\s\S]*Highlight/)
    expect(css).toMatch(/ButtonText/)
    expect(css).toMatch(/GrayText/)
    expect(css).not.toMatch(/\[hidden\]/)
    expect(css).not.toMatch(/transition/)
  })
})
