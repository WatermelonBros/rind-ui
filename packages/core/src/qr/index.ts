// `@rind-ui/core/qr`: the pure QR Code encoder and its path and SVG helpers, usable without
// the component (an application that only needs a matrix does not bundle it).

export { encodeQr, type QrOptions, type QrResult, type QrSuccess } from "./encode"
export { type ParsedQrPath, parseQrPath, qrSizeFromViewBox } from "./parse-path"
export { type QrPathOptions, qrPath } from "./path"
export type { QrMode, QrSegmentInfo } from "./segments"
export { type QrSvgOptions, renderQrSvg } from "./svg"
export type { QrEcc } from "./tables"
