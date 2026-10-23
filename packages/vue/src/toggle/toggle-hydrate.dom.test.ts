// Toggle server markup hydrates with no mismatch; ids come from useId on both sides.
import { afterEach, describe, expect, it, vi } from "vitest"
import { createSSRApp, h } from "vue"
import { renderToString } from "vue/server-renderer"
import { Toggle } from "../index"

afterEach(() => vi.restoreAllMocks())

const tree = () => ({
  render: () => [
    h(Toggle.Root, { defaultPressed: true }, () => ["Bold", h(Toggle.Indicator, null, () => "✓")]),
    h(Toggle.Root, null, () => "Italic"),
  ],
})

describe("Vue Toggle hydration", () => {
  it("server HTML is pressed and labelled; hydrates with zero warnings", async () => {
    const container = document.body.appendChild(document.createElement("div"))
    container.innerHTML = await renderToString(createSSRApp(tree()))
    const [bold, italic] = Array.from(container.querySelectorAll("button"))
    expect(bold?.getAttribute("aria-pressed")).toBe("true")
    expect(italic?.getAttribute("aria-pressed")).toBe("false")
    expect(bold?.getAttribute("data-instance")).not.toBe(italic?.getAttribute("data-instance"))

    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    const error = vi.spyOn(console, "error").mockImplementation(() => {})
    const app = createSSRApp(tree())
    app.mount(container)
    expect([...warn.mock.calls, ...error.mock.calls]).toEqual([])
    bold?.click()
    await vi.waitFor(() => expect(bold?.getAttribute("aria-pressed")).toBe("false"))
    app.unmount()
    container.remove()
  })
})
