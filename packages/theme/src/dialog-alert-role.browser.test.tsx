// Confirmations in dialog.css (merge-alert-dialog-into-dialog, formerly add-alert-dialog 6.1):
// --rind-alert-dialog-* tokens that fall back to the dialog ones, an end-aligned actions row,
// reduced motion and forced colors.
import { afterEach, describe, expect, it } from "vitest"
import dialog from "./dialog.css?inline"
import { cleanup, files, inject, mount, q } from "./test-css"

afterEach(cleanup)

const sheet = () =>
  inject(
    `@layer rind.tokens, rind.themes, rind.components, rind.preferences;\n${files.tokens}\n${files.calm}\n${files.base}\n${files.overlay}\n${files.positioner}\n${dialog}`,
  )

const markup = `<div data-scope="dialog" data-part="backdrop" data-state="open" aria-hidden="true"></div><div data-scope="dialog" data-part="positioner" data-state="open"><div role="alertdialog" aria-label="A" data-scope="dialog" data-part="content" data-state="open"><h2 data-scope="dialog" data-part="title">Delete?</h2><p data-scope="dialog" data-part="description">Cannot be undone.</p><button data-scope="dialog" data-part="cancel">Cancel</button><button data-scope="dialog" data-part="action">Delete</button></div></div>`

describe("dialog.css: role=alertdialog", () => {
  it("is a bordered, rounded, centred surface (shared with the dialog sheet)", () => {
    sheet()
    const host = mount(markup)
    const c = q(host, '[data-part="content"]')
    const s = getComputedStyle(c)
    expect(Number.parseFloat(s.borderTopWidth)).toBeGreaterThan(0)
    expect(Number.parseFloat(s.borderTopLeftRadius)).toBeGreaterThan(0)
    expect(getComputedStyle(q(host, '[data-part="backdrop"]')).position).toBe("fixed")
    expect(Math.abs(c.offsetLeft + c.offsetWidth / 2 - innerWidth / 2)).toBeLessThan(10)
  })

  it("Cancel and Action are an end-aligned row under the message", () => {
    sheet()
    const host = mount(markup)
    const cancel = q(host, '[data-part="cancel"]')
    const action = q(host, '[data-part="action"]')
    const description = q(host, '[data-part="description"]')
    const content = q(host, '[data-part="content"]')
    expect(cancel.getBoundingClientRect().top).toBeGreaterThan(
      description.getBoundingClientRect().bottom - 1,
    )
    expect(
      Math.abs(cancel.getBoundingClientRect().top - action.getBoundingClientRect().top),
    ).toBeLessThan(2)
    expect(cancel.getBoundingClientRect().left).toBeLessThan(action.getBoundingClientRect().left)
    // The row ends at the content's inline end (inside its padding).
    const padding = Number.parseFloat(getComputedStyle(content).paddingRight)
    expect(
      Math.abs(
        content.getBoundingClientRect().right - padding - action.getBoundingClientRect().right,
      ),
    ).toBeLessThan(2)
    expect(cancel.offsetHeight).toBeGreaterThanOrEqual(24)
    expect(action.offsetWidth).toBeGreaterThanOrEqual(24)
  })

  it("reads --rind-alert-dialog-* and falls back to --rind-dialog-*", () => {
    sheet()
    const own = mount(
      `<div style="--rind-alert-dialog-bg:rgb(1, 2, 3);--rind-dialog-bg:rgb(9, 9, 9);--rind-alert-dialog-max-width:300px;--rind-alert-dialog-padding:11px">${markup}</div>`,
    )
    const c = getComputedStyle(q(own, '[data-part="content"]'))
    expect(c.backgroundColor).toBe("rgb(1, 2, 3)")
    expect(c.maxWidth).toBe("300px")
    expect(c.paddingTop).toBe("11px")
    const fallback = mount(
      `<div style="--rind-dialog-bg:rgb(4, 5, 6);--rind-dialog-radius:7px;--rind-dialog-max-width:310px">${markup}</div>`,
    )
    const f = getComputedStyle(q(fallback, '[data-part="content"]'))
    expect(f.backgroundColor).toBe("rgb(4, 5, 6)")
    expect(f.borderTopLeftRadius).toBe("7px")
    expect(f.maxWidth).toBe("310px")
  })

  it("has reduced-motion and forced-colors rules (border and focus ring)", () => {
    expect(dialog).toMatch(/@media \(prefers-reduced-motion: reduce\)[\s\S]*transition: none/)
    expect(dialog).toMatch(/@media \(forced-colors: active\)[\s\S]*border-color: CanvasText/)
    expect(dialog).toMatch(
      /@media \(forced-colors: active\)[\s\S]*data-focus-visible[\s\S]*outline: 2px solid Highlight/,
    )
    expect(dialog).not.toMatch(/data-(variant|size|tone)/)
  })
})
