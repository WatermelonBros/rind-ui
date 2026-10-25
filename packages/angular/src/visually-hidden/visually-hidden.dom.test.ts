// VisuallyHidden: an icon button's hidden label, a focusable skip link, and parity with React.
import { Component } from "@angular/core"
import * as R from "@rind-ui/react"
import { screen } from "@testing-library/dom"
import { createElement as r } from "react"
import { describe, expect, it, vi } from "vitest"
import { mount } from "../../fixtures/mount"
import { both } from "../../fixtures/parity"
import { VisuallyHidden } from "./visually-hidden"

@Component({
  selector: "rind-f",
  imports: [VisuallyHidden],
  template: `<div><button type="button">
      <svg aria-hidden="true" width="16" height="16"></svg>
      <span rindVisuallyHidden>Close</span>
    </button>
    <a rindVisuallyHidden focusable href="#main">Skip to content</a></div>`,
})
class Tree {}

describe("Angular VisuallyHidden", () => {
  it("an icon button's hidden label is its accessible name, occupying no visible area", async () => {
    await mount(Tree)
    expect(screen.getByRole("button", { name: "Close" })).toBeDefined()
    const label = screen.getByText("Close")
    expect(label.style.position).toBe("fixed")
    expect(label.style.overflow).toBe("hidden")
    if (!navigator.userAgent.includes("jsdom")) {
      const rect = label.getBoundingClientRect()
      expect(rect.width * rect.height).toBeLessThanOrEqual(1)
    }
  })

  it("a focusable skip link becomes visible while focused", async () => {
    await mount(Tree)
    const link = screen.getByRole("link", { name: "Skip to content" })
    expect(link.hasAttribute("data-visually-hidden")).toBe(true)
    link.focus()
    await vi.waitFor(() => expect(link.hasAttribute("data-visually-hidden")).toBe(false))
    expect(link.style.position).toBe("")
    link.blur()
    await vi.waitFor(() => expect(link.hasAttribute("data-visually-hidden")).toBe(true))
  })

  it("matches React", async () => {
    await both(
      r(
        "div",
        null,
        r(
          "button",
          { type: "button" },
          r("svg", { "aria-hidden": "true", width: "16", height: "16" }),
          r(R.VisuallyHidden, null, "Close"),
        ),
        r(
          R.VisuallyHidden,
          { focusable: true, render: r("a", { href: "#main" }) },
          "Skip to content",
        ),
      ),
      Tree,
    )
  })
})
