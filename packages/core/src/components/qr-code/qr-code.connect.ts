// QR Code's parts (design §5): the root carries the result state and the module counts; the
// frame is an `svg` with the quiet zone inside its viewBox and, only when there is a symbol,
// `role="img"`, a name and the value text as description; the pattern is one merged path.
// Colours come from CSS, never from interpolated attributes.

import { dataFlag, type PartProps, scopeAttrs } from "../../connect/props"
import { visuallyHiddenStyle } from "../../dom/visually-hidden"
import { qrPath } from "../../qr/path"
import { type QrEncoded, qrModules } from "./qr-code.encoding"
import { qrCodeIds } from "./qr-code.machine"
import type { QrCodeMessages } from "./qr-code.messages"

declare const process: { env: { NODE_ENV?: string } }

export interface QrCodeConnectState {
  readonly instance: string
  readonly encoded: QrEncoded
  readonly downloading: boolean
  /** File name of the last download (`data-last-download`, read by the driver). */
  readonly lastDownload?: string | undefined
  /** `data-covers` of the overlay (browser only; absent until measured). */
  readonly covers?: number | undefined
  readonly messages: QrCodeMessages
}

export interface QrFrameInput {
  /** The consumer named the frame (`aria-label` or `aria-labelledby`). */
  readonly named: boolean
  /** The rendered value text's id (also during server rendering, as an expected part). */
  readonly valueTextId: string | undefined
  /** The consumer's own `aria-describedby`, kept first. */
  readonly describedBy?: string | undefined
}

const SVG_NS = "http://www.w3.org/2000/svg"

export function qrCodeConnect(state: QrCodeConnectState) {
  const { encoded } = state
  const ready = encoded.status === "ready"
  const modules = qrModules(encoded)
  const n = modules + encoded.quietZone * 2
  const ids = qrCodeIds(state.instance)
  const part = (name: string) => scopeAttrs("qr-code", name, state.instance)
  return {
    root: (): PartProps => ({
      ...part("root"),
      "data-state": encoded.status,
      "data-version": ready ? String(encoded.result.version) : undefined,
      "data-ecc": ready ? encoded.result.ecc : undefined,
      "data-modules": ready ? String(modules) : undefined,
      "data-last-download": state.lastDownload,
      // One column: the frame and the overlay share the first cell, other parts flow below,
      // so the overlay is centred on the frame without the theme.
      style: {
        display: "inline-grid",
        "--rind-qr-code-modules": String(modules),
        "--rind-qr-code-quiet-zone": String(encoded.quietZone),
      },
    }),
    frame: (input: QrFrameInput): PartProps => {
      const describedBy =
        [input.describedBy, input.valueTextId]
          .filter((v) => v !== undefined && v !== "")
          .join(" ") || undefined
      return {
        ...part("frame"),
        id: ids.frame,
        xmlns: SVG_NS,
        viewBox: `0 0 ${n} ${n}`,
        "shape-rendering": "crispEdges",
        "data-state": encoded.status,
        style: { "grid-area": "1 / 1" },
        ...(ready
          ? {
              role: "img",
              "aria-label": input.named ? undefined : state.messages.label,
              "aria-describedby": describedBy,
            }
          : { "aria-hidden": "true", focusable: "false" }),
      }
    },
    pattern: (): PartProps => ({
      ...part("pattern"),
      id: ids.pattern,
      d: ready ? qrPath(encoded.result.modules, { quietZone: encoded.quietZone }) : "",
    }),
    overlay: (): PartProps => ({
      ...part("overlay"),
      id: ids.overlay,
      "data-covers": state.covers === undefined ? undefined : String(state.covers),
      // Over the frame's cell, centred; the symbol is never mirrored, so neither is this.
      style: { "grid-area": "1 / 1", "place-self": "center", "z-index": "1" },
    }),
    valueText: (): PartProps => ({
      ...part("value-text"),
      id: ids.valueText,
      style: visuallyHiddenStyle,
    }),
    /** `hasContent`: the trigger renders content of its own (then that content names it). */
    downloadTrigger: (hasContent: boolean): PartProps => ({
      ...part("download-trigger"),
      "data-state": state.downloading ? "downloading" : "idle",
      "data-disabled": dataFlag(!ready),
      "aria-label": hasContent ? undefined : state.messages.download,
    }),
  }
}

/** Development: the encoder failed for a value (once per distinct value, by the caller). */
export function warnEncodeError(encoded: QrEncoded): void {
  if (process.env.NODE_ENV === "production" || encoded.status !== "invalid") return
  const e = encoded.error
  const detail =
    e.error === "too-long"
      ? `the value needs ${e.neededBits} bits, the largest symbol holds ${e.availableBits} (${e.maxBytes} bytes at this level)`
      : e.error === "invalid-option"
        ? `the encoding option "${e.option}" is invalid`
        : "the value is not a string"
  console.warn(`[rind-ui] qr-code: no symbol rendered: ${detail}.`)
}
