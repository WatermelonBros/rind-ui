// Hosted naming (color-picker-one-scope): a Slider rendered as another component's part carries
// the host's scope and part names; without a host it keeps its own.
import { render } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { Slider, SliderNaming } from "./slider"

const parts = (root: HTMLElement) =>
  [...root.querySelectorAll("[data-scope]")].map(
    (el) => `${el.getAttribute("data-scope")}:${el.getAttribute("data-part")}`,
  )

const Bar = () => (
  <Slider.Root defaultValue={[30]} aria-label="Volume">
    <Slider.Control>
      <Slider.Track>
        <Slider.Indicator />
        <Slider.Thumb index={0} />
      </Slider.Track>
    </Slider.Control>
  </Slider.Root>
)

describe("Slider: hosted naming", () => {
  it("renders every part under the host's scope and names", () => {
    const { container } = render(
      <SliderNaming value={{ scope: "host", part: (name) => `bar-${name}` }}>
        <Bar />
      </SliderNaming>,
    )
    expect(parts(container)).toEqual([
      "host:bar-root",
      "host:bar-control",
      "host:bar-track",
      "host:bar-indicator",
      "host:bar-thumb",
      "host:bar-hidden-input",
    ])
  })

  it("keeps its own names without a host", () => {
    const { container } = render(<Bar />)
    expect(parts(container)).toEqual([
      "slider:root",
      "slider:control",
      "slider:track",
      "slider:indicator",
      "slider:thumb",
      "slider:hidden-input",
    ])
  })
})
