import { afterEach, describe, expect, it } from "vitest"
import { injectStyle } from "./inject-style"

const styles = (doc: Document, id: string) =>
  doc.head.querySelectorAll(`style[data-rind-style="${id}"]`)
const resetAll = () => {
  const resets = Reflect.get(globalThis, Symbol.for("rind-ui.resets")) as Set<() => void>
  for (const reset of resets ?? []) reset()
}
afterEach(resetAll)

describe("injectStyle", () => {
  it("inserts once per document and id, in an anonymous layer", () => {
    injectStyle(document, "demo", ".a { color: red }")
    injectStyle(document, "demo", ".a { color: red }")
    injectStyle(document, "other", ".b { color: blue }")
    expect(styles(document, "demo")).toHaveLength(1)
    expect(styles(document, "other")).toHaveLength(1)
    expect(styles(document, "demo")[0]?.textContent).toBe("@layer { .a { color: red } }")
  })

  it("an iframe gets its own element", () => {
    const frame = document.createElement("iframe")
    document.body.append(frame)
    const inner = frame.contentDocument as Document
    injectStyle(document, "demo", ".a {}")
    injectStyle(inner, "demo", ".a {}")
    expect(styles(document, "demo")).toHaveLength(1)
    expect(styles(inner, "demo")).toHaveLength(1)
    frame.remove()
  })

  it("carries the CSP nonce", () => {
    injectStyle(document, "demo", ".a {}", { style: { nonce: "abc" } })
    const style = styles(document, "demo")[0] as HTMLStyleElement
    // Browsers hide the nonce attribute once inserted; the property keeps it.
    expect(style.nonce || style.getAttribute("nonce")).toBe("abc")
  })

  it("does nothing without a document (server rendering)", () => {
    expect(() => injectStyle(undefined, "demo", ".a {}")).not.toThrow()
    expect(() => injectStyle(null, "demo", ".a {}")).not.toThrow()
  })

  it("the test reset removes what it inserted", () => {
    injectStyle(document, "demo", ".a {}")
    resetAll()
    expect(styles(document, "demo")).toHaveLength(0)
  })
})
