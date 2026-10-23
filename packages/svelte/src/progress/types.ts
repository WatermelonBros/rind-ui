import type {
  MessageOverrides,
  ProgressMessages,
  ProgressState,
  RangeOrientation,
} from "@rind-ui/core"
import type { Snippet } from "svelte"
import type { HTMLAttributes } from "svelte/elements"
import type { ChildArgs } from "../child"

declare module "../provider" {
  interface RindMessageScopes {
    progress: ProgressMessages
  }
}

/** What every part's snippets receive. */
export interface ProgressRenderState {
  readonly state: ProgressState
  /** The clamped value; `null` when indeterminate. */
  readonly value: number | null
  readonly percent: number
  readonly valueText: string | undefined
}

export type ProgressPartProps = Omit<HTMLAttributes<HTMLElement>, "children"> & {
  readonly child?: Snippet<[ChildArgs<ProgressRenderState>]> | undefined
  readonly children?: Snippet<[ProgressRenderState]> | undefined
}

export type ProgressRootProps = ProgressPartProps & {
  /** `null` / `undefined` (the default): indeterminate. 0 is a value. */
  readonly value?: number | null | undefined
  readonly min?: number | undefined
  readonly max?: number | undefined
  readonly orientation?: RangeOrientation | undefined
  /** Default `{ style: "percent" }`: the fraction; any other style formats the value. */
  readonly formatOptions?: Intl.NumberFormatOptions | undefined
  /** Default: the provider's locale. */
  readonly locale?: string | undefined
  /** Announce `messages.complete` when the value reaches `max`. Never on mount. */
  readonly announceCompletion?: boolean | undefined
  readonly messages?: MessageOverrides<ProgressMessages> | undefined
}
