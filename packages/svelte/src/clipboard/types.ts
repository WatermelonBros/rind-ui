import type {
  ClipboardCopyDetails,
  ClipboardCopyState,
  ClipboardMessages,
  MessageOverrides,
} from "@rind-ui/core"
import type { Snippet } from "svelte"
import type {
  HTMLAttributes,
  HTMLButtonAttributes,
  HTMLInputAttributes,
  HTMLLabelAttributes,
} from "svelte/elements"
import type { ChildArgs } from "../child"

declare module "../provider" {
  interface RindMessageScopes {
    clipboard: ClipboardMessages
  }
}

/** What every part's snippets receive. */
export interface ClipboardRenderState {
  readonly copyState: ClipboardCopyState
  readonly value: string
}
type Part<A> = Omit<A, "children"> & {
  readonly child?: Snippet<[ChildArgs<ClipboardRenderState>]> | undefined
  readonly children?: Snippet<[ClipboardRenderState]> | undefined
}
export type ClipboardRootProps = Part<HTMLAttributes<HTMLDivElement>> & {
  /** What a press copies; read when the write starts. */
  readonly value: string
  /** How long `copied` / `error` last before `idle` (ms). Default 2000. */
  readonly copyFeedbackDuration?: number | undefined
  readonly disabled?: boolean | undefined
  /** Once per result, after the write settled (or the Input's own copy). */
  readonly onCopy?: ((details: ClipboardCopyDetails) => void) | undefined
  /** With text in the Trigger, set `copy` to that text (label in name). */
  readonly messages?: MessageOverrides<ClipboardMessages> | undefined
  /** Default: the provider's locale (the announcement's language). */
  readonly locale?: string | undefined
}
export type ClipboardLabelProps = Part<HTMLLabelAttributes>
export type ClipboardControlProps = Part<HTMLAttributes<HTMLDivElement>>
export type ClipboardInputProps = Omit<HTMLInputAttributes, "children"> & {
  readonly child?: Snippet<[ChildArgs<ClipboardRenderState>]> | undefined
}
export type ClipboardTriggerProps = Part<HTMLButtonAttributes>
export type ClipboardIndicatorProps = Part<HTMLAttributes<HTMLSpanElement>> & {
  /** Rendered while copied (else `children`). */
  readonly copied?: Snippet<[ClipboardRenderState]> | undefined
  /** Rendered on error (else `children`). */
  readonly failed?: Snippet<[ClipboardRenderState]> | undefined
}
export type ClipboardValueTextProps = Part<HTMLAttributes<HTMLSpanElement>>
