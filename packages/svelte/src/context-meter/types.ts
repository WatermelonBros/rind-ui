import type {
  ContextMeterLevel,
  ContextMeterMessages,
  ContextMeterState,
  MessageOverrides,
} from "@rind-ui/core"
import type { Snippet } from "svelte"
import type { HTMLAttributes } from "svelte/elements"
import type { ChildArgs } from "../child"

declare module "../provider" {
  interface RindMessageScopes {
    "context-meter": ContextMeterMessages
  }
}

/** What every part's snippets receive. */
export interface ContextMeterRenderState {
  readonly state: ContextMeterState
  /** 0–100, one decimal. */
  readonly percent: number
  /** The value in words ("17K of 100K tokens, 17%"). */
  readonly valueText: string
}

type Part<A> = Omit<A, "children"> & {
  readonly child?: Snippet<[ChildArgs<ContextMeterRenderState>]> | undefined
  readonly children?: Snippet<[ContextMeterRenderState]> | undefined
}

export type ContextMeterRootProps = Part<HTMLAttributes<HTMLDivElement>> & {
  /** Tokens used. */
  readonly used: number
  /** The window size; null when unknown (text, no meter role). */
  readonly max: number | null
  /** The warning threshold (fraction). Default 0.75. */
  readonly warnAt?: number | undefined
  /** The full threshold (fraction). Default 0.95. */
  readonly fullAt?: number | undefined
  /** Announce a rising threshold crossing, once. Default "polite". */
  readonly announce?: "off" | "polite" | undefined
  /** A new value (a new thread) re-arms the thresholds. */
  readonly resetKey?: string | undefined
  /** A rising crossing (compact the thread here). */
  readonly onThreshold?: ((level: ContextMeterLevel) => void) | undefined
  /** How the numbers are written. Default: compact notation. */
  readonly formatOptions?: Intl.NumberFormatOptions | undefined
  readonly messages?: MessageOverrides<ContextMeterMessages> | undefined
  /** Default: the provider's locale. */
  readonly locale?: string | undefined
}
export type ContextMeterLabelProps = Part<HTMLAttributes<HTMLSpanElement>>
export type ContextMeterValueTextProps = Part<HTMLAttributes<HTMLSpanElement>>
export type ContextMeterDivProps = Part<HTMLAttributes<HTMLDivElement>>
export type ContextMeterBreakdownProps = Part<HTMLAttributes<HTMLDListElement>>
export type ContextMeterBreakdownItemProps = Part<HTMLAttributes<HTMLDivElement>> & {
  /** Identifies the row (`data-key`); `key` is reserved. */
  readonly itemKey: string
  /** The `dt`: what the tokens went to ("System prompt"). */
  readonly label?: string | undefined
  /** The `dd`: how many ("2.1K tokens"). */
  readonly amount?: string | undefined
}
