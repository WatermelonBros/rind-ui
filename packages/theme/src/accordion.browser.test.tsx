// add-accordion 6.1: the Accordion stylesheet alone, separators, dimming, transitions, RTL.
import { afterEach, describe, expect, it } from "vitest"
import accordion from "./accordion.css?inline"
import { cleanup, files, inject, mount, q } from "./test-css"

afterEach(cleanup)

const markup = (attrs = "", content = "") => `<div data-scope="accordion" data-part="root">
  <div data-scope="accordion" data-part="item" data-state="closed"${attrs}>
    <h3 data-scope="accordion" data-part="header" style="font-size:30px">
      <button data-scope="accordion" data-part="trigger" type="button"${attrs}>Shipping
        <span data-scope="accordion" data-part="indicator" data-state="closed"></span></button></h3>
    <div data-scope="accordion" data-part="content"${content}><div style="height:80px"></div></div>
  </div></div>`

const sheet = () =>
  inject(
    `@layer rind.tokens, rind.themes, rind.components, rind.preferences;\n${files.tokens}\n${files.calm}\n${files.base}\n${accordion}`,
  )

describe("Accordion stylesheet", () => {
  it("the content clips and its height follows the size variable", () => {
    sheet()
    const content = q(
      mount(markup("", ' style="--rind-accordion-content-height:0px"')),
      "[data-part=content]",
    )
    expect(getComputedStyle(content).overflow).toBe("hidden")
    expect(getComputedStyle(content).height).toBe("0px")
    content.style.setProperty("--rind-accordion-content-height", "40px")
    content.style.transition = "none"
    expect(getComputedStyle(content).height).toBe("40px")
  })

  it("animates height; data-reveal skips the transition; no [hidden] override", () => {
    sheet()
    const content = q(mount(markup()), "[data-part=content]")
    expect(getComputedStyle(content).transitionProperty).toBe("height")
    expect(Number.parseFloat(getComputedStyle(content).transitionDuration)).toBeGreaterThan(0)
    content.setAttribute("data-reveal", "mount")
    expect(Number.parseFloat(getComputedStyle(content).transitionDuration)).toBe(0)
    expect(accordion.replace(/\/\*[\s\S]*?\*\//g, "")).not.toMatch(/\[hidden\]/)
  })

  it("separates items with a border (survives forced colors)", () => {
    sheet()
    const item = q(mount(markup()), "[data-part=item]")
    expect(getComputedStyle(item).borderBlockEndStyle).toBe("solid")
    expect(Number.parseFloat(getComputedStyle(item).borderBlockEndWidth)).toBeGreaterThan(0)
  })

  it("dims only a disabled item, not a locked trigger", () => {
    sheet()
    const host = mount(markup())
    const item = q(host, "[data-part=item]")
    const trigger = q(host, "button")
    trigger.setAttribute("data-disabled", "") // the lock: the item itself is not disabled
    expect(getComputedStyle(item).opacity).toBe("1")
    expect(getComputedStyle(trigger).opacity).toBe("1")
    item.setAttribute("data-disabled", "")
    expect(Number.parseFloat(getComputedStyle(item).opacity)).toBeLessThan(1)
  })

  it("the header is reset and the trigger is full width and at least 24px", () => {
    sheet()
    const host = mount(markup())
    const header = q(host, "h3")
    const trigger = q(host, "button")
    expect(getComputedStyle(header).marginBlockStart).toBe("0px")
    expect(getComputedStyle(trigger).fontSize).toBe("30px")
    expect(trigger.getBoundingClientRect().width).toBe(header.getBoundingClientRect().width)
    expect(trigger.getBoundingClientRect().height).toBeGreaterThanOrEqual(24)
  })

  it("the indicator rotates when open and mirrors under RTL", () => {
    sheet()
    const host = mount(markup())
    const indicator = q(host, "[data-part=indicator]")
    indicator.style.transition = "none"
    const transform = () => getComputedStyle(indicator).transform
    expect(transform()).toBe("none")
    indicator.setAttribute("data-state", "open")
    const open = transform()
    expect(open).not.toBe("none")
    host.setAttribute("dir", "rtl")
    indicator.setAttribute("data-state", "closed")
    expect(transform()).toBe("matrix(-1, 0, 0, 1, 0, 0)")
    indicator.setAttribute("data-state", "open")
    expect(transform()).not.toBe(open)
  })
})
