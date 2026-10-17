// One component per control (merge-single-into-group): an Item alone is the single control
// (no group wrapper, no roving), an Item in a Root belongs to the group; the item indicator
// works in both shapes.
import { CheckboxGroup, ToggleGroup } from "@rind-ui/react"
import { render, screen } from "@testing-library/react"
import { userEvent } from "@testing-library/user-event"
import { describe, expect, it } from "vitest"

describe("ToggleGroup.Item", () => {
  it("alone: a single toggle button, no group, its own pressed state and indicator", async () => {
    const user = userEvent.setup()
    render(
      <ToggleGroup.Item aria-label="Bold">
        <ToggleGroup.ItemIndicator fallback="off">on</ToggleGroup.ItemIndicator>
      </ToggleGroup.Item>,
    )
    const b = screen.getByRole("button", { name: "Bold" })
    expect(screen.queryByRole("group")).toBe(null)
    expect(b.getAttribute("aria-pressed")).toBe("false")
    expect(b.textContent).toBe("off")
    await user.click(b)
    expect(b.getAttribute("aria-pressed")).toBe("true")
    expect(b.textContent).toBe("on")
    expect(b.getAttribute("tabindex")).toBe(null)
  })

  it("in a Root: part of the group's value; its indicator follows the item", async () => {
    const user = userEvent.setup()
    render(
      <ToggleGroup.Root aria-label="Format" selectionMode="multiple">
        <ToggleGroup.Item value="bold" aria-label="Bold">
          <ToggleGroup.ItemIndicator fallback="off">on</ToggleGroup.ItemIndicator>
        </ToggleGroup.Item>
        <ToggleGroup.Item value="italic" aria-label="Italic" />
      </ToggleGroup.Root>,
    )
    expect(screen.getByRole("group", { name: "Format" })).toBeTruthy()
    const bold = screen.getByRole("button", { name: "Bold" })
    await user.click(bold)
    expect(bold.getAttribute("aria-pressed")).toBe("true")
    expect(bold.textContent).toBe("on")
    const indicator = bold.querySelector('[data-part="item-indicator"]')
    expect(indicator?.getAttribute("data-state")).toBe("on")
  })
})

describe("CheckboxGroup.Item", () => {
  it("alone: a single checkbox, no group", async () => {
    const user = userEvent.setup()
    render(
      <CheckboxGroup.Item>
        <CheckboxGroup.ItemControl>
          <CheckboxGroup.ItemIndicator>✓</CheckboxGroup.ItemIndicator>
        </CheckboxGroup.ItemControl>
        <CheckboxGroup.ItemLabel>Accept</CheckboxGroup.ItemLabel>
      </CheckboxGroup.Item>,
    )
    const c = screen.getByRole("checkbox", { name: "Accept" })
    expect(screen.queryByRole("group")).toBe(null)
    await user.click(c)
    expect(c.getAttribute("aria-checked")).toBe("true")
  })

  it("in a Root: its value joins the group's", async () => {
    const user = userEvent.setup()
    let value: readonly string[] = []
    render(
      <CheckboxGroup.Root onValueChange={(v: readonly string[]) => (value = v)}>
        <CheckboxGroup.Label>Toppings</CheckboxGroup.Label>
        <CheckboxGroup.Item value="cheese">
          <CheckboxGroup.ItemControl />
          <CheckboxGroup.ItemLabel>Cheese</CheckboxGroup.ItemLabel>
        </CheckboxGroup.Item>
      </CheckboxGroup.Root>,
    )
    await user.click(screen.getByRole("checkbox", { name: "Cheese" }))
    expect(value).toEqual(["cheese"])
  })
})
