// Image Cropper through its driver (spec image-cropper): one tab stop, nudges and resizes by
// keyboard with steps, zoom keys, pointer drags of the area and a handle, a fixed area that
// pans, coverage after a rotation, one announcement per burst. Layout and image decoding
// need a browser.
import { ImageCropper, type ImageCropperRootProps, RindProvider } from "@rind-ui/react"
import { act, render, screen } from "@testing-library/react"
import { userEvent } from "@testing-library/user-event"
import { describe, expect, it } from "vitest"
import { getImageCropper, recordingAnnouncer, virtualClock } from "../index"

const browser = !navigator.userAgent.includes("jsdom")

/** A 400 × 200 test image (two colours) as a data URL. */
function testImage(): string {
  const c = document.createElement("canvas")
  c.width = 400
  c.height = 200
  const ctx = c.getContext("2d") as CanvasRenderingContext2D
  ctx.fillStyle = "#336699"
  ctx.fillRect(0, 0, 400, 200)
  ctx.fillStyle = "#ffcc00"
  ctx.fillRect(200, 0, 200, 200)
  return c.toDataURL()
}

const HANDLES = ["n", "s", "e", "w", "ne", "nw", "se", "sw"] as const

async function setup(props: Partial<ImageCropperRootProps> = {}) {
  const rec = recordingAnnouncer()
  const clock = virtualClock()
  const src = testImage()
  render(
    <RindProvider announcer={rec.announcer} environment={{ scheduler: clock.scheduler }}>
      <ImageCropper.Root aria-label="Avatar" {...props}>
        <ImageCropper.Viewport style={{ width: 400, height: 200 }}>
          <ImageCropper.Image src={src} />
          <ImageCropper.Selection>
            {HANDLES.map((p) => (
              <ImageCropper.Handle key={p} position={p} />
            ))}
          </ImageCropper.Selection>
        </ImageCropper.Viewport>
      </ImageCropper.Root>
      <button type="button">After</button>
    </RindProvider>,
  )
  const d = getImageCropper(screen, { name: "Avatar" })
  // Wait for decode and the first measure.
  await act(async () => {
    const img = document.querySelector("img") as HTMLImageElement
    await img.decode()
    await new Promise((r) => requestAnimationFrame(() => r(null)))
  })
  return { d, clock, said: () => rec.log.map((a) => a.message) }
}

describe.runIf(browser)("image-cropper", () => {
  it("one tab stop: the crop area slider, with the natural rect as its value", async () => {
    const { d } = await setup({ aspectRatio: 1 })
    await userEvent.tab()
    const slider = screen.getByRole("slider", { name: "Crop area" })
    expect(document.activeElement).toBe(slider)
    expect(slider.getAttribute("aria-roledescription")).toBe("crop area")
    expect(await d.crop()).toEqual({ x: 120, y: 20, width: 160, height: 160 })
    await userEvent.tab()
    expect(document.activeElement?.textContent).toBe("After")
  })

  it("arrows move with steps; Alt resizes; + zooms", async () => {
    const { d } = await setup()
    const start = await d.crop()
    screen.getByRole("slider").focus()
    await userEvent.keyboard("{ArrowRight}{Shift>}{ArrowRight}{/Shift}")
    expect((await d.crop()).x).toBe(start.x + 11)
    await userEvent.keyboard("{Alt>}{ArrowLeft}{/Alt}")
    expect((await d.crop()).width).toBe(start.width - 1)
    await userEvent.keyboard("+")
    expect(await d.zoom()).toBeCloseTo(1.1)
    expect(await d.covered()).toBe(true)
  })

  it("a burst of arrows announces once, after 500 ms", async () => {
    const { clock, said } = await setup()
    screen.getByRole("slider").focus()
    for (let i = 0; i < 4; i++) await userEvent.keyboard("{ArrowDown}")
    expect(said()).toEqual([])
    act(() => clock.advance(500))
    expect(said()).toHaveLength(1)
    expect(said()[0]).toMatch(/pixels, \d+ from the left/)
  })

  it("pointer: drag the area, drag a handle", async () => {
    const { d } = await setup()
    const start = await d.crop()
    await d.dragSelection(20, 0)
    expect((await d.crop()).x).toBeGreaterThan(start.x)
    const moved = await d.crop()
    await d.dragHandle("e", -30, 0)
    expect((await d.crop()).width).toBeLessThan(moved.width)
  })

  it("fixed crop area: arrows pan, the selection stays focusable (zag#3264)", async () => {
    const { d } = await setup({ fixedCropArea: true, defaultZoom: 2 })
    const slider = screen.getByRole("slider")
    slider.focus()
    const left = slider.style.left
    const before = await d.crop()
    await userEvent.keyboard("{ArrowRight}")
    expect(slider.style.left).toBe(left)
    expect((await d.crop()).x).not.toBe(before.x)
  })

  it("a rotation keeps the image covering the crop", async () => {
    const { d } = await setup({ defaultRotation: 30 })
    expect(await d.covered()).toBe(true)
    expect(await d.zoom()).toBeGreaterThan(1)
  })
})
