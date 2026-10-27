// svg-raster: an SVG document string to a raster Blob (Signature Pad's export). The size is
// the caller's, never the layout's (signature_pad#885); formats without alpha get a background
// (signature_pad#858); a decode failure rejects instead of hanging (Zag data-url).

export interface SvgRasterInput {
  readonly svg: string
  readonly width: number
  readonly height: number
  readonly type: string
  /** 0–1 for lossy types. */
  readonly quality?: number | undefined
  /** Painted under the image; JPEG and WebP get white when none is given. */
  readonly background?: string | undefined
  readonly doc?: Document | undefined
}

const OPAQUE = new Set(["image/jpeg", "image/webp"])

export async function rasterizeSvg(input: SvgRasterInput): Promise<Blob> {
  const doc = input.doc ?? document
  const image = doc.createElement("img")
  image.width = input.width
  image.height = input.height
  image.src = `data:image/svg+xml,${encodeURIComponent(input.svg)}`
  await image.decode()
  const canvas = doc.createElement("canvas")
  canvas.width = Math.max(1, Math.round(input.width))
  canvas.height = Math.max(1, Math.round(input.height))
  const ctx = canvas.getContext("2d")
  if (!ctx) throw new Error("no 2D canvas context")
  const background = input.background ?? (OPAQUE.has(input.type) ? "#fff" : undefined)
  if (background) {
    ctx.fillStyle = background
    ctx.fillRect(0, 0, canvas.width, canvas.height)
  }
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height)
  return new Promise((resolve, reject) => {
    try {
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error("empty canvas"))),
        input.type,
        input.quality,
      )
    } catch (error) {
      reject(error)
    }
  })
}
