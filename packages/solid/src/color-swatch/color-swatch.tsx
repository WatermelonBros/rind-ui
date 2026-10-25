/** @jsxImportSource solid-js */
// Color Swatch parts: wiring only; connect decides role, name and the inline colour.
import type { Color, ColorInput, ColorNameProp, MessageOverrides } from "@rind-ui/core"
import {
  type ColorSwatchMessages,
  colorSwatchConnect,
  colorSwatchMessages,
  swatchColor,
  transparencyGridProps,
} from "@rind-ui/core/internal"
import {
  type Accessor,
  createContext,
  createMemo,
  type JSX,
  splitProps,
  useContext,
} from "solid-js"
import { mergeProps } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { useLocale, useMessages } from "../provider"
import { type RenderProp, reactive, renderPart } from "../render"
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

export type ColorSwatchProps = Omit<JSX.HTMLAttributes<HTMLDivElement>, "color" | "children"> & {
  /** Default transparent black. */
  readonly color?: ColorInput | null | undefined
  /** `false`: the opaque colour (default true). */
  readonly respectAlpha?: boolean | undefined
  /** A fixed name (a design token) or a function replacing the computed name. */
  readonly colorName?: ColorNameProp | undefined
  /** Formats the transparency percentage. Default: the provider's locale. */
  readonly locale?: string | undefined
  /** The role description and the colour words. */
  readonly messages?: MessageOverrides<ColorSwatchMessages> | undefined
  /** Another element: a function receiving the props to spread and the swatch's state. */
  readonly render?: RenderProp<ColorSwatchState> | undefined
  readonly children?: JSX.Element
}

/**
 * Internal (not exported from the package): set by the Color Picker's swatch parts, whose
 * swatches render under the picker's scope (`swatch`, `value-swatch`).
 */
export const SwatchNamingContext = createContext<{
  readonly scope: string
  readonly part: string
} | null>(null)

/**
 * The swatch's props for a colour (getters); shared with the parts that show one. Call in a
 * component; read the result in a computation.
 */
export function useSwatchProps(options: {
  readonly id?: () => string | undefined
  readonly color: () => ColorInput | null | undefined
  readonly respectAlpha?: () => boolean | undefined
  readonly colorName?: () => ColorNameProp | undefined
  readonly locale?: () => string | undefined
  readonly messages?: () => MessageOverrides<ColorSwatchMessages> | undefined
  readonly ariaLabel?: () => string | undefined
  readonly decorative?: boolean
}): Accessor<{ color: Color; api: ReturnType<typeof colorSwatchConnect> }> {
  const instance = useRootId(options.id ?? (() => undefined))
  const loc = useLocale(options.locale ?? (() => undefined))
  const messages = useMessages("color-swatch", colorSwatchMessages, options.messages)
  return createMemo(() => {
    const color = swatchColor(options.color() ?? undefined)
    const api = colorSwatchConnect({
      instance: instance(),
      color,
      respectAlpha: options.respectAlpha?.(),
      messages: messages(),
      locale: loc().locale,
      colorName: options.colorName?.(),
      ariaLabel: options.ariaLabel?.(),
      decorative: options.decorative,
    })
    return { color, api }
  })
}

function Root(props: ColorSwatchProps) {
  const [local, rest] = splitProps(props, [
    "color",
    "respectAlpha",
    "colorName",
    "locale",
    "messages",
    "render",
    "children",
    "id",
    "aria-label",
  ])
  const swatch = useSwatchProps({
    id: () => local.id,
    color: () => local.color,
    respectAlpha: () => local.respectAlpha,
    colorName: () => local.colorName,
    locale: () => local.locale,
    messages: () => local.messages,
    ariaLabel: () => local["aria-label"],
  })
  const naming = useContext(SwatchNamingContext)
  const merged = createMemo(() => {
    const { api } = swatch()
    return mergeProps(
      normalizeProps(naming ? api.root(naming.scope, naming.part) : api.root()),
      rest,
    )
  })
  const state = reactive<ColorSwatchState>(() => ({
    color: swatch().color,
    transparent: (local.respectAlpha === false ? 1 : swatch().color.alpha) < 1,
  }))
  const children = () => local.children
  return renderPart(local.render, merged, state, children, (p) => <div {...p}>{children()}</div>)
}

/** A decorative checkerboard filling its parent, under a colour that has transparency. */
export function TransparencyGrid(
  props: Omit<JSX.HTMLAttributes<HTMLDivElement>, "children"> & {
    /** The `data-scope` it carries (default `"color-swatch"`). */
    readonly scope?: string | undefined
    /** Another element: a function receiving the props to spread. */
    readonly render?: RenderProp<Record<never, never>> | undefined
    readonly children?: JSX.Element
  },
) {
  const [local, rest] = splitProps(props, ["scope", "render", "children"])
  const instance = useRootId(() => undefined)
  const merged = createMemo(() =>
    mergeProps(
      normalizeProps(transparencyGridProps(local.scope ?? "color-swatch", instance())),
      rest,
    ),
  )
  const children = () => local.children
  return renderPart(local.render, merged, {}, children, (p) => <div {...p}>{children()}</div>)
}

/** A chip that shows a colour and names it for assistive technology. */
export const ColorSwatch = { Root, TransparencyGrid }
