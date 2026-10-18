// add-code-block 7.1: the Code Block stylesheet alone, on the markup the parts render.
import { afterEach, describe, expect, it } from "vitest"
import codeBlock from "./code-block.css?inline"
import { cleanup, files, inject, mount, q, ratio, rgba } from "./test-css"

afterEach(cleanup)

const sheet = () =>
  inject(
    `@layer rind.tokens, rind.themes, rind.components, rind.preferences;\n${files.tokens}\n${files.calm}\n${files.base}\n${codeBlock}`,
  )

const attr = (flags: Record<string, boolean>) =>
  Object.entries(flags)
    .filter(([, on]) => on)
    .map(([k]) => ` ${k}=""`)
    .join("")

/** The parts' markup: lines separated by newline text, as CodeBlock.Content renders them. */
function markup(
  lines: readonly string[],
  o: { wrapped?: boolean; highlight?: number; collapsed?: number } = {},
) {
  const content = attr({
    "data-line-numbers": true,
    "data-wrapped": o.wrapped === true,
    "data-collapsible": o.collapsed !== undefined,
    "data-expanded": o.collapsed === undefined,
  })
  const style =
    o.collapsed === undefined ? "" : ` style="--rind-code-block-max-lines:${o.collapsed}"`
  const body = lines
    .map(
      (l, i) =>
        `<span data-scope="code-block" data-part="line" data-line="${i + 1}"${attr({ "data-highlighted": o.highlight === i + 1 })}>${l}</span>`,
    )
    .join("\n")
  return `<div data-scope="code-block" data-part="root" style="inline-size:320px">
  <div data-scope="code-block" data-part="header"><span data-scope="code-block" data-part="title">a.ts</span>
  <button type="button" data-scope="code-block" data-part="copy-trigger">Copy</button></div>
  <pre data-scope="code-block" data-part="content" dir="ltr"${content}${style}><code data-scope="code-block" data-part="code" style="--rind-code-block-start:0">${body}</code></pre></div>`
}

const src = ["const a = 1", "", "\tif (a) {", "  b()", "}"]

describe("Code Block stylesheet", () => {
  it("line numbers are drawn, never selected or copied", () => {
    sheet()
    const pre = q(mount(markup(src)), "pre")
    const line = q(pre, "[data-line='3']")
    const before = getComputedStyle(line, "::before")
    expect(before.content).not.toBe("none")
    expect(before.userSelect).toBe("none")
    const range = document.createRange()
    range.selectNodeContents(q(pre, "code"))
    const sel = document.getSelection()
    sel?.removeAllRanges()
    sel?.addRange(range)
    expect(sel?.toString()).toBe(src.join("\n"))
  })

  it("an empty line keeps the height of a line (rehype-pretty-code#157)", () => {
    sheet()
    const pre = q(mount(markup(src)), "pre")
    const one = q(pre, "[data-line='1']").getBoundingClientRect().height
    expect(q(pre, "[data-line='2']").getBoundingClientRect().height).toBeCloseTo(one, 0)
  })

  it("a highlighted line covers the scroll width (chakra-ui#10239)", () => {
    sheet()
    const long = ["short", "x".repeat(200)]
    const pre = q(mount(markup(long, { highlight: 1 })), "pre")
    expect(pre.scrollWidth).toBeGreaterThan(pre.clientWidth)
    const line = q(pre, "[data-line='1']")
    expect(line.getBoundingClientRect().width).toBeGreaterThanOrEqual(
      q(pre, "[data-line='2']").getBoundingClientRect().width - 1,
    )
    // Not colour alone: an inline-start border.
    expect(Number.parseFloat(getComputedStyle(line).borderInlineStartWidth)).toBeGreaterThan(0)
  })

  it("wrapped: a long line wraps, its number stays on the first row (docusaurus#7907)", () => {
    sheet()
    const lines = ["a", "b", `${"word ".repeat(80)}`, "d"]
    const pre = q(mount(markup(lines, { wrapped: true })), "pre")
    expect(pre.scrollWidth).toBeLessThanOrEqual(pre.clientWidth)
    const third = q(pre, "[data-line='3']")
    const lh = q(pre, "[data-line='1']").getBoundingClientRect().height
    expect(third.getBoundingClientRect().height).toBeGreaterThan(lh * 1.5)
    expect(getComputedStyle(third, "::before").top).toBe("0px")
  })

  it("collapsed: clipped to max lines, every line still in the document", () => {
    sheet()
    const lines = Array.from({ length: 40 }, (_, i) => `line ${i + 1}`)
    const pre = q(mount(markup(lines, { collapsed: 10 })), "pre")
    const lh = q(pre, "[data-line='1']").getBoundingClientRect().height
    expect(pre.getBoundingClientRect().height).toBeLessThan(lh * 14)
    expect(getComputedStyle(pre).overflowY).toBe("hidden")
    expect(pre.querySelectorAll("[data-line]")).toHaveLength(40)
  })

  it("the triggers' text contrasts with the code surface", () => {
    sheet()
    const root = mount(markup(src))
    const button = q(root, "[data-part=copy-trigger]")
    // The roles the sheet paints the triggers and the surface with.
    expect(getComputedStyle(button).color).toBe(getComputedStyle(q(root, "pre")).color)
    const fg = rgba(root, "--rind-color-text")
    const bg = rgba(root, "--rind-color-surface")
    expect(ratio(fg, bg)).toBeGreaterThanOrEqual(4.5)
  })
})
