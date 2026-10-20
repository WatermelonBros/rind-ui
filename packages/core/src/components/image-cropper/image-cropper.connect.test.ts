import { describe, expect, it } from "vitest"
import type { CropPlacement } from "./geometry"
import { type ImageCropperConnectInput, imageCropperConnect } from "./image-cropper.connect"
import { imageCropperContract } from "./image-cropper.contract"
import { imageCropperMachine } from "./image-cropper.machine"
import { imageCropperMessages } from "./image-cropper.messages"
import { imageCropperMeta } from "./image-cropper.meta"

const placement: CropPlacement = {
  natural: { width: 800, height: 400 },
  viewport: { width: 400, height: 200 },
  zoom: 1,
  rotation: 0,
  flip: { horizontal: true, vertical: true },
  offset: { x: 0, y: 0 },
}
const input = (over: Partial<ImageCropperConnectInput> = {}): ImageCropperConnectInput => ({
  instance: "c",
  state: "dragging",
  placement,
  crop: { x: 100, y: 50, width: 100, height: 100 },
  shape: "rectangle",
  fixed: true,
  dragging: true,
  panning: true,
  ready: true,
  ids: { instructions: "i" },
  messages: imageCropperMessages,
  locale: "en",
  ...over,
})

const dataKeys = (p: Record<string, unknown>) =>
  Object.keys(p)
    .filter((k) => k.startsWith("data-") && p[k] !== undefined)
    .sort()

describe("image-cropper meta matches the code", () => {
  it("contract and states", () => {
    const actions = Object.fromEntries(
      Object.entries(imageCropperContract.actions).map(([name, a]) => [
        name,
        [
          ...(["pointer", "keyboard", "touch"] as const).filter((m) => m in a),
          ...("pointer" in a ? ["virtual"] : []),
        ],
      ]),
    )
    expect(imageCropperMeta.contract.actions).toEqual(actions)
    expect(imageCropperMeta.contract.queries).toEqual(Object.keys(imageCropperContract.queries))
    expect(Object.keys(imageCropperMeta.states)).toEqual(
      Object.keys(imageCropperMachine.def.states),
    )
  })

  it("data attributes", () => {
    const a = imageCropperConnect(input())
    const parts = {
      root: a.root(),
      viewport: a.viewport(),
      image: a.image(),
      selection: a.selection({ focused: true, modality: "keyboard" }),
      handle: a.handle("ne"),
      grid: a.grid("horizontal"),
    }
    for (const [part, props] of Object.entries(parts)) {
      const meta =
        imageCropperMeta.dataAttributes[part as keyof typeof imageCropperMeta.dataAttributes]
      expect(Object.keys(meta).sort(), part).toEqual(dataKeys(props))
    }
  })
})

describe("image-cropper connect", () => {
  it("one focusable slider with the natural-pixel value; the rest hidden", () => {
    const a = imageCropperConnect(input())
    const s = a.selection({ focused: false, modality: "pointer" })
    expect(s).toMatchObject({ role: "slider", tabindex: 0, "aria-roledescription": "crop area" })
    // Fit 0.5 and a double flip: the crop's natural rect is mirrored on both axes, doubled.
    expect(a.natural).toEqual({ x: 400, y: 100, width: 200, height: 200 })
    expect(s["aria-valuetext"]).toBe("200 by 200 pixels, 400 from the left, 100 from the top")
    expect(a.image()["aria-hidden"]).toBe("true")
    expect(a.handle("n")["aria-hidden"]).toBe("true")
    expect(a.root()["aria-live"]).toBeUndefined()
  })
})
