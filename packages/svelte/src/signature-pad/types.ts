import type {
  MessageOverrides,
  SignatureExportOptions,
  SignaturePadMessages,
  SignaturePadState,
  SignatureValue,
} from "@rind-ui/core"
import type { Snippet } from "svelte"
import type { HTMLAttributes, HTMLButtonAttributes, SVGAttributes } from "svelte/elements"
import type { ChildArgs } from "../child"

declare module "../provider" {
  interface RindMessageScopes {
    "signature-pad": SignaturePadMessages
  }
}

/** What every part's snippets receive. */
export interface SignaturePadRenderState {
  readonly state: SignaturePadState
  readonly value: SignatureValue
  readonly empty: boolean
  readonly strokeCount: number
  readonly disabled: boolean
  readonly readOnly: boolean
  /** The strokes as an image (PNG by default); rejects with `EmptySignatureError` when empty. */
  readonly toBlob: (options?: SignatureExportOptions) => Promise<Blob>
  /** Saves the strokes as a file (PNG by default). */
  readonly download: (fileName?: string, options?: SignatureExportOptions) => Promise<void>
}

type Part<A> = Omit<A, "children"> & {
  readonly child?: Snippet<[ChildArgs<SignaturePadRenderState>]> | undefined
  readonly children?: Snippet<[SignaturePadRenderState]> | undefined
}

export type SignaturePadRootProps = Part<HTMLAttributes<HTMLDivElement>> & {
  /** The strokes, controlled (`bind:value`): `{ width, height, strokes }`. */
  value?: SignatureValue | undefined
  /** The strokes, uncontrolled. */
  readonly defaultValue?: SignatureValue | undefined
  /** When a stroke ends, on clear, undo and form reset; never while drawing. */
  readonly onValueChange?: ((value: SignatureValue) => void) | undefined
  /** The form field's name. */
  readonly name?: string | undefined
  /** The form id, when the pad is outside it. */
  readonly form?: string | undefined
  /** What the form submits: an SVG data URL, or the strokes as JSON. Default "svg". */
  readonly formValue?: "svg" | "json" | undefined
  /** The ink colour inlined in the submitted SVG. Default "#000". */
  readonly inkColor?: string | undefined
  /** An empty pad blocks submit. */
  readonly required?: boolean | undefined
  /** No drawing, not submitted. */
  readonly disabled?: boolean | undefined
  /** Shows and submits the strokes; no drawing, clear or undo. */
  readonly readonly?: boolean | undefined
  /** Shows the pad invalid (a Field sets it too). */
  readonly invalid?: boolean | undefined
  /** Points closer than this to the previous one are dropped (px). Default 1. */
  readonly minDistance?: number | undefined
  readonly messages?: MessageOverrides<SignaturePadMessages> | undefined
  /** Default: the provider's locale (the announcements' language). */
  readonly locale?: string | undefined
}
export type SignaturePadLabelProps = Part<HTMLAttributes<HTMLSpanElement>>
export type SignaturePadControlProps = Part<HTMLAttributes<HTMLDivElement>>
export type SignaturePadSegmentProps = Part<SVGAttributes<SVGSVGElement>>
export type SignaturePadGuideProps = Part<HTMLAttributes<HTMLDivElement>>
export type SignaturePadStatusProps = Part<HTMLAttributes<HTMLSpanElement>>
export type SignaturePadTriggerProps = Part<HTMLButtonAttributes>
