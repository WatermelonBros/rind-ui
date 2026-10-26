// Angle Slider (React) through its driver (spec angle-slider): one native range input named by
// the Label with the angle in words; arrows, Shift, Home and End; wrapping; the Value; markers;
// the form value and reset; server HTML and hydration. Pointer angles need layout:
// angle-slider.browser.test.tsx.
import { AngleSlider, type AngleSliderRootProps, RindProvider } from "@rind-ui/react"
import { act, render } from "@testing-library/react"
import axe from "axe-core"
import { StrictMode } from "react"
import { hydrateRoot } from "react-dom/client"
import { renderToString } from "react-dom/server"
import { afterEach, describe, expect, it, vi } from "vitest"
import { getAngleSlider } from "../index"

afterEach(() => vi.restoreAllMocks())

const settle = () => act(async () => {})

function Slider(props: Partial<AngleSliderRootProps>) {
  return (
    <AngleSlider.Root name="heading" defaultValue={90} {...props}>
      <AngleSlider.Label>Heading</AngleSlider.Label>
      <AngleSlider.Control style={{ width: 120, height: 120 }}>
        <AngleSlider.MarkerGroup>
          {[0, 90, 180, 270].map((v) => (
            <AngleSlider.Marker key={v} value={v} />
          ))}
        </AngleSlider.MarkerGroup>
        <AngleSlider.Thumb>
          <AngleSlider.Input />
        </AngleSlider.Thumb>
      </AngleSlider.Control>
      <AngleSlider.Value />
    </AngleSlider.Root>
  )
}

function setup(props: Partial<AngleSliderRootProps> = {}) {
  const r = render(
    <RindProvider locale="en-US">
      <form>
        <Slider {...props} />
      </form>
    </RindProvider>,
  )
  const q = (sel: string) => r.container.querySelector<HTMLElement>(sel)
  return {
    host: r.container,
    q,
    input: () => q('[data-part="input"]') as HTMLInputElement,
    d: () => getAngleSlider(document.body, { label: "Heading" }),
  }
}

describe("React AngleSlider", () => {
  it("is one native range input named by the Label, with the angle in words", async () => {
    const t = setup()
    await settle()
    const input = t.input()
    expect(input.type).toBe("range")
    expect(input.getAttribute("aria-labelledby")).toBe(t.q('[data-part="label"]')?.id)
    expect(await t.d().valueText()).toBe("90 degrees")
    expect(input.max).toBe("359")
    // The Input inside the Thumb stays in the accessibility tree.
    expect(t.q('[data-part="thumb"]')?.hasAttribute("aria-hidden")).toBe(false)
    expect(t.q('[data-part="value"]')?.textContent).toBe("90°")
    expect(t.q('[data-part="root"]')?.style.getPropertyValue("--rind-angle-slider-angle")).toBe(
      "90deg",
    )
    expect(t.q('[data-part="marker"][data-value="180"]')?.dataset["state"]).toBe("over-value")
    const { violations } = await axe.run(t.host, {
      rules: { region: { enabled: false }, "color-contrast": { enabled: false } },
    })
    expect(violations.map((v) => v.id)).toEqual([])
  })

  it("arrows step, Shift steps 15, Home and End reach the ends; past an end it wraps", async () => {
    const onValueCommit = vi.fn()
    const t = setup({ onValueCommit })
    await settle()
    const d = t.d()
    await d.step(2)
    expect(await d.value()).toBe(92)
    await d.toEdge("max")
    expect(await d.value()).toBe(359)
    await d.step(1)
    expect(await d.value()).toBe(0)
    await d.step(-1)
    expect(await d.value()).toBe(359)
    await d.toEdge("min")
    expect(await d.value()).toBe(0)
    expect(onValueCommit).toHaveBeenLastCalledWith(0, { reason: "keyboard" })
  })

  it("read-only keeps the angle; disabled takes no focus", async () => {
    const t = setup({ readOnly: true })
    await settle()
    await t.d().step(3)
    expect(await t.d().value()).toBe(90)
  })

  it("submits the angle and restores the default on a form reset", async () => {
    const t = setup()
    await settle()
    await t.d().step(5)
    expect(new FormData(t.host.querySelector("form") as HTMLFormElement).get("heading")).toBe("95")
    act(() => (t.host.querySelector("form") as HTMLFormElement).reset())
    await vi.waitFor(async () => expect(await t.d().value()).toBe(90))
    // An <output> would reset its own text here (WebKit, jsdom): the Value is a span.
    expect(t.q('[data-part="value"]')?.textContent).toBe("90°")
  })

  it("server HTML hydrates without a warning", async () => {
    const tree = (
      <StrictMode>
        <RindProvider locale="en-US">
          <Slider />
        </RindProvider>
      </StrictMode>
    )
    const container = document.createElement("div")
    container.innerHTML = renderToString(tree)
    expect(container.querySelector('[data-part="value"]')?.textContent).toBe("90°")
    document.body.append(container)
    const error = vi.spyOn(console, "error").mockImplementation(() => {})
    let root: ReturnType<typeof hydrateRoot> | undefined
    await act(async () => {
      root = hydrateRoot(container, tree, { onRecoverableError: (e) => error(String(e)) })
    })
    expect(error.mock.calls).toEqual([])
    await act(async () => root?.unmount())
    container.remove()
  })
})
