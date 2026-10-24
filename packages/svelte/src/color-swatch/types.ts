import type { Color, ColorInput, ColorNameProp, MessageOverrides } from "@rind-ui/core"
import type { ColorSwatchMessages } from "@rind-ui/core/internal"
import type { Snippet } from "svelte"
import type { HTMLAttributes } from "svelte/elements"
import type { ChildArgs } from "../child"

export interface ColorSwatchState {
  readonly color: Color
  readonly transparent: boolean
}

export type ColorSwatchProps = Omit<HTMLAttributes<HTMLDivElement>, "color" | "children"> & {
  readonly child?: Snippet<[ChildArgs<ColorSwatchState>]> | undefined
  readonly children?: Snippet<[ColorSwatchState]> | undefined
  /** Default transparent black. */
  readonly color?: ColorInput | undefined
  /** `false`: the opaque colour (default true). */
  readonly respectAlpha?: boolean | undefined
  /** A fixed name (a design token) or a function replacing the computed name. */
  readonly colorName?: ColorNameProp | undefined
  /** Formats the transparency percentage. Default: the provider's locale. */
  readonly locale?: string | undefined
  /** The role description and the colour words. */
  readonly messages?: MessageOverrides<ColorSwatchMessages> | undefined
}

export type TransparencyGridProps = Omit<HTMLAttributes<HTMLDivElement>, "children"> & {
  readonly child?: Snippet<[ChildArgs<undefined>]> | undefined
  readonly children?: Snippet | undefined
  /** The `data-scope` it carries (default `"color-swatch"`). */
  readonly scope?: string | undefined
}
