// Hosted naming (color-picker-one-scope): a Number Input rendered as another component's part
// carries the host's scope and part names; without a host it keeps its own.
import { render } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { NumberInput, NumberInputNaming } from "./number-input"

const parts = (root: HTMLElement) =>
  [...root.querySelectorAll("[data-scope]")].map(
    (el) => `${el.getAttribute("data-scope")}:${el.getAttribute("data-part")}`,
  )

const Amount = () => (
  <NumberInput.Root defaultValue={3}>
    <NumberInput.Label>Amount</NumberInput.Label>
    <NumberInput.Control>
      <NumberInput.Input />
      <NumberInput.IncrementTrigger />
      <NumberInput.DecrementTrigger />
    </NumberInput.Control>
  </NumberInput.Root>
)

describe("Number Input: hosted naming", () => {
  it("renders every part under the host's scope and names", () => {
    const { container } = render(
      <NumberInputNaming value={{ scope: "host", part: (name) => `amount-${name}` }}>
        <Amount />
      </NumberInputNaming>,
    )
    // Every part, under the host's names; the Label is the Field host's own part (its scope follows
    // the host, its name is the Field's: a Color Picker's inputs render no Label).
    expect(parts(container)).toEqual([
      "host:amount-root",
      "host:label",
      "host:amount-control",
      "host:amount-input",
      "host:amount-increment-trigger",
      "host:amount-decrement-trigger",
      "host:amount-hidden-input",
    ])
  })

  it("keeps its own names without a host", () => {
    const { container } = render(<Amount />)
    expect(parts(container)).toEqual([
      "number-input:root",
      "number-input:label",
      "number-input:control",
      "number-input:input",
      "number-input:increment-trigger",
      "number-input:decrement-trigger",
      "number-input:hidden-input",
    ])
  })
})
