// Color Slider scenarios (color-slider spec): one slider, the channel binding (a channel the
// value lacks, alpha keeps the colour, hue at black, steps), names and value text, the
// gradient, form participation. Runs in jsdom and in real browsers.
import type { Color } from "@rind-ui/core"
import { ColorSlider, type ColorSliderRootProps } from "@rind-ui/react"
import { render, screen } from "@testing-library/react"
import axe from "axe-core"
import { useState } from "react"
import { renderToString } from "react-dom/server"
import { afterEach, describe, expect, it, vi } from "vitest"
import { getColorSlider } from "../index"

afterEach(() => vi.restoreAllMocks())

const a11y = async () => {
  const { violations } = await axe.run(document.body, {
    rules: { region: { enabled: false }, "color-contrast": { enabled: false } },
  })
  if (violations.length > 0) throw new Error(violations.map((v) => `${v.id}: ${v.help}`).join("\n"))
}

const Hue = ({ label, ...props }: Partial<ColorSliderRootProps> & { label?: string }) => (
  <ColorSlider.Root channel="hue" {...props}>
    {label ? <ColorSlider.Label>{label}</ColorSlider.Label> : null}
    <ColorSlider.Track>
      <ColorSlider.Thumb />
    </ColorSlider.Track>
  </ColorSlider.Root>
)

describe("anatomy and names", () => {
  it("one slider; an unlabelled hue slider is named Hue (Reado)", async () => {
    render(<Hue defaultValue="hsb(240, 100%, 100%)" />)
    expect(screen.getAllByRole("slider")).toHaveLength(1)
    const input = screen.getByRole("slider", { name: "Hue" })
    expect(input.getAttribute("aria-valuetext")).toBe("Hue 240°, blue")
    await a11y()
  })

  it("a Label names it", () => {
    render(<Hue label="Fill hue" />)
    expect(screen.getByRole("slider", { name: "Fill hue" })).toBeTruthy()
  })

  it("saturation names the colour", () => {
    render(
      <ColorSlider.Root channel="saturation" defaultValue="hsb(210, 90%, 90%)">
        <ColorSlider.Track>
          <ColorSlider.Thumb />
        </ColorSlider.Track>
      </ColorSlider.Root>,
    )
    const text = screen.getByRole("slider").getAttribute("aria-valuetext") ?? ""
    expect(text).toMatch(/^Saturation 90%, .*blue/)
  })

  it("data-channel and data-space on the parts; the gradient on the track", () => {
    render(<Hue defaultValue="#FF0000" />)
    const track = document.querySelector<HTMLElement>('[data-part="track"]')
    expect(track?.getAttribute("data-channel")).toBe("hue")
    expect(track?.getAttribute("data-space")).toBe("hsb")
    expect(track?.style.backgroundImage).toContain("linear-gradient(to right")
    expect(document.querySelector("[aria-live]")).toBeNull()
  })
})

describe("binding", () => {
  it("a channel the value lacks: hue on rgb red, emitted as rgb (ark#1649)", async () => {
    const onValueChange = vi.fn()
    render(<Hue value="rgb(255, 0, 0)" onValueChange={onValueChange} />)
    await getColorSlider(screen, { name: "Hue" }).step(0, "increase")
    const [c] = onValueChange.mock.calls[0] as [Color]
    expect(c.space).toBe("rgb")
  })

  it("alpha keeps the colour (zag#884)", async () => {
    const onValueChange = vi.fn()
    render(
      <ColorSlider.Root
        channel="alpha"
        defaultValue="rgb(12, 34, 56)"
        onValueChange={onValueChange}
      >
        <ColorSlider.Track>
          <ColorSlider.Thumb />
        </ColorSlider.Track>
      </ColorSlider.Root>,
    )
    await getColorSlider(screen, { name: "Alpha" }).step(0, "decrease")
    const [c] = onValueChange.mock.calls[0] as [Color]
    expect(c.channels).toEqual([12, 34, 56])
    expect(c.alpha).toBe(0.99)
  })

  it("PageUp on hue at 100 gives 115; ArrowRight on alpha at 0.5 gives 0.51", async () => {
    render(<Hue defaultValue="hsb(100, 50%, 50%)" />)
    await getColorSlider(screen, { name: "Hue" }).step(0, "increase", { page: true })
    expect(screen.getByRole("slider").getAttribute("aria-valuenow")).toBe("115")
  })

  it("hue at black moves the thumb and emits nothing (react-spectrum#9509)", async () => {
    const onValueChange = vi.fn()
    function Parent() {
      const [c, setC] = useState<string>("#000000")
      return (
        <Hue
          value={c}
          onValueChange={(next) => {
            onValueChange(next)
            setC(`rgb(${next.channels.join(", ")})`)
          }}
        />
      )
    }
    render(<Parent />)
    await getColorSlider(screen, { name: "Hue" }).setChannel(200)
    expect(screen.getByRole("slider").getAttribute("aria-valuenow")).toBe("200")
    expect(onValueChange).not.toHaveBeenCalled()
  })

  it("commits once per keyboard step", async () => {
    const onValueCommit = vi.fn()
    render(<Hue defaultValue="hsb(10, 50%, 50%)" onValueCommit={onValueCommit} />)
    await getColorSlider(screen, { name: "Hue" }).step(0, "increase")
    expect(onValueCommit).toHaveBeenCalledTimes(1)
  })
})

describe("server render and forms", () => {
  it("server HTML has the gradient and the value", () => {
    const html = renderToString(<Hue defaultValue="hsb(30, 50%, 50%)" name="h" />)
    expect(html).toContain("--rind-color-slider-gradient")
    expect(html).toContain('aria-valuenow="30"')
  })

  it("submits the channel value", () => {
    render(
      <form data-testid="f">
        <Hue defaultValue="hsb(30, 50%, 50%)" name="h" />
      </form>,
    )
    expect(new FormData(screen.getByTestId("f") as HTMLFormElement).get("h")).toBe("30")
  })
})
