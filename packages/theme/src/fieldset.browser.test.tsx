// add-fieldset 7.2: the Fieldset shrinks with its container and a long Legend wraps.
import { afterEach, describe, expect, it } from "vitest"
import fieldset from "./fieldset.css?inline"
import { cleanup, files, inject, mount, q, resolve } from "./test-css"

afterEach(cleanup)

const markup = `<div id="box" style="inline-size:320px">
  <fieldset data-scope="fieldset" data-part="root">
    <legend data-scope="fieldset" data-part="legend">A very long legend that has to wrap inside a narrow container instead of pushing the group wider than it</legend>
    <input aria-label="Street" style="inline-size:100%;box-sizing:border-box">
  </fieldset></div>`

describe("Fieldset stylesheet", () => {
  it("Stylesheet alone: tokens.css + fieldset.css only", () => {
    inject(
      `@layer rind.tokens, rind.themes, rind.components, rind.preferences;\n${files.tokens}\n${fieldset}`,
    )
    const root = q(mount(markup), "fieldset")
    const legend = q(root, "legend")
    expect(getComputedStyle(root).borderTopWidth).toBe("0px")
    expect(getComputedStyle(legend).fontWeight).toBe("600")
    expect(getComputedStyle(legend).color).toBe(resolve(legend, "color", "--rind-color-text"))
  })

  it("Legend in a 320px container wraps and nothing overflows horizontally", () => {
    inject(
      `@layer rind.tokens, rind.themes, rind.components, rind.preferences;\n${files.tokens}\n${fieldset}`,
    )
    const host = mount(markup)
    const box = q(host, "#box")
    const legend = q(host, "legend")
    expect(box.scrollWidth).toBeLessThanOrEqual(box.clientWidth)
    expect(q(host, "fieldset").scrollWidth).toBeLessThanOrEqual(q(host, "fieldset").clientWidth)
    expect(legend.getBoundingClientRect().height).toBeGreaterThan(
      Number.parseFloat(getComputedStyle(legend).lineHeight) * 1.5,
    )
  })
})
