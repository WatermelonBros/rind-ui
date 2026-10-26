// Signature Pad export (add-signature-pad design §6): sized from the stroke space times
// `scale`, never from layout; the ink colour inlined; rejects when empty or undecodable.

import { rasterizeSvg } from "../../dom/svg-raster"
import { isSignatureEmpty, type SignatureValue, signatureSvg } from "./signature-pad.geometry"

/** Exporting an empty pad (instead of resolving an empty image: signature_pad#490). */
export class EmptySignatureError extends Error {
  constructor() {
    super("[rind-ui/signature-pad] nothing to export: the pad is empty")
    this.name = "EmptySignatureError"
  }
}

export interface SignatureExportOptions {
  /** Default "image/png"; "image/svg+xml" gives the vector document. */
  readonly type?: string | undefined
  /** Output pixels per stroke-space px (default 2). */
  readonly scale?: number | undefined
  /** Painted under the strokes; JPEG and WebP default to white. */
  readonly background?: string | undefined
  readonly quality?: number | undefined
}

export async function exportSignature(
  value: SignatureValue,
  options: SignatureExportOptions & { readonly color: string; readonly doc?: Document },
): Promise<Blob> {
  if (isSignatureEmpty(value)) throw new EmptySignatureError()
  const type = options.type ?? "image/png"
  const scale = options.scale ?? 2
  const width = value.width * scale
  const height = value.height * scale
  const svg = signatureSvg(value, {
    color: options.color,
    background: options.background,
    width,
    height,
  })
  if (type === "image/svg+xml") return new Blob([svg], { type })
  return rasterizeSvg({
    svg,
    width,
    height,
    type,
    quality: options.quality,
    background: options.background,
    doc: options.doc,
  })
}
