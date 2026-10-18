// add-navigation-menu 6.1: the Navigation Menu stylesheet alone: triggers and links keep a
// 24px target, the open trigger differs by more than colour, the viewport takes its size
// from the size properties (and does not transition with data-instant), a positioned panel
// is capped at the available height, and reduced-motion and forced-colors rules exist.
import { afterEach, describe, expect, it } from "vitest"
import navigationMenu from "./navigation-menu.css?inline"
import { cleanup, files, inject, mount } from "./test-css"

afterEach(cleanup)

const sheet = () =>
  inject(
    `@layer rind.tokens, rind.themes, rind.components, rind.preferences;\n${files.tokens}\n${files.calm}\n${files.base}\n${navigationMenu}`,
  )

const menu = (viewport = "") => `
  <nav data-scope="navigation-menu" data-part="root">
    <ul data-scope="navigation-menu" data-part="list" data-orientation="horizontal">
      <li data-scope="navigation-menu" data-part="item">
        <button data-scope="navigation-menu" data-part="trigger" data-state="open" type="button">Products</button>
      </li>
      <li data-scope="navigation-menu" data-part="item">
        <button data-scope="navigation-menu" data-part="trigger" data-state="closed" type="button">Resources</button>
      </li>
      <li data-scope="navigation-menu" data-part="item">
        <a data-scope="navigation-menu" data-part="link" href="#p">Pricing</a>
      </li>
    </ul>
    ${viewport}
  </nav>`

const el = (host: Element, sel: string) => host.querySelector(sel) as HTMLElement

describe("Navigation Menu stylesheet", () => {
  it("triggers and links keep a 24px target and sit in a row", () => {
    sheet()
    const host = mount(menu())
    const [a, b] = host.querySelectorAll<HTMLElement>('[data-part="trigger"]')
    for (const t of [a, b, el(host, '[data-part="link"]')]) {
      const box = (t as HTMLElement).getBoundingClientRect()
      expect(box.height).toBeGreaterThanOrEqual(24)
      expect(box.width).toBeGreaterThanOrEqual(24)
    }
    expect((a as HTMLElement).getBoundingClientRect().top).toBe(
      (b as HTMLElement).getBoundingClientRect().top,
    )
  })

  it("the open trigger has an edge, not only a colour", () => {
    sheet()
    const host = mount(menu())
    const [open, closed] = host.querySelectorAll<HTMLElement>('[data-part="trigger"]')
    expect(getComputedStyle(open as HTMLElement).boxShadow).not.toBe("none")
    expect(getComputedStyle(closed as HTMLElement).boxShadow).toBe("none")
  })

  it("the viewport takes the size properties; data-instant skips the transition", () => {
    sheet()
    const host = mount(
      menu(
        `<div data-scope="navigation-menu" data-part="viewport" data-state="open" data-instant style="--rind-navigation-menu-viewport-width: 220px; --rind-navigation-menu-viewport-height: 120px"><p>Panel</p></div>`,
      ),
    )
    const v = el(host, '[data-part="viewport"]')
    const box = v.getBoundingClientRect()
    expect(Math.round(box.width)).toBe(220)
    expect(Math.round(box.height)).toBe(120)
    expect(getComputedStyle(v).transitionProperty).toBe("none")
  })

  it("a positioned panel is capped at the available height and scrolls", () => {
    sheet()
    const host = mount(
      `<div data-scope="navigation-menu" data-part="positioner" style="--rind-available-height: 100px"><div data-scope="navigation-menu" data-part="viewport" data-state="open"><div style="block-size: 400px"></div></div></div>`,
    )
    const v = el(host, '[data-part="viewport"]')
    expect(v.getBoundingClientRect().height).toBeLessThanOrEqual(100)
    expect(getComputedStyle(v).overflowY).toBe("auto")
  })

  it("reduced motion and forced colors", () => {
    expect(navigationMenu).toMatch(/@media \(prefers-reduced-motion: reduce\)[\s\S]*transition: none/)
    expect(navigationMenu).toMatch(/@media \(forced-colors: active\)[\s\S]*outline/)
  })
})
