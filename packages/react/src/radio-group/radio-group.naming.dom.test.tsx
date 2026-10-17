// Hosted naming (color-picker-one-scope): a Radio Group rendered as another component's part
// carries the host's scope, its radio name and part names; without a host it keeps its own.
import { render } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { RadioGroup, RadioGroupNaming } from "./radio-group"

const parts = (root: HTMLElement) => [
  ...new Set(
    [...root.querySelectorAll("[data-scope]")].map(
      (el) => `${el.getAttribute("data-scope")}:${el.getAttribute("data-part")}`,
    ),
  ),
]

const Sizes = () => (
  <RadioGroup.Root aria-label="Size" defaultValue="s" name="size">
    <RadioGroup.Item value="s">
      <RadioGroup.ItemControl aria-label="Small">
        <RadioGroup.ItemIndicator />
      </RadioGroup.ItemControl>
    </RadioGroup.Item>
  </RadioGroup.Root>
)

describe("Radio Group: hosted naming", () => {
  it("renders every part under the host's scope and names", () => {
    const { container } = render(
      <RadioGroupNaming
        value={{ scope: "host", control: "choice", part: (name) => `size-${name}` }}
      >
        <Sizes />
      </RadioGroupNaming>,
    )
    expect(parts(container)).toEqual([
      "host:size-root",
      "host:size-item",
      "host:choice",
      "host:size-item-indicator",
      "host:size-hidden-input",
    ])
  })

  it("keeps its own names without a host", () => {
    const { container } = render(<Sizes />)
    expect(parts(container)).toEqual([
      "radio-group:root",
      "radio-group:item",
      "radio-group:item-control",
      "radio-group:item-indicator",
      "radio-group:hidden-input",
    ])
  })
})
