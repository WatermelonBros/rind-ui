// add-file-upload 7.2: the File Upload stylesheet alone, on the markup core renders: the
// Dropzone's dashed border turns solid while dragging, Remove and Clear are at least 24 px, the
// layout holds in RTL, the forced-colors and reduced-motion rules.
import { afterEach, describe, expect, it } from "vitest"
import fileUpload from "./file-upload.css?inline"
import { cleanup, files, inject, mount, q } from "./test-css"

afterEach(cleanup)

const sheet = () =>
  inject(
    `@layer rind.tokens, rind.themes, rind.components, rind.preferences;\n${files.tokens}\n${files.calm}\n${files.base}\n${files.variants}\n${files.icons}\n${fileUpload}`,
  )

const attrs = (part: string, extra = "") =>
  `data-scope="file-upload" data-part="${part}" data-instance="u" ${extra}`

const markup = (
  flags = "",
  dir = "ltr",
) => `<div dir="${dir}" style="inline-size: 360px" ${attrs("root", flags)}>
  <span ${attrs("label", flags)}>Documents</span>
  <div ${attrs("dropzone", flags)}>Drop files here
    <button type="button" ${attrs("trigger", flags)}>Choose file</button>
  </div>
  <ul ${attrs("item-group", flags)}>
    <li ${attrs("item", flags)}><span ${attrs("item-name", flags)}>report.pdf</span><span ${attrs("item-size", flags)}>1.2 MB</span><button type="button" aria-label="Remove report.pdf" ${attrs("item-remove", flags)}></button></li>
  </ul>
  <button type="button" ${attrs("clear-trigger", flags)}>Clear</button>
</div>`

const zone = (host: HTMLElement) => getComputedStyle(q(host, '[data-part="dropzone"]'))

describe("File Upload stylesheet", () => {
  it("the Dropzone is dashed, solid while dragging (shape, not only colour)", () => {
    sheet()
    expect(zone(mount(markup())).borderTopStyle).toBe("dashed")
    cleanup()
    sheet()
    expect(zone(mount(markup("data-dragging"))).borderTopStyle).toBe("solid")
  })

  it("Remove and Clear are at least 24 x 24 px; an empty Remove draws an icon", () => {
    sheet()
    const host = mount(markup())
    for (const part of ["item-remove", "clear-trigger"]) {
      const box = q(host, `[data-part="${part}"]`).getBoundingClientRect()
      expect(box.width).toBeGreaterThanOrEqual(24)
      expect(box.height).toBeGreaterThanOrEqual(24)
    }
    expect(getComputedStyle(q(host, '[data-part="item-remove"]'), "::before").maskImage).toContain(
      "data:image/svg+xml",
    )
  })

  it("RTL: Remove sits at the inline end", () => {
    sheet()
    const host = mount(markup("", "rtl"))
    const item = q(host, '[data-part="item"]').getBoundingClientRect()
    const remove = q(host, '[data-part="item-remove"]').getBoundingClientRect()
    expect(remove.left - item.left).toBeLessThan(item.width / 4)
  })

  it("forced colors use system colours; reduced motion drops transitions", () => {
    expect(fileUpload).toMatch(/@media \(forced-colors: active\)[\s\S]*Highlight/)
    expect(fileUpload).toMatch(/@media \(prefers-reduced-motion: reduce\)[\s\S]*transition: none/)
  })
})
