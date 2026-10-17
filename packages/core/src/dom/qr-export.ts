// Exporting a QR code as an image (add-qr-code design §6). Raster: an integer number of pixels
// per module, smoothing off, on the frame's own background, the overlay composited at its
// rectangle; a canvas tainted by a cross-origin overlay is redrawn without it. SVG: the
// standalone symbol with the overlay inlined as a data URL, never a remote reference.

import { qrPath } from "../qr/path"
import { renderQrSvg } from "../qr/svg"

export type QrMime = "image/png" | "image/jpeg" | "image/webp" | "image/svg+xml"
export type QrOverlayOutcome = "included" | "omitted" | "none"

export interface QrExportInput {
  readonly modules: readonly (readonly boolean[])[]
  readonly quietZone: number
  readonly mimeType: QrMime
  /** 0–1 for lossy types. */
  readonly quality?: number | undefined
  /** Width of the exported image in CSS pixels (rounded up to whole pixels per module). */
  readonly size: number
  /** The rendered frame: its background and rectangle. */
  readonly frame: Element | null
  /** The rendered pattern: its fill. */
  readonly pattern: Element | null
  /** The rendered overlay, if any: drawn at its rectangle. */
  readonly overlay: HTMLElement | null
}

export interface QrExportResult {
  readonly blob: Blob
  readonly overlay: QrOverlayOutcome
  /** Exported width and height in pixels (raster) or the requested size (SVG). */
  readonly width: number
}

const TRANSPARENT = new Set(["", "transparent", "rgba(0, 0, 0, 0)"])

function colours(input: QrExportInput): { background: string; foreground: string } {
  const view = input.frame?.ownerDocument.defaultView
  const bg = input.frame && view ? view.getComputedStyle(input.frame).backgroundColor : ""
  const fg = input.pattern && view ? view.getComputedStyle(input.pattern).fill : ""
  return {
    background: TRANSPARENT.has(bg) ? "#fff" : bg,
    foreground: fg === "" || fg === "none" ? "#000" : fg,
  }
}

/** The overlay's rectangle in module units (quiet zone included), from the layout. */
function overlayRect(input: QrExportInput, total: number) {
  if (!input.overlay || !input.frame) return undefined
  const f = input.frame.getBoundingClientRect()
  const o = input.overlay.getBoundingClientRect()
  if (f.width === 0 || f.height === 0) return undefined
  return {
    x: ((o.left - f.left) / f.width) * total,
    y: ((o.top - f.top) / f.height) * total,
    w: (o.width / f.width) * total,
    h: (o.height / f.height) * total,
  }
}

/** The image the overlay shows: an `<img>`, or an inline `<svg>` serialised to one. */
async function overlayImage(overlay: HTMLElement): Promise<HTMLImageElement | undefined> {
  const doc = overlay.ownerDocument
  const img = overlay instanceof HTMLImageElement ? overlay : overlay.querySelector("img")
  if (img) {
    if (!img.complete) await img.decode().catch(() => undefined)
    return img.naturalWidth > 0 ? img : undefined
  }
  const svg = overlay.querySelector("svg")
  if (!svg) return undefined
  const clone = svg.cloneNode(true) as SVGSVGElement
  if (!clone.getAttribute("xmlns")) clone.setAttribute("xmlns", "http://www.w3.org/2000/svg")
  const image = doc.createElement("img")
  image.src = `data:image/svg+xml,${encodeURIComponent(new XMLSerializer().serializeToString(clone))}`
  await image.decode().catch(() => undefined)
  return image.naturalWidth > 0 ? image : undefined
}

function toBlob(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    try {
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("empty canvas"))), type, quality)
    } catch (error) {
      reject(error)
    }
  })
}

const isSecurityError = (e: unknown) => e instanceof DOMException && e.name === "SecurityError"

/** Exports the symbol; never rejects because of the overlay (it is omitted instead). */
export async function exportQr(input: QrExportInput): Promise<QrExportResult> {
  const doc = (input.frame ?? input.overlay)?.ownerDocument ?? document
  const total = (input.modules.length || 0) + input.quietZone * 2
  const { background, foreground } = colours(input)
  const rect = overlayRect(input, total)
  const picture = input.overlay ? await overlayImage(input.overlay) : undefined

  if (input.mimeType === "image/svg+xml") {
    let svg = renderQrSvg(
      { modules: input.modules, size: input.modules.length },
      { quietZone: input.quietZone, background, foreground, size: input.size },
    )
    let overlay: QrOverlayOutcome = input.overlay ? "omitted" : "none"
    if (rect && picture) {
      const href = dataUrlOf(doc, picture)
      if (href !== undefined) {
        const attrs = `x="${rect.x}" y="${rect.y}" width="${rect.w}" height="${rect.h}"`
        const bg = input.overlay
          ? (doc.defaultView?.getComputedStyle(input.overlay).backgroundColor ?? "")
          : ""
        const back = TRANSPARENT.has(bg) ? "" : `<rect ${attrs} fill="${bg}"/>`
        svg = svg.replace("</svg>", `${back}<image ${attrs} href="${href}"/></svg>`)
        overlay = "included"
      }
    }
    return {
      blob: new Blob([svg], { type: "image/svg+xml" }),
      overlay,
      width: input.size,
    }
  }

  const scale = Math.max(1, Math.ceil(input.size / Math.max(1, total)))
  const draw = (withOverlay: boolean) => {
    const canvas = doc.createElement("canvas")
    canvas.width = total * scale
    canvas.height = total * scale
    const ctx = canvas.getContext("2d")
    if (!ctx) throw new Error("no 2D canvas context")
    ctx.imageSmoothingEnabled = false
    ctx.fillStyle = background
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.fillStyle = foreground
    if (typeof Path2D === "function") {
      ctx.save()
      ctx.scale(scale, scale)
      ctx.fill(new Path2D(qrPath(input.modules, { quietZone: input.quietZone })))
      ctx.restore()
    } else {
      input.modules.forEach((row, y) => {
        row.forEach((dark, x) => {
          if (dark) {
            ctx.fillRect((x + input.quietZone) * scale, (y + input.quietZone) * scale, scale, scale)
          }
        })
      })
    }
    if (withOverlay && rect && picture && input.overlay) {
      const style = doc.defaultView?.getComputedStyle(input.overlay)
      const outline = Number.parseFloat(style?.outlineWidth ?? "0") || 0
      const px = rect.x * scale
      const py = rect.y * scale
      const pw = rect.w * scale
      const ph = rect.h * scale
      if (outline > 0 && style && style.outlineStyle !== "none") {
        // CSS pixels of the outline, in the exported image's pixels.
        const o =
          (outline / Math.max(1, input.frame?.getBoundingClientRect().width ?? 1)) * total * scale
        ctx.fillStyle = style.outlineColor
        ctx.fillRect(px - o, py - o, pw + o * 2, ph + o * 2)
      }
      if (style && !TRANSPARENT.has(style.backgroundColor)) {
        ctx.fillStyle = style.backgroundColor
        ctx.fillRect(px, py, pw, ph)
      }
      ctx.drawImage(picture, px, py, pw, ph)
    }
    return canvas
  }
  const width = total * scale
  const type = input.mimeType
  if (!rect || !picture) {
    return {
      blob: await toBlob(draw(false), type, input.quality),
      overlay: input.overlay ? "omitted" : "none",
      width,
    }
  }
  try {
    return { blob: await toBlob(draw(true), type, input.quality), overlay: "included", width }
  } catch (error) {
    // A cross-origin overlay without CORS taints the canvas: the symbol alone, not an error.
    if (!isSecurityError(error)) throw error
    return { blob: await toBlob(draw(false), type, input.quality), overlay: "omitted", width }
  }
}

/** The image as a data URL, or `undefined` when it cannot be read (cross-origin, no CORS). */
function dataUrlOf(doc: Document, img: HTMLImageElement): string | undefined {
  if (img.src.startsWith("data:")) return img.src
  const canvas = doc.createElement("canvas")
  canvas.width = img.naturalWidth
  canvas.height = img.naturalHeight
  const ctx = canvas.getContext("2d")
  if (!ctx) return undefined
  ctx.drawImage(img, 0, 0)
  try {
    return canvas.toDataURL("image/png")
  } catch {
    return undefined
  }
}

/** A Blob as a `data:` URL (getDataUrl). */
export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error ?? new Error("unreadable blob"))
    reader.readAsDataURL(blob)
  })
}
