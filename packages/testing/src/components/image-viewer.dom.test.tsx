// Image Viewer through its driver (spec image-viewer): a named focusable group, keys and
// buttons within the limits (focus kept at the limit), arrows only when there is room,
// ctrl-wheel / Safari gesture / double click about the pointer, a plain wheel left to the
// page, drags clamped to the image, one announcement per keyboard burst. Layout and image
// decoding need a browser.
import { ImageViewer, type ImageViewerRootProps, RindProvider } from "@rind-ui/react"
import { act, fireEvent, render, screen } from "@testing-library/react"
import { userEvent } from "@testing-library/user-event"
import { describe, expect, it } from "vitest"
import { getImageViewer, recordingAnnouncer, virtualClock } from "../index"

const browser = !navigator.userAgent.includes("jsdom")

/** An 800 × 400 image: it fills a 400 × 200 viewport at zoom 1. */
function testImage(): string {
  const c = document.createElement("canvas")
  c.width = 800
  c.height = 400
  const ctx = c.getContext("2d") as CanvasRenderingContext2D
  ctx.fillStyle = "#336699"
  ctx.fillRect(0, 0, 800, 400)
  ctx.fillStyle = "#ffcc00"
  ctx.fillRect(400, 0, 400, 400)
  return c.toDataURL()
}

const frame = () => act(() => new Promise<void>((r) => requestAnimationFrame(() => r())))

async function setup(props: Partial<ImageViewerRootProps> = {}) {
  const rec = recordingAnnouncer()
  const clock = virtualClock()
  render(
    <RindProvider announcer={rec.announcer} environment={{ scheduler: clock.scheduler }}>
      <ImageViewer.Root {...props}>
        <ImageViewer.Viewport style={{ width: 400, height: 200 }}>
          <ImageViewer.Image src={testImage()} alt="Floor plan" />
        </ImageViewer.Viewport>
        <ImageViewer.ZoomOut />
        <ImageViewer.ZoomText />
        <ImageViewer.ZoomIn />
        <ImageViewer.Reset />
      </ImageViewer.Root>
    </RindProvider>,
  )
  const viewport = await screen.findByRole("group", { name: "Floor plan" })
  await act(async () => {
    const img = viewport.querySelector("img") as HTMLImageElement
    await img.decode()
  })
  await frame()
  const d = getImageViewer(screen, { name: "Floor plan" })
  const at = (x: number, y: number) => {
    const r = viewport.getBoundingClientRect()
    return { clientX: r.left + x, clientY: r.top + y }
  }
  return {
    d,
    viewport,
    at,
    said: () => rec.log.map((a) => a.message),
    advance: (ms: number) => act(() => clock.advance(ms)),
  }
}

describe.runIf(browser)("image viewer", () => {
  it("a focusable group named by the image's alt, with instructions", async () => {
    const { viewport } = await setup()
    expect(viewport.getAttribute("tabindex")).toBe("0")
    expect(viewport.getAttribute("aria-roledescription")).toBe("image viewer")
    const ins = document.getElementById(viewport.getAttribute("aria-describedby") ?? "")
    expect(ins?.textContent).toMatch(/Plus and minus zoom/)
    expect(viewport.querySelector("img")?.getAttribute("aria-hidden")).toBe("true")
  })

  it("keys step the zoom; 0 resets", async () => {
    const { d } = await setup()
    await d.via("keyboard").zoomIn()
    await d.via("keyboard").zoomIn()
    expect(await d.zoom()).toBe(2)
    await d.via("keyboard").reset()
    expect(await d.zoom()).toBe(1)
  })

  it("buttons stop at the limit and keep their focus", async () => {
    const user = userEvent.setup()
    const { d } = await setup()
    const zoomIn = screen.getByRole("button", { name: "Zoom in" })
    for (let i = 0; i < 8; i++) await user.click(zoomIn)
    expect(await d.zoom()).toBe(4)
    expect(zoomIn.getAttribute("aria-disabled")).toBe("true")
    expect(document.activeElement).toBe(zoomIn)
    expect(await d.canZoomIn()).toBe(false)
    expect(await d.canZoomOut()).toBe(true)
  })

  it("arrows pan when zoomed; at fit they are left to the page", async () => {
    const { d, viewport } = await setup()
    viewport.focus()
    expect(fireEvent.keyDown(viewport, { key: "ArrowRight" })).toBe(true)
    await d.via("keyboard").zoomIn()
    await d.via("keyboard").zoomIn()
    viewport.focus()
    expect(fireEvent.keyDown(viewport, { key: "ArrowRight" })).toBe(false)
    expect((await d.offset()).x).toBe(-40)
  })

  it("ctrl-wheel zooms about the pointer; a plain wheel scrolls the page", async () => {
    const { d, viewport, at } = await setup()
    expect(fireEvent.wheel(viewport, { deltaY: -100, ...at(0, 0) })).toBe(true)
    expect(await d.zoom()).toBe(1)
    expect(fireEvent.wheel(viewport, { deltaY: -100, ctrlKey: true, ...at(0, 0) })).toBe(false)
    const zoom = await d.zoom()
    expect(zoom).toBeGreaterThan(2.5)
    // The top-left corner stayed under the pointer: the image moved right and down.
    const offset = await d.offset()
    expect(offset.x).toBeCloseTo(((zoom - 1) * 400) / 2, 0)
  })

  it('wheel="zoom" zooms on a plain wheel', async () => {
    const { d, viewport, at } = await setup({ wheel: "zoom" })
    fireEvent.wheel(viewport, { deltaY: -100, ...at(200, 100) })
    expect(await d.zoom()).toBeGreaterThan(1)
  })

  it("Safari's trackpad pinch (gesturechange) zooms (Viewer.js #492)", async () => {
    const { d, viewport, at } = await setup()
    act(() => {
      viewport.dispatchEvent(new Event("gesturestart", { cancelable: true }))
      const e = new Event("gesturechange", { cancelable: true })
      Object.assign(e, { scale: 2, ...at(200, 100) })
      viewport.dispatchEvent(e)
    })
    expect(await d.zoom()).toBe(2)
  })

  it("double click toggles fit and 2", async () => {
    const { d, viewport, at } = await setup()
    fireEvent.doubleClick(viewport, at(200, 100))
    expect(await d.zoom()).toBe(2)
    fireEvent.doubleClick(viewport, at(200, 100))
    expect(await d.zoom()).toBe(1)
  })

  it("dragging pans, clamped to the image", async () => {
    const { d } = await setup({ defaultZoom: 2 })
    await d.pan(-20, 0)
    // 20 steps of 40 px to the right, but the room is (800 − 400) / 2 = 200.
    expect((await d.offset()).x).toBe(200)
  })

  it("one announcement per keyboard burst", async () => {
    const { d, said, advance } = await setup()
    await d.via("keyboard").zoomIn()
    await d.via("keyboard").zoomIn()
    await advance(500)
    expect(said()).toEqual(["Zoom 200%"])
  })
})
