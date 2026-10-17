// renderQrSvg (design §1): a standalone SVG string for files and servers. Every
// interpolated attribute value and text is escaped, so an option cannot inject markup.

import type { QrSuccess } from "./encode"
import { qrPath } from "./path"

export interface QrSvgOptions {
  /** Light modules around the symbol. Default 4. */
  readonly quietZone?: number | undefined
  /** Module colour. Default `"#000"`. */
  readonly foreground?: string | undefined
  /** Ground colour, including the quiet zone. Default `"#fff"`. */
  readonly background?: string | undefined
  /** Rendered width and height (any SVG length). Default: none (the viewBox only). */
  readonly size?: number | string | undefined
  /** The image's accessible name, as `<title>`. */
  readonly title?: string | undefined
  /** The image's description, as `<desc>`. */
  readonly description?: string | undefined
}

const escapeXml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")

export function renderQrSvg(
  result: Pick<QrSuccess, "modules" | "size">,
  options: QrSvgOptions = {},
): string {
  const quietZone = options.quietZone ?? 4
  const n = result.size + quietZone * 2
  const size =
    options.size === undefined
      ? ""
      : ` width="${escapeXml(String(options.size))}" height="${escapeXml(String(options.size))}"`
  const title = options.title === undefined ? "" : `<title>${escapeXml(options.title)}</title>`
  const desc =
    options.description === undefined ? "" : `<desc>${escapeXml(options.description)}</desc>`
  const role = options.title === undefined ? "" : ` role="img"`
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${n} ${n}"${size}${role} shape-rendering="crispEdges">` +
    title +
    desc +
    `<rect width="${n}" height="${n}" fill="${escapeXml(options.background ?? "#fff")}"/>` +
    `<path d="${qrPath(result.modules, { quietZone })}" fill="${escapeXml(options.foreground ?? "#000")}"/>` +
    "</svg>"
  )
}
