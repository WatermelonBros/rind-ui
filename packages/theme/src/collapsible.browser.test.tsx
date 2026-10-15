// add-collapsible 7.1: the Collapsible stylesheet alone, size variable, transitions, RTL.
import { afterEach, describe, expect, it } from "vitest"
import collapsible from "./collapsible.css?inline"
import { cleanup, files, inject, mount, q } from "./test-css"

afterEach(cleanup)

const markup = (content = "") => `<div data-scope="collapsible" data-part="root">
  <button data-scope="collapsible" data-part="trigger" type="button">Toggle
    <span data-scope="collapsible" data-part="indicator" data-state="closed"></span></button>
  <div data-scope="collapsible" data-part="content"${content}><div style="height:80px"></div></div></div>`

const sheet = () =>
  inject(
    `@layer rind.tokens, rind.themes, rind.components, rind.preferences;\n${files.tokens}\n${files.calm}\n${files.base}\n${collapsible}`,
  )

describe("Collapsible stylesheet", () => {
  it("the content clips and its height follows the size variable", () => {
    sheet()
    const content = q(
      mount(markup(' style="--rind-collapsible-content-height:0px"')),
      "[data-part=content]",
    )
    expect(getComputedStyle(content).overflow).toBe("hidden")
    expect(getComputedStyle(content).height).toBe("0px")
    content.style.setProperty("--rind-collapsible-content-height", "40px")
    // A transition may be in flight: the target is what the variable says.
    content.style.transition = "none"
    expect(getComputedStyle(content).height).toBe("40px")
  })

  it("animates height; data-reveal skips the transition", () => {
    sheet()
    const host = mount(markup())
    const content = q(host, "[data-part=content]")
    expect(getComputedStyle(content).transitionProperty).toBe("height")
    expect(Number.parseFloat(getComputedStyle(content).transitionDuration)).toBeGreaterThan(0)
    content.setAttribute("data-reveal", "mount")
    expect(Number.parseFloat(getComputedStyle(content).transitionDuration)).toBe(0)
  })

  it("has no [hidden] override (it would defeat until-found)", () => {
    expect(collapsible.replace(/\/\*[\s\S]*?\*\//g, "")).not.toMatch(/\[hidden\]/)
  })

  it("the indicator rotates when open and mirrors under RTL", () => {
    sheet()
    const host = mount(markup())
    const indicator = q(host, "[data-part=indicator]")
    // Read the target, not a frame of the rotation.
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

  it("a disabled trigger reads the disabled colour; the target is at least 24px", () => {
    sheet()
    const host = mount(markup())
    const trigger = q(host, "button")
    const enabled = getComputedStyle(trigger).color
    expect(trigger.getBoundingClientRect().height).toBeGreaterThanOrEqual(24)
    trigger.setAttribute("data-disabled", "")
    expect(getComputedStyle(trigger).color).not.toBe(enabled)
  })
})
