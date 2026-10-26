// Signature Pad geometry (add-signature-pad design §1, §3, §5): the value model, a smooth path
// through a stroke's points (quadratic curves through midpoints, a dot for one point, never
// NaN: perfect-freehand#1, #19), and the standalone SVG the form value and the export use.

export interface SignaturePoint {
  readonly x: number
  readonly y: number
  /** 0–1; 0.5 when the device reports none. */
  readonly pressure: number
  /** ms since the stroke began. */
  readonly t: number
}

export interface SignatureStroke {
  readonly points: readonly SignaturePoint[]
}

export interface SignatureValue {
  /** The stroke space: the Control's CSS box when the first stroke of an empty pad began. */
  readonly width: number
  readonly height: number
  readonly strokes: readonly SignatureStroke[]
}

export const EMPTY_SIGNATURE: SignatureValue = { width: 0, height: 0, strokes: [] }

export const isSignatureEmpty = (value: SignatureValue | undefined) =>
  !value || value.strokes.length === 0

const round = (n: number) => Math.round(n * 100) / 100
const fin = (n: number) => (Number.isFinite(n) ? round(n) : 0)

/** `point` unless it is closer than `min` to `last` (duplicate points make NaN geometry). */
export function keepPoint(last: SignaturePoint | undefined, point: SignaturePoint, min: number) {
  if (!last) return true
  return Math.hypot(point.x - last.x, point.y - last.y) >= Math.max(min, Number.EPSILON)
}

/** The SVG path data of one stroke. */
export function signaturePath(stroke: SignatureStroke): string {
  const pts = stroke.points.filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y))
  const first = pts[0]
  if (!first) return ""
  // One point: a zero-length segment, drawn as a dot by the round cap.
  if (pts.length === 1) return `M${fin(first.x)} ${fin(first.y)}h0.01`
  let d = `M${fin(first.x)} ${fin(first.y)}`
  for (let i = 1; i < pts.length - 1; i++) {
    const p = pts[i] as SignaturePoint
    const next = pts[i + 1] as SignaturePoint
    d += `Q${fin(p.x)} ${fin(p.y)} ${fin((p.x + next.x) / 2)} ${fin((p.y + next.y) / 2)}`
  }
  const last = pts[pts.length - 1] as SignaturePoint
  d += `L${fin(last.x)} ${fin(last.y)}`
  return d
}

const escapeAttr = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;")

export interface SignatureSvgOptions {
  /** The ink colour, inlined (CSS variables do not survive serialisation). */
  readonly color: string
  /** Stroke width in stroke-space px (default 2.5). */
  readonly strokeWidth?: number | undefined
  /** A background fill; none by default. */
  readonly background?: string | undefined
  /** Output size; the stroke space by default. */
  readonly width?: number | undefined
  readonly height?: number | undefined
}

/** The strokes as a standalone SVG document. */
export function signatureSvg(value: SignatureValue, options: SignatureSvgOptions): string {
  const w = Math.max(1, value.width)
  const h = Math.max(1, value.height)
  const ow = options.width ?? w
  const oh = options.height ?? h
  const color = escapeAttr(options.color)
  const bg = options.background
    ? `<rect width="100%" height="100%" fill="${escapeAttr(options.background)}"/>`
    : ""
  const paths = value.strokes
    .map((s) => signaturePath(s))
    .filter(Boolean)
    .map((d) => `<path d="${d}"/>`)
    .join("")
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${fin(ow)}" height="${fin(oh)}" viewBox="0 0 ${fin(w)} ${fin(h)}">` +
    `${bg}<g fill="none" stroke="${color}" stroke-width="${options.strokeWidth ?? 2.5}" stroke-linecap="round" stroke-linejoin="round">${paths}</g></svg>`
  )
}

/** The form value: the SVG as a data URL, the JSON model, or "" when empty. */
export function signatureFormValue(
  value: SignatureValue,
  format: "svg" | "json",
  color: string,
): string {
  if (isSignatureEmpty(value)) return ""
  if (format === "json") return JSON.stringify(value)
  return `data:image/svg+xml,${encodeURIComponent(signatureSvg(value, { color }))}`
}
