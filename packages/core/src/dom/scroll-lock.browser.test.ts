// Needs a real classic scrollbar: headless browsers default to overlay bars (innerWidth ==
// clientWidth), which would make every compensation assertion pass vacuously.
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { lockScroll } from "./scroll-lock"

const html = document.documentElement
const WIDTH_VAR = "--rind-scrollbar-width"
const barWidth = () => window.innerWidth - html.clientWidth

let sheet: HTMLStyleElement
beforeEach((ctx) => {
  sheet = document.createElement("style")
  // -webkit-scrollbar forces classic bars in Chromium/WebKit; scrollbar-width for Firefox.
  sheet.textContent = "html::-webkit-scrollbar{width:15px}html{scrollbar-width:auto}"
  document.head.append(sheet)
  const tall = document.createElement("div")
  tall.style.height = "5000px"
  document.body.append(tall)
  if (barWidth() === 0) ctx.skip("this engine renders overlay scrollbars even with the stylesheet")
})
afterEach(() => {
  sheet.remove()
  for (const a of ["style", "dir", "data-rind-scroll-locked"]) html.removeAttribute(a)
  document.body.innerHTML = ""
  for (const m of document.head.querySelectorAll("meta[http-equiv]")) m.remove()
})

describe("scrollbar compensation with a classic scrollbar", () => {
  it("pads by exactly the scrollbar width and shifts nothing (radix#3251)", () => {
    const content = document.createElement("div")
    content.style.height = "10px"
    document.body.append(content)
    const width = barWidth()
    const rect = content.getBoundingClientRect()
    const release = lockScroll(document)
    const after = content.getBoundingClientRect()
    expect(html.style.getPropertyValue(WIDTH_VAR)).toBe(`${width}px`)
    expect(html.style.paddingRight).toBe(`${width}px`)
    expect(after.left).toBe(rect.left)
    expect(after.width).toBe(rect.width)
    release()
    expect(html.style.paddingRight).toBe("")
  })

  it("adds the bar to existing padding", () => {
    html.style.paddingRight = "10px"
    const width = barWidth()
    const release = lockScroll(document)
    expect(html.style.paddingRight).toBe(`${10 + width}px`)
    release()
    expect(html.style.paddingRight).toBe("10px")
  })

  it("adds no padding with scrollbar-gutter: stable, and never sets scrollbar-gutter", (ctx) => {
    if (!CSS.supports("scrollbar-gutter", "stable")) ctx.skip("no scrollbar-gutter support")
    html.style.setProperty("scrollbar-gutter", "stable")
    const release = lockScroll(document)
    expect(html.style.paddingRight).toBe("")
    expect(html.style.getPropertyValue("scrollbar-gutter")).toBe("stable")
    release()
    expect(html.style.getPropertyValue("scrollbar-gutter")).toBe("stable")
  })

  it("never sets scrollbar-gutter itself (base-ui#4645)", () => {
    const release = lockScroll(document)
    expect(html.style.getPropertyValue("scrollbar-gutter")).toBe("")
    release()
  })

  it("pads the left in RTL, where the bar sits on the left", () => {
    html.dir = "rtl"
    const width = barWidth()
    expect(width).toBeGreaterThan(0)
    const release = lockScroll(document)
    expect(html.style.paddingLeft).toBe(`${width}px`)
    expect(html.style.paddingRight).toBe("")
    release()
    expect(html.style.paddingLeft).toBe("")
  })
})

describe("strict CSP (bits-ui#1995)", () => {
  it("needs no <style> element, no style attribute write and triggers no violation", async () => {
    const meta = document.createElement("meta")
    meta.httpEquiv = "Content-Security-Policy"
    meta.content = "style-src 'self'"
    document.head.append(meta)
    const violations: string[] = []
    const onViolation = (e: SecurityPolicyViolationEvent) => violations.push(e.violatedDirective)
    document.addEventListener("securitypolicyviolation", onViolation)
    const styles = document.querySelectorAll("style").length
    const release = lockScroll(document)
    expect(html.style.overflow).toBe("hidden")
    expect(document.querySelectorAll("style").length).toBe(styles)
    release()
    // Violation reports are queued tasks: drain a few frames instead of waiting on a clock.
    for (let i = 0; i < 3; i++) await new Promise<void>((r) => requestAnimationFrame(() => r()))
    document.removeEventListener("securitypolicyviolation", onViolation)
    expect(violations).toEqual([])
    expect(html.style.overflow).toBe("")
  })
})
