import { act, render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { normalizeProps, VisuallyHidden } from "./index"
import { inertValue } from "./normalize-props"

describe("VisuallyHidden", () => {
  it("an icon button's hidden label is its accessible name, occupying no visible area", () => {
    render(
      <button type="button">
        <svg aria-hidden="true" width="16" height="16" />
        <VisuallyHidden>Close</VisuallyHidden>
      </button>,
    )
    const button = screen.getByRole("button", { name: "Close" })
    const label = screen.getByText("Close")
    expect(button).toBeDefined()
    expect(label.style.position).toBe("fixed")
    expect(label.style.overflow).toBe("hidden")
    expect(label.style.clipPath).toBe("inset(50%)")
    if (!navigator.userAgent.includes("jsdom")) {
      const rect = label.getBoundingClientRect()
      expect(rect.width * rect.height).toBeLessThanOrEqual(1)
    }
  })

  it("a focusable skip link becomes visible while focused", async () => {
    render(
      <VisuallyHidden focusable render={<a href="#main" />}>
        Skip to content
      </VisuallyHidden>,
    )
    const link = screen.getByRole("link", { name: "Skip to content" })
    expect(link.hasAttribute("data-visually-hidden")).toBe(true)
    await act(async () => link.focus())
    expect(link.hasAttribute("data-visually-hidden")).toBe(false)
    expect(link.style.position).toBe("")
    await act(async () => link.blur())
    expect(link.hasAttribute("data-visually-hidden")).toBe(true)
  })
})

describe("inert across React versions", () => {
  it("React 18: true → '' (attribute present), false → omitted", () => {
    expect(inertValue(true, 18)).toBe("")
    expect(inertValue(false, 18)).toBeUndefined()
  })

  it("React 19: booleans pass through and the attribute is set", () => {
    expect(inertValue(true, 19)).toBe(true)
    render(<div data-testid="i" {...normalizeProps({ inert: true })} />)
    expect(screen.getByTestId("i").hasAttribute("inert")).toBe(true)
  })
})
