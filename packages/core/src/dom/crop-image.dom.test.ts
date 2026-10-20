// cropImage in a real browser: the pixels of a known four-colour image under a flip (the
// same matrix as the preview: zag#3238), the typed errors.
import { afterEach, describe, expect, it, vi } from "vitest"
import { type CropPlacement, cropData } from "../components/image-cropper/geometry"
import { CropError, cropImage } from "./crop-image"

const browser = !navigator.userAgent.includes("jsdom")
afterEach(() => vi.restoreAllMocks())

/** 200 × 100: red | green on top, blue | yellow below. */
async function quadrants(): Promise<HTMLImageElement> {
  const c = document.createElement("canvas")
  c.width = 200
  c.height = 100
  const ctx = c.getContext("2d") as CanvasRenderingContext2D
  const fill = (color: string, x: number, y: number) => {
    ctx.fillStyle = color
    ctx.fillRect(x, y, 100, 50)
  }
  fill("#ff0000", 0, 0)
  fill("#00ff00", 100, 0)
  fill("#0000ff", 0, 50)
  fill("#ffff00", 100, 50)
  const img = new Image()
  img.src = c.toDataURL()
  await img.decode()
  return img
}

async function pixel(url: string): Promise<number[]> {
  const img = new Image()
  img.src = url
  await img.decode()
  const c = document.createElement("canvas")
  c.width = img.naturalWidth
  c.height = img.naturalHeight
  const ctx = c.getContext("2d") as CanvasRenderingContext2D
  ctx.drawImage(img, 0, 0)
  return Array.from(ctx.getImageData(Math.floor(c.width / 2), Math.floor(c.height / 2), 1, 1).data)
}

const placement = (flip = false): CropPlacement => ({
  natural: { width: 200, height: 100 },
  viewport: { width: 200, height: 100 },
  zoom: 1,
  rotation: 0,
  flip: { horizontal: flip, vertical: false },
  offset: { x: 0, y: 0 },
})

describe.runIf(browser)("cropImage", () => {
  it("crops the region under the crop, at natural size", async () => {
    const img = await quadrants()
    const url = (await cropImage(
      img,
      cropData(placement(), { x: 0, y: 0, width: 100, height: 50 }),
      { output: "dataUrl" },
    )) as string
    expect(await pixel(url)).toEqual([255, 0, 0, 255])
  })

  it("a horizontal flip crops the mirrored quadrant (zag#3238)", async () => {
    const img = await quadrants()
    const url = (await cropImage(
      img,
      cropData(placement(true), { x: 0, y: 0, width: 100, height: 50 }),
      { output: "dataUrl" },
    )) as string
    expect(await pixel(url)).toEqual([0, 255, 0, 255])
  })

  it("a blob by default", async () => {
    const img = await quadrants()
    const blob = await cropImage(img, cropData(placement(), { x: 0, y: 0, width: 100, height: 50 }))
    expect(blob).toBeInstanceOf(Blob)
  })

  it("typed errors: not loaded, tainted", async () => {
    const empty = new Image()
    await expect(
      cropImage(empty, cropData(placement(), { x: 0, y: 0, width: 10, height: 10 })),
    ).rejects.toMatchObject({
      code: "not-loaded",
    })
    const img = await quadrants()
    vi.spyOn(HTMLCanvasElement.prototype, "toDataURL").mockImplementation(() => {
      throw new DOMException("Tainted", "SecurityError")
    })
    const failure = cropImage(img, cropData(placement(), { x: 0, y: 0, width: 10, height: 10 }), {
      output: "dataUrl",
    })
    await expect(failure).rejects.toBeInstanceOf(CropError)
    await expect(failure).rejects.toMatchObject({ code: "tainted" })
  })
})
