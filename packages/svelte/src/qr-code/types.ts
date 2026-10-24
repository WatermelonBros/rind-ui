import type {
  MessageOverrides,
  QrCodeMessages,
  QrDownloadDetails,
  QrDownloadOptions,
  QrEncodeFailure,
  QrEncodingOptions,
  QrMime,
} from "@rind-ui/core"
import type { Snippet } from "svelte"
import type { HTMLAttributes, SVGAttributes } from "svelte/elements"
import type { ButtonProps } from "../button/types"
import type { ChildArgs } from "../child"

declare module "../provider" {
  interface RindMessageScopes {
    "qr-code": QrCodeMessages
  }
}

export interface QrCodeState {
  /** `ready`: a symbol; `empty`: no value; `invalid`: the encoder failed. */
  readonly state: "ready" | "empty" | "invalid"
  readonly downloading: boolean
}
/** What `bind:this` on the Root exposes. */
export interface QrCodeApi {
  /** The symbol as a `data:` URL (PNG by default), overlay composited like a download. */
  readonly getDataUrl: (
    mimeType?: QrMime,
    options?: Omit<QrDownloadOptions, "mimeType" | "fileName">,
  ) => Promise<string>
  /** Starts a download, as pressing the trigger does (ignored while one runs). */
  readonly download: (options?: QrDownloadOptions) => void
  /** Proposes a new value (only `onValueChange` when controlled). */
  readonly setValue: (value: string) => void
}
type Part<A> = Omit<A, "children"> & {
  readonly child?: Snippet<[ChildArgs<QrCodeState>]> | undefined
  readonly children?: Snippet<[QrCodeState]> | undefined
}
export type QrCodeRootProps = Part<HTMLAttributes<HTMLDivElement>> & {
  /** The encoded text; `bind:value` controls it. */
  value?: string | undefined
  /** Default `""` (an empty frame). */
  readonly defaultValue?: string | undefined
  readonly onValueChange?: ((value: string) => void) | undefined
  /** Encoder options and the quiet zone, compared by value (an inline object is fine). */
  readonly encoding?: QrEncodingOptions | undefined
  /** The encoder failed (too long, invalid option): once per distinct value. */
  readonly onEncodeError?: ((error: QrEncodeFailure) => void) | undefined
  readonly onDownload?: ((details: QrDownloadDetails) => void) | undefined
  readonly messages?: MessageOverrides<QrCodeMessages> | undefined
}
export type QrCodeFrameProps = Part<SVGAttributes<SVGSVGElement>>
export type QrCodePatternProps = Omit<SVGAttributes<SVGPathElement>, "children"> & {
  readonly child?: Snippet<[ChildArgs<QrCodeState>]> | undefined
}
export type QrCodeOverlayProps = Part<HTMLAttributes<HTMLDivElement>>
export type QrCodeValueTextProps = Part<HTMLAttributes<HTMLSpanElement>>
export type QrCodeDownloadTriggerProps = Omit<
  ButtonProps,
  "disabled" | "focusableWhenDisabled" | "onPress" | "type"
> &
  QrDownloadOptions
