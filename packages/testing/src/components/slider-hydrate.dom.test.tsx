// Slider server markup (task 4.2): values, ARIA and positions are in the HTML (RX#615),
// `contain` needs no script (Zag hidden-until-measured), React never gets a controlled
// `value` on the inputs, and hydration is clean.
import { Slider, type SliderRootProps } from "@rind-ui/react"
import { act } from "@testing-library/react"
import type { ReactNode } from "react"
import { hydrateRoot } from "react-dom/client"
import { renderToString } from "react-dom/server"
import { afterEach, describe, expect, it, vi } from "vitest"

afterEach(() => vi.restoreAllMocks())

const tree = (props: SliderRootProps = {}) => {
  const given = props.value ?? props.defaultValue
  const count = Array.isArray(given) ? given.length : 1
  return (
    <form>
      <Slider.Root name="price" {...props}>
        <Slider.Label>Price</Slider.Label>
        <Slider.Control>
          {Array.from({ length: count }, (_, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: thumbs are identified by index
            <Slider.Thumb key={i} index={i} />
          ))}
        </Slider.Control>
      </Slider.Root>
    </form>
  )
}

const server = (node: ReactNode) => {
  const box = document.createElement("div")
  box.innerHTML = renderToString(node)
  return box
}

async function hydrate(node: ReactNode) {
  const container = server(node)
  document.body.append(container)
  const error = vi.spyOn(console, "error").mockImplementation(() => {})
  let root: ReturnType<typeof hydrateRoot> | undefined
  await act(async () => {
    root = hydrateRoot(container, node, { onRecoverableError: (e) => error(String(e)) })
  })
  const values = Array.from(container.querySelectorAll("input")).map((i) => i.value)
  const calls = [...error.mock.calls]
  await act(async () => root?.unmount())
  container.remove()
  return { calls, values }
}

describe("Slider server render", () => {
  it("Server render of a range slider (RX#615): value, aria-valuenow and position in the HTML", () => {
    const box = server(tree({ defaultValue: [20, 80] }))
    const inputs = Array.from(box.querySelectorAll("input"))
    expect(inputs.map((i) => i.value)).toEqual(["20", "80"])
    expect(inputs.map((i) => i.getAttribute("aria-valuenow"))).toEqual(["20", "80"])
    expect(inputs.map((i) => i.getAttribute("value"))).toEqual(["20", "80"])
    const thumbs = Array.from(box.querySelectorAll<HTMLElement>('[data-part="thumb"]'))
    expect(thumbs.map((t) => t.style.getPropertyValue("inset-inline-start"))).toEqual([
      "20%",
      "80%",
    ])
    expect([...new FormData(box.querySelector("form") as HTMLFormElement)]).toEqual([
      ["price", "20"],
      ["price", "80"],
    ])
  })

  it("Contain on the server: positioned in the HTML, no inline script", () => {
    const box = server(tree({ defaultValue: 30, thumbAlignment: "contain" }))
    expect(box.querySelector("script")).toBeNull()
    const thumb = box.querySelector<HTMLElement>('[data-part="thumb"]')
    expect(thumb?.style.getPropertyValue("inset-inline-start")).toContain(
      "--rind-slider-thumb-size",
    )
    expect(thumb?.hasAttribute("hidden")).toBe(false)
  })

  it("a controlled value reaches the HTML as the default attribute only once, never as a prop", () => {
    // React renders a controlled `value` prop as the attribute too; the Slider passes none.
    const box = server(tree({ value: 60, defaultValue: 10 }))
    const input = box.querySelector("input") as HTMLInputElement
    expect(input.getAttribute("value")).toBe("10")
    expect(input.getAttribute("aria-valuenow")).toBe("60")
  })

  it("hydrates single and range sliders with zero console errors", async () => {
    for (const props of [{ defaultValue: 40 }, { defaultValue: [20, 80] }, { value: [10, 90] }]) {
      const { calls, values } = await hydrate(tree(props))
      expect(calls).toEqual([])
      expect(values.length).toBeGreaterThan(0)
    }
  })

  it("after hydration a controlled input shows the value (property), not the default", async () => {
    const { values } = await hydrate(tree({ value: 60, defaultValue: 10 }))
    expect(values).toEqual(["60"])
  })
})
