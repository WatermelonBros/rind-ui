// Color Wheel (React) through its driver (spec color-wheel): one range input named by the Label
// with Color Slider's value text; only the hue changes; a grey keeps its hue; wrapping; the hex
// in forms and a reset to the default colour; server HTML and hydration. Pointer presses need
// layout: color-wheel.browser.test.tsx.
import { formatColor } from "@rind-ui/core"
import { ColorWheel, type ColorWheelRootProps, RindProvider } from "@rind-ui/react"
import { act, render } from "@testing-library/react"
import axe from "axe-core"
import { StrictMode } from "react"
import { hydrateRoot } from "react-dom/client"
import { renderToString } from "react-dom/server"
import { afterEach, describe, expect, it, vi } from "vitest"
import { getColorWheel } from "../index"

afterEach(() => vi.restoreAllMocks())

const settle = () => act(async () => {})

function Wheel(props: Partial<ColorWheelRootProps>) {
  return (
    <ColorWheel.Root name="accent" defaultValue="hsl(240 80% 40%)" {...props}>
      <ColorWheel.Label>Accent hue</ColorWheel.Label>
      <ColorWheel.Track style={{ width: 160, height: 160 }}>
        <ColorWheel.Thumb>
          <ColorWheel.Input />
        </ColorWheel.Thumb>
      </ColorWheel.Track>
      <ColorWheel.Value />
    </ColorWheel.Root>
  )
}

function setup(props: Partial<ColorWheelRootProps> = {}) {
  const r = render(
    <RindProvider locale="en-US">
      <form>
        <Wheel {...props} />
      </form>
    </RindProvider>,
  )
  const q = (sel: string) => r.container.querySelector<HTMLElement>(sel)
  return {
    host: r.container,
    q,
    form: () => r.container.querySelector("form") as HTMLFormElement,
    d: () => getColorWheel(document.body, { label: "Accent hue" }),
  }
}

describe("React ColorWheel", () => {
  it("is a group with one range input named by the Label, the hue in words", async () => {
    const t = setup()
    await settle()
    expect(t.q('[data-part="root"]')?.getAttribute("role")).toBe("group")
    expect(await t.d().hue()).toBe(240)
    expect(await t.d().valueText()).toBe("Hue 240°, blue")
    expect(t.q('[data-part="value"]')?.textContent).toBe("240°")
    expect(
      t.q('[data-part="track"]')?.style.getPropertyValue("--rind-color-wheel-gradient"),
    ).toMatch(/^conic-gradient/)
    const { violations } = await axe.run(t.host, {
      rules: { region: { enabled: false }, "color-contrast": { enabled: false } },
    })
    expect(violations.map((v) => v.id)).toEqual([])
  })

  it("a key changes only the hue; past 359 it wraps to 0", async () => {
    const onValueChange = vi.fn()
    const onValueCommit = vi.fn()
    const t = setup({ defaultValue: "hsl(0 80% 40%)", onValueChange, onValueCommit })
    await settle()
    await t.d().step(120)
    expect(formatColor(onValueChange.mock.lastCall?.[0], "css")).toBe("hsl(120, 80%, 40%)")
    expect(onValueCommit.mock.lastCall?.[1]).toEqual({ reason: "keyboard" })
    await t.d().toEdge("max")
    await t.d().step(1)
    expect(await t.d().hue()).toBe(0)
  })

  it("a grey keeps the hue it was given", async () => {
    const t = setup({ defaultValue: "#808080" })
    await settle()
    await t.d().step(200)
    expect(await t.d().hue()).toBe(200)
    expect(t.q('[data-part="root"]')?.style.getPropertyValue("--rind-color-wheel-angle")).toBe(
      "200deg",
    )
  })

  it("submits the colour as hex and a form reset restores the default colour", async () => {
    const t = setup({ defaultValue: "#ff0000" })
    await settle()
    expect(new FormData(t.form()).get("accent")).toBe("#FF0000")
    await t.d().step(120)
    expect(new FormData(t.form()).get("accent")).toBe("#00FF00")
    act(() => t.form().reset())
    await vi.waitFor(async () => expect(await t.d().hue()).toBe(0))
    expect(new FormData(t.form()).get("accent")).toBe("#FF0000")
    expect(t.q('[data-part="value"]')?.textContent).toBe("0°")
  })

  it("server HTML hydrates without a warning", async () => {
    const tree = (
      <StrictMode>
        <RindProvider locale="en-US">
          <Wheel />
        </RindProvider>
      </StrictMode>
    )
    const container = document.createElement("div")
    container.innerHTML = renderToString(tree)
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
