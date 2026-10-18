// add-code-block 7.1: the Code Block stylesheet alone, on the markup the parts render.
import { afterEach, describe, expect, it } from "vitest"
import codeBlock from "./code-block.css?inline"
import { cleanup, files, inject, mount, q, type Rgba, ratio, rgba } from "./test-css"

afterEach(cleanup)

/** An element's computed colour as 8-bit sRGB + alpha, through the canvas helper. */
function computed(el: HTMLElement, property: string): Rgba {
  el.style.setProperty("--probe", getComputedStyle(el).getPropertyValue(property))
  return rgba(el, "--probe")
}

/** `top` (alpha 0-255) composited over the opaque `under`. */
function over(top: Rgba, under: Rgba): Rgba {
  const a = top[3] / 255
  const mix = (i: 0 | 1 | 2) => Math.round(top[i] * a + under[i] * (1 - a))
  return [mix(0), mix(1), mix(2), 255]
}

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
    const bg = computed(q(root, "[data-part=root]"), "background-color")
    expect(ratio(computed(button, "color"), bg)).toBeGreaterThanOrEqual(4.5)
  })

  it("content is padded; the inline padding is on the lines, so they run edge to edge", () => {
    sheet()
    const pre = q(mount(markup(src, { highlight: 1 })), "pre")
    const line = q(pre, "[data-line='1']")
    expect(Number.parseFloat(getComputedStyle(pre).paddingTop)).toBeGreaterThanOrEqual(12)
    expect(Number.parseFloat(getComputedStyle(pre).paddingInlineStart)).toBe(0)
    expect(Number.parseFloat(getComputedStyle(line).paddingInlineEnd)).toBeGreaterThanOrEqual(16)
    expect(line.getBoundingClientRect().left).toBeCloseTo(pre.getBoundingClientRect().left, 0)
  })

  it("rtl page: the lines keep their padding and run left to right", () => {
    sheet()
    const pre = q(mount(`<div dir="rtl">${markup(src)}</div>`), "pre")
    const line = q(pre, "[data-line='1']")
    expect(getComputedStyle(pre).direction).toBe("ltr")
    expect(line.getBoundingClientRect().left).toBeCloseTo(pre.getBoundingClientRect().left, 0)
    expect(Number.parseFloat(getComputedStyle(line).paddingLeft)).toBeGreaterThan(
      Number.parseFloat(getComputedStyle(line).paddingRight),
    )
  })

  const tokens = [
    "keyword",
    "string",
    "comment",
    "number",
    "function",
    "type",
    "tag",
    "attr",
    "property",
    "variable",
    "regex",
    "punctuation",
    "operator",
  ]
  const tokenLine = tokens.map((t) => `<span data-token="${t}">${t}</span>`).join(" ")

  it.each([
    ["light page", "light", ""],
    ["dark page", "dark", ""],
    ["light block", "light", "--rind-code-block-scheme:light"],
    ["light block, dark page", "dark", "--rind-code-block-scheme:light"],
  ])("token colours reach 4.5:1 on the block and a highlighted line (%s)", (_, theme, style) => {
    sheet()
    document.documentElement.setAttribute("data-theme", theme)
    const host = mount(
      `<div style="${style}">${markup([tokenLine, tokenLine], { highlight: 2 })}</div>`,
    )
    const block = computed(q(host, "[data-part=root]"), "background-color")
    const lit = over(computed(q(host, "[data-line='2']"), "background-color"), block)
    for (const t of tokens) {
      const fg = computed(q(host, `[data-line='1'] [data-token=${t}]`), "color")
      expect(ratio(fg, block), t).toBeGreaterThanOrEqual(4.5)
      expect(ratio(fg, lit), `${t} highlighted`).toBeGreaterThanOrEqual(4.5)
    }
  })

  it("a token colour is picked by overriding its custom property", () => {
    sheet()
    const host = mount(
      `<div style="--rind-code-token-keyword:rgb(1, 2, 3)">${markup([tokenLine])}</div>`,
    )
    expect(getComputedStyle(q(host, "[data-token=keyword]")).color).toBe("rgb(1, 2, 3)")
    expect(getComputedStyle(q(host, "[data-token=comment]")).fontStyle).toBe("italic")
  })
})
