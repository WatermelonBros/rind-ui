// Color Swatch parts: wiring only; connect decides role, name and the inline colour.

import type { Color, ColorInput, ColorNameProp, MessageOverrides } from "@rind-ui/core"
import {
  type ColorSwatchMessages,
  colorSwatchConnect,
  colorSwatchMessages,
  swatchColor,
  transparencyGridProps,
} from "@rind-ui/core/internal"
import { type ComponentPropsWithRef, createContext, useContext } from "react"
import { mergeProps } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { useLocale, useMessages } from "../provider"
import { type RenderProp, renderPart } from "../render"
import { useRootId } from "../use-ids"

declare module "../provider" {
  interface RindMessageScopes {
    "color-swatch": ColorSwatchMessages
  }
}

export interface ColorSwatchState {
  readonly color: Color
  readonly transparent: boolean
}

export type ColorSwatchProps = Omit<ComponentPropsWithRef<"div">, "color"> & {
  /** Default transparent black. */
  readonly color?: ColorInput
  /** `false`: the opaque colour (default true). */
  readonly respectAlpha?: boolean
  readonly colorName?: ColorNameProp
  readonly locale?: string
  readonly messages?: MessageOverrides<ColorSwatchMessages>
  readonly render?: RenderProp<ColorSwatchState>
}

/**
 * Internal (not exported from the package): set by the Color Picker's swatch parts, whose
 * swatches render under the picker's scope (`swatch`, `value-swatch`).
 */
export const SwatchNaming = createContext<{ readonly scope: string; readonly part: string } | null>(
  null,
)

/** The swatch's props for a colour; shared with the parts that show one (picker, swatch picker). */
export function useSwatchProps(options: {
  readonly id?: string | undefined
  readonly color: ColorInput | undefined
  readonly respectAlpha?: boolean | undefined
  readonly colorName?: ColorNameProp | undefined
  readonly locale?: string | undefined
  readonly messages?: MessageOverrides<ColorSwatchMessages> | undefined
  readonly ariaLabel?: string | undefined
  readonly decorative?: boolean | undefined
}) {
  const instance = useRootId(options.id)
  const { locale } = useLocale(options.locale)
  const messages = useMessages("color-swatch", colorSwatchMessages, options.messages)
  const color = swatchColor(options.color)
  const api = colorSwatchConnect({
    instance,
    color,
    respectAlpha: options.respectAlpha,
    messages,
    locale,
    colorName: options.colorName,
    ariaLabel: options.ariaLabel,
    decorative: options.decorative,
  })
  return { instance, color, api }
}

function Root({
  color: input,
  respectAlpha,
  colorName,
  locale,
  messages,
  render,
  id,
  "aria-label": ariaLabel,
  ...rest
}: ColorSwatchProps) {
  const { color, api } = useSwatchProps({
    id,
    color: input,
    respectAlpha,
    colorName,
    locale,
    messages,
    ariaLabel,
  })
  const naming = useContext(SwatchNaming)
  const props = mergeProps(
    normalizeProps(naming ? api.root(naming.scope, naming.part) : api.root()),
    rest,
  )
  return renderPart("div", props, render, {
    color,
    transparent: (respectAlpha === false ? 1 : color.alpha) < 1,
  })
}

/** A decorative checkerboard filling its parent, under a colour that has transparency. */
export function TransparencyGrid({
  scope = "color-swatch",
  render,
  ...rest
}: ComponentPropsWithRef<"div"> & {
  readonly scope?: string
  readonly render?: RenderProp<Record<never, never>>
}) {
  const instance = useRootId(undefined)
  const props = mergeProps(normalizeProps(transparencyGridProps(scope, instance)), rest)
  return renderPart("div", props, render, {})
}

/** A chip that shows a colour and names it for assistive technology. */
export const ColorSwatch = { Root, TransparencyGrid }
