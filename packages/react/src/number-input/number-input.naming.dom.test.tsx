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
  it("renders its connect parts under the host's scope and names", () => {
    const { container } = render(
      <NumberInputNaming value={{ scope: "host", part: (name) => `amount-${name}` }}>
        <Amount />
      </NumberInputNaming>,
    )
    const all = parts(container)
    for (const p of [
      "control",
      "input",
      "increment-trigger",
      "decrement-trigger",
      "hidden-input",
    ]) {
      expect(all).toContain(`host:amount-${p}`)
    }
    expect(all.some((p) => p.startsWith("number-input:") && !p.endsWith(":root"))).toBe(false)
  })

  it("keeps its own names without a host", () => {
    const { container } = render(<Amount />)
    expect(parts(container)).toContain("number-input:input")
  })
})
