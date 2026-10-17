// Color Area scenarios through its driver (color-area spec): anatomy, names, keyboard with
// focus following a cross-axis key, assistive-technology adjustment, read-only, forms and
// reset, server render and hydration. Runs in jsdom and in real browsers.
import { act, fireEvent, render, screen } from "@testing-library/react"
import axe from "axe-core"
import { useState } from "react"
import { hydrateRoot } from "react-dom/client"
import { renderToString } from "react-dom/server"
import { afterEach, describe, expect, it, vi } from "vitest"
import { ColorArea, type ColorAreaRootProps, getColorArea } from "./color-parts"

afterEach(() => vi.restoreAllMocks())

const a11y = async () => {
  const { violations } = await axe.run(document.body, {
    rules: { region: { enabled: false }, "color-contrast": { enabled: false } },
  })
  if (violations.length > 0) throw new Error(violations.map((v) => `${v.id}: ${v.help}`).join("\n"))
}

const Area = (props: ColorAreaRootProps) => (
  <ColorArea.Root aria-label="Fill" defaultValue="hsb(200, 50%, 80%)" {...props}>
    <ColorArea.Background />
    <ColorArea.Thumb />
  </ColorArea.Root>
)

describe("anatomy and names", () => {
  it("exactly two sliders, both range inputs, named per axis", async () => {
    render(<Area data-testid="area" className="c" />)
    const sliders = screen.getAllByRole("slider")
    expect(sliders).toHaveLength(2)
    expect(sliders.every((s) => s instanceof HTMLInputElement && s.type === "range")).toBe(true)
    expect(screen.getByRole("slider", { name: "Fill Saturation" })).toBeTruthy()
    expect(screen.getByRole("slider", { name: "Fill Brightness" })).toBeTruthy()
    expect(screen.getByTestId("area").className).toBe("c")
    const area = getColorArea(screen, { name: "Fill" })
    expect(await area.channels()).toEqual({
      x: { channel: "saturation", value: 50 },
      y: { channel: "brightness", value: 80 },
    })
    await a11y()
  })

  it("hue as an axis spans 0–360", () => {
    render(<Area xChannel="hue" yChannel="saturation" />)
    const x = screen.getByRole("slider", { name: "Fill Hue" })
    expect(x.getAttribute("aria-valuemax")).toBe("360")
  })

  it("same channel twice: a development error and the defaults", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {})
    render(<Area xChannel="saturation" yChannel="saturation" />)
    expect(error.mock.calls.some((c) => String(c[0]).includes("xChannel"))).toBe(true)
    expect(screen.getByRole("slider", { name: "Fill Brightness" })).toBeTruthy()
  })
})

describe("keyboard", () => {
  it("steps and focus following a cross-axis key", async () => {
    render(<Area />)
    const area = getColorArea(screen, { name: "Fill" })
    await area.focusAxis("x")
    await area.step("x", "increase")
    expect((await area.channels()).x.value).toBe(51)
    await area.step("y", "increase")
    expect((await area.channels()).y.value).toBe(81)
    const y = screen.getByRole("slider", { name: "Fill Brightness" })
    expect(document.activeElement).toBe(y)
    expect(screen.getByRole("slider", { name: "Fill Saturation" }).tabIndex).toBe(-1)
  })

  it("value text: first focus lists the colour, then only the change (react-spectrum#4110)", async () => {
    render(<Area defaultValue="hsb(220, 80%, 60%)" />)
    const area = getColorArea(screen, { name: "Fill" })
    await area.focusAxis("x")
    expect(await area.valueText("x")).toMatch(/^Saturation 80%, Brightness 60%, Hue 220°, /)
    await area.step("x", "increase")
    expect(await area.valueText("x")).toMatch(/^Saturation 81%, [a-z ]+$/)
  })

  it("no live region", () => {
    render(<Area />)
    expect(document.querySelector("[aria-live]")).toBeNull()
  })
})

describe("native adjustment and read-only", () => {
  it("assistive technology adjusts an axis", async () => {
    const onValueChange = vi.fn()
    const onValueCommit = vi.fn()
    render(<Area onValueChange={onValueChange} onValueCommit={onValueCommit} />)
    await getColorArea(screen, { name: "Fill" }).adjustNative("x", 70)
    expect(onValueChange).toHaveBeenCalledTimes(1)
    expect(onValueCommit).toHaveBeenCalledTimes(1)
    expect(
      screen.getByRole("slider", { name: "Fill Saturation" }).getAttribute("aria-valuenow"),
    ).toBe("70")
  })

  it("read-only refuses and re-syncs the input", async () => {
    const onValueChange = vi.fn()
    render(<Area readOnly onValueChange={onValueChange} />)
    await getColorArea(screen, { name: "Fill" }).adjustNative("x", 70)
    expect(onValueChange).not.toHaveBeenCalled()
    expect(
      (screen.getByRole("slider", { name: "Fill Saturation" }) as HTMLInputElement).value,
    ).toBe("50")
  })
})

describe("forms", () => {
  it("channel values are submitted; a reset restores the default with no callback", async () => {
    const onValueChange = vi.fn()
    render(
      <form data-testid="form">
        <Area xName="s" yName="b" onValueChange={onValueChange} />
        <button type="reset">Reset</button>
      </form>,
    )
    const form = screen.getByTestId("form") as HTMLFormElement
    expect(Object.fromEntries(new FormData(form))).toEqual({ s: "50", b: "80" })
    const area = getColorArea(screen, { name: "Fill" })
    await area.step("x", "increase")
    expect(onValueChange).toHaveBeenCalledTimes(1)
    await area.resetForm()
    expect((await area.channels()).x.value).toBe(50)
    expect(onValueChange).toHaveBeenCalledTimes(1)
  })
})

describe("controlled", () => {
  it("a parent echoing a fresh rgb string keeps the hue at black (react-spectrum#9509)", async () => {
    function Parent() {
      const [hex, setHex] = useState("#000000")
      return (
        <ColorArea.Root
          aria-label="Fill"
          value={hex}
          colorSpace="hsb"
          xChannel="hue"
          yChannel="brightness"
          onValueChange={(c) =>
            setHex(`#${c.channels.map((n) => n.toString(16).padStart(2, "0")).join("")}`)
          }
        >
          <ColorArea.Background />
          <ColorArea.Thumb />
        </ColorArea.Root>
      )
    }
    render(<Parent />)
    const area = getColorArea(screen, { name: "Fill" })
    await area.step("x", "increase", { large: true })
    expect((await area.channels()).x.value).toBe(15)
  })
})

describe("server render", () => {
  it("positions, values and gradient are in the HTML; hydration is clean", async () => {
    const node = <Area defaultValue="#336699" />
    const html = renderToString(node)
    expect(html).toContain("--rind-color-area-x")
    expect(html).toContain("background-image:")
    expect(html).toMatch(/aria-valuenow="\d+"/)
    const box = document.createElement("div")
    box.innerHTML = html
    document.body.append(box)
    const error = vi.spyOn(console, "error").mockImplementation(() => {})
    let root: ReturnType<typeof hydrateRoot> | undefined
    await act(async () => {
      root = hydrateRoot(box, node, { onRecoverableError: (e) => error(String(e)) })
    })
    expect(error).not.toHaveBeenCalled()
    await act(async () => root?.unmount())
    box.remove()
  })
})

describe("pointer without layout", () => {
  it("pressAt rejects naming the missing layout in jsdom", async () => {
    render(<Area />)
    const area = getColorArea(screen, { name: "Fill" }, { modality: "pointer" })
    const box = screen.getAllByRole("slider")[0]?.closest('[data-part="root"]')
    if (box && box.getBoundingClientRect().width > 0) return // real browser: covered elsewhere
    await expect(area.pressAt({ x: 0.5, y: 0.5 })).rejects.toThrow(/pressAt|pointerDown.*layout/)
    fireEvent.blur(document.body)
  })
})
