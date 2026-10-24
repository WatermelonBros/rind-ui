import type { MessageOverrides, MeterMessages, MeterZone, RangeOrientation } from "@rind-ui/core"
import type { Snippet } from "svelte"
import type { HTMLAttributes } from "svelte/elements"
import type { ChildArgs } from "../child"

declare module "../provider" {
  interface RindMessageScopes {
    meter: MeterMessages
  }
}

/** What every part's snippets receive. */
export interface MeterRenderState {
  readonly value: number
  readonly percent: number
  readonly zone: MeterZone | undefined
  readonly valueText: string | undefined
}

export type MeterPartProps = Omit<HTMLAttributes<HTMLElement>, "children"> & {
  readonly child?: Snippet<[ChildArgs<MeterRenderState>]> | undefined
  readonly children?: Snippet<[MeterRenderState]> | undefined
}

export type MeterRootProps = MeterPartProps & {
  /** Required: a meter is never indeterminate. */
  readonly value: number
  readonly min?: number | undefined
  readonly max?: number | undefined
  /** HTML `<meter>` regions: `low`, `high` and where the `optimum` lies. */
  readonly low?: number | undefined
  readonly high?: number | undefined
  readonly optimum?: number | undefined
  readonly orientation?: RangeOrientation | undefined
  /** Default `{ style: "percent" }`: the fraction; any other style formats the value. */
  readonly formatOptions?: Intl.NumberFormatOptions | undefined
  /** Default: the provider's locale. */
  readonly locale?: string | undefined
  readonly messages?: MessageOverrides<MeterMessages> | undefined
}
