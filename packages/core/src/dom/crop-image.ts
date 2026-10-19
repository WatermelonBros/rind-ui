// crop-image (add-image-cropper design §6): the crop as an image file. It takes the crop's
// natural-pixel quad (`CropData`, from the same matrix that places the preview, so flip and
// rotation cannot diverge: zag#3238) and maps it onto the output rectangle, which handles any
// rotation; failures are typed instead of a silent blank or a SecurityError (ark#3901).

import type { CropData } from "../components/image-cropper/geometry"

export type CropErrorCode = "not-loaded" | "tainted" | "too-large"

export class CropError extends Error {
  readonly code: CropErrorCode
  constructor(code: CropErrorCode, message: string) {
    super(message)
    this.name = "CropError"
    this.code = code
  }
}

export interface CropImageOptions {
  /** "blob" (default) or "dataUrl". */
  readonly output?: "blob" | "dataUrl" | undefined
  /** MIME type (default "image/png"). */
  readonly type?: string | undefined
  /** 0–1, for lossy types. */
  readonly quality?: number | undefined
}

/** Canvas size limit honoured by every engine (iOS Safari is the smallest). */
const MAX_SIDE = 16_384

/**
 * Draws the crop described by `data` (natural pixels: its corner quad) at natural resolution
 * and returns it as a Blob or a data URL.
 */
export async function cropImage(
  image: HTMLImageElement,
  data: CropData,
  options: CropImageOptions = {},
): Promise<Blob | string> {
  if (!image.complete || image.naturalWidth === 0) {
    throw new CropError("not-loaded", "The image has not loaded.")
  }
  const [tl, tr, , bl] = data.corners
  // The quad's sides in natural pixels: the output's width and height.
  const ux = tr.x - tl.x
  const uy = tr.y - tl.y
  const vx = bl.x - tl.x
  const vy = bl.y - tl.y
  const width = Math.max(1, Math.round(Math.hypot(ux, uy)))
  const height = Math.max(1, Math.round(Math.hypot(vx, vy)))
  if (width > MAX_SIDE || height > MAX_SIDE) {
    throw new CropError("too-large", `The crop (${width} × ${height}) exceeds ${MAX_SIDE} px.`)
  }
  const canvas = image.ownerDocument.createElement("canvas")
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext("2d")
  if (!ctx) throw new CropError("not-loaded", "No 2D canvas.")
  // Natural → output: tl → (0, 0), tl + u → (width, 0), tl + v → (0, height).
  // M = diag(width, height) · [u v]⁻¹, translated by −M·tl.
  const det = ux * vy - uy * vx
  const a = (width * vy) / det
  const c = (-width * vx) / det
  const b = (-height * uy) / det
  const d = (height * ux) / det
  ctx.setTransform(a, b, c, d, -(a * tl.x + c * tl.y), -(b * tl.x + d * tl.y))
  ctx.drawImage(image, 0, 0, image.naturalWidth, image.naturalHeight)
  const type = options.type ?? "image/png"
  try {
    if (options.output === "dataUrl") return canvas.toDataURL(type, options.quality)
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (blob) =>
          blob ? resolve(blob) : reject(new CropError("too-large", "The canvas produced no data.")),
        type,
        options.quality,
      ),
    )
  } catch (e) {
    if (e instanceof CropError) throw e
    // A cross-origin image without CORS taints the canvas: reading it throws a SecurityError.
    throw new CropError(
      "tainted",
      "The image is cross-origin without CORS; set crossOrigin and serve CORS headers.",
    )
  }
}
