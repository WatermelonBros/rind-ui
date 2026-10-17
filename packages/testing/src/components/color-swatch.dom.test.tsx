// Color Swatch through its driver (color-swatch spec): name, consumer name, children, alpha,
// server render. Runs in jsdom and in real browsers.
import { ColorSwatch } from "@rind-ui/react"
import { render, screen } from "@testing-library/react"
import axe from "axe-core"
import { renderToString } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { getColorSwatch } from "../index"

const a11y = async () => {
  const { violations } = await axe.run(document.body, {
    rules: { region: { enabled: false }, "color-contrast": { enabled: false } },
  })
  if (violations.length > 0) throw new Error(violations.map((v) => `${v.id}: ${v.help}`).join("\n"))
}

describe("getColorSwatch", () => {
  it("reads the colour by name", async () => {
    render(<ColorSwatch.Root color="#FF0000" />)
    const s = getColorSwatch(screen, { name: "vibrant red" })
    expect(await s.color("hex")).toBe("#FF0000")
    expect(await s.colorName()).toBe("vibrant red")
    expect(await s.isTransparent()).toBe(false)
    await a11y()
  })

  it("consumer name and label", async () => {
    render(<ColorSwatch.Root color="#FF0000" colorName="Brand red" aria-label="Primary" />)
    expect(screen.getByRole("img", { name: "Brand red, Primary" })).toBeTruthy()
  })

  it("children render inside, name unchanged (react-spectrum#7262)", async () => {
    render(
      <ColorSwatch.Root color="#0000FF">
        <span data-testid="check">✓</span>
      </ColorSwatch.Root>,
    )
    const img = screen.getByRole("img", { name: "vibrant blue" })
    expect(img.contains(screen.getByTestId("check"))).toBe(true)
  })

  it("alpha", async () => {
    render(<ColorSwatch.Root color="#FF000080" />)
    expect(await getColorSwatch(screen, { name: /transparent/ }).isTransparent()).toBe(true)
  })

  it("attributes forwarded; not focusable; server render", () => {
    const html = renderToString(<ColorSwatch.Root color="#336699" data-testid="sw" className="c" />)
    expect(html).toContain('role="img"')
    expect(html).toContain("--rind-color:#336699")
    render(<ColorSwatch.Root color="#336699" data-testid="sw" className="c" />)
    const el = screen.getByTestId("sw")
    expect(el.className).toBe("c")
    expect(el.tabIndex).toBe(-1)
  })
})
