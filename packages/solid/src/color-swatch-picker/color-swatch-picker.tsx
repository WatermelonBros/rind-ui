/** @jsxImportSource solid-js */
// Color Swatch Picker parts (design §7): a Radio Group whose value is the key of the swatch
// matching the colour. Wiring only: matching is core's `matchSwatch`, every keyboard, focus and
// form rule is the Radio Group's.
import {
  type Color,
  type ColorChangeDetails,
  type ColorInput,
  type ColorNameProp,
  type MessageOverrides,
  makeColor,
  resolveColorName,
  toSpace,
} from "@rind-ui/core"
import {
  COLOR_PICKER_SCOPE,
  type ColorSwatchPickerMessages,
  colorSwatchPickerMessages,
  colorVariables,
  matchSwatch,
  pickedColor,
  type SwatchItem,
  swatchColor,
  swatchGroupNaming,
  swatchKey,
} from "@rind-ui/core/internal"
import {
  type Accessor,
  createContext,
  createEffect,
  createMemo,
  createSignal,
  type JSX,
  onCleanup,
  splitProps,
  untrack,
  useContext,
} from "solid-js"
import { useColorProp } from "../color-input"
import { useSwatchProps } from "../color-swatch/color-swatch"
import { afterMount } from "../lifecycle"
import { mergeProps } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { useLocale, useMessages } from "../provider"
import { RadioGroupNamingContext, type RadioGroupRootProps } from "../radio-group/radio-group"
import * as RadioGroup from "../radio-group/radio-group.parts"
import { renderPart } from "../render"

declare module "../provider" {
  interface RindMessageScopes {
    "color-swatch-picker": ColorSwatchPickerMessages
  }
}

export interface ColorSwatchPickerChangeDetails extends ColorChangeDetails {
  /** The checked item's key. */
  readonly value: string
  readonly index: number
}

type Registered = SwatchItem & { readonly el: () => Element | null }

interface Ctx {
  readonly register: (item: Registered) => () => void
  readonly messages: Accessor<ColorSwatchPickerMessages>
  readonly locale: Accessor<string>
}
const PickerContext = createContext<Ctx>()
function usePicker(part: string): Ctx {
  const ctx = useContext(PickerContext)
  if (!ctx) throw new Error(`ColorSwatchPicker.${part} must be inside ColorSwatchPicker.Root`)
  return ctx
}
const ItemContext = createContext<Accessor<Color>>()

export type ColorSwatchPickerRootProps = Omit<
  RadioGroupRootProps,
  "value" | "defaultValue" | "onValueChange"
> & {
  readonly value?: ColorInput | null | undefined
  /** Default `null`: no swatch checked. */
  readonly defaultValue?: ColorInput | null | undefined
  /** A swatch was checked; `details.value` is its key, `details.index` its index. */
  readonly onValueChange?:
    | ((color: Color, details: ColorSwatchPickerChangeDetails) => void)
    | undefined
  /** Formats the swatches' colour names. Default: the provider's. */
  readonly locale?: string | undefined
  /** The group's label (`swatchPickerLabel`) and the colour words. */
  readonly messages?: MessageOverrides<ColorSwatchPickerMessages> | undefined
}

/** The registered items in document order (a re-registered item would otherwise move last). */
function inDocumentOrder(items: readonly Registered[]): readonly Registered[] {
  return [...items].sort((a, b) => {
    const x = a.el()
    const y = b.el()
    if (!x || !y) return 0
    return x.compareDocumentPosition(y) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1
  })
}

/** A palette of colour swatches: at most one matches the colour (a Radio Group). */
function Root(props: ColorSwatchPickerRootProps) {
  const [local, rest] = splitProps(props, [
    "value",
    "defaultValue",
    "onValueChange",
    "locale",
    "messages",
    "children",
    "aria-label",
    "aria-labelledby",
  ])
  const loc = useLocale(() => local.locale)
  const messages = useMessages(
    "color-swatch-picker",
    colorSwatchPickerMessages,
    () => local.messages,
  )
  const parsed = useColorProp(() => local.value ?? undefined, "value", "color-swatch-picker")
  const parsedDefault = useColorProp(
    () => local.defaultValue ?? undefined,
    "defaultValue",
    "color-swatch-picker",
  )
  const [internal, setInternal] = createSignal<Color | null>(untrack(parsedDefault) ?? null)
  const controlled = () => local.value !== undefined
  const color = () =>
    controlled() ? (local.value === null ? null : (parsed() ?? null)) : internal()
  const [items, setItems] = createSignal<readonly Registered[]>([])
  const register = (item: Registered) => {
    setItems((prev) => [...prev.filter((i) => i.key !== item.key), item])
    return () => setItems((prev) => prev.filter((i) => i.key !== item.key))
  }
  let lastKey: string | null = null
  const ordered = createMemo(() => inDocumentOrder(items()))
  const checked = createMemo(() => matchSwatch(ordered(), color(), lastKey))
  const ctx: Ctx = { register, messages, locale: () => loc().locale }
  return (
    <PickerContext.Provider value={ctx}>
      <RadioGroupNamingContext.Provider value={swatchGroupNaming}>
        <RadioGroup.Root
          orientation="horizontal"
          {...rest}
          aria-label={
            local["aria-labelledby"] === undefined
              ? (local["aria-label"] ?? messages().swatchPickerLabel)
              : local["aria-label"]
          }
          aria-labelledby={local["aria-labelledby"]}
          value={checked()}
          onValueChange={(key, details) => {
            const list = untrack(ordered)
            const index = list.findIndex((i) => i.key === key)
            const item = list[index]
            if (!item || key === null) return
            const current = untrack(color)
            const next = pickedColor(item.color, current)
            const emitted = current ? toSpace(next, current.space) : next
            let cancelled = false
            local.onValueChange?.(emitted, {
              reason: details.reason,
              space: emitted.space,
              value: key,
              index,
              cancel: () => {
                cancelled = true
                details.cancel()
              },
            } as ColorSwatchPickerChangeDetails)
            if (cancelled) return
            lastKey = key
            if (!controlled()) setInternal(emitted)
          }}
        >
          {local.children}
        </RadioGroup.Root>
      </RadioGroupNamingContext.Provider>
    </PickerContext.Provider>
  )
}

export type ColorSwatchPickerItemProps = Omit<
  JSX.ButtonHTMLAttributes<HTMLButtonElement>,
  "value" | "color"
> & {
  /** The swatch's colour: a colour, or a string `parseColor` reads. */
  readonly color: ColorInput
  /** The item's key (default the canonical `#RRGGBBAA`). */
  readonly value?: string | undefined
  /** Disables this swatch only. */
  readonly disabled?: boolean | undefined
  /** A fixed name or a function replacing the computed colour name (the swatch's accessible name). */
  readonly colorName?: ColorNameProp | undefined
}

/** One swatch: a Radio Group item and its control (`role="radio"`), named by its colour. */
function Item(props: ColorSwatchPickerItemProps) {
  const [local, rest] = splitProps(props, [
    "color",
    "value",
    "disabled",
    "colorName",
    "children",
    "aria-label",
    "style",
  ])
  const ctx = usePicker("Item")
  const color = createMemo(() => swatchColor(local.color))
  const key = createMemo(() => local.value ?? swatchKey(color()))
  const colorKey = createMemo(() => swatchKey(color()))
  const [el, setEl] = createSignal<Element | null>(null)
  // The colour is compared by its key: a fresh object for the same colour re-registers nothing.
  afterMount(() => {
    createEffect(() => {
      const k = key()
      colorKey()
      const disabled = local.disabled
      onCleanup(ctx.register({ key: k, color: untrack(color), disabled, el: () => untrack(el) }))
    })
  })
  const name = createMemo(() => {
    const c = color()
    const opaque = makeColor(c.space, c.channels, 1)
    return resolveColorName(c.alpha < 1 ? c : opaque, ctx.messages(), ctx.locale(), local.colorName)
  })
  const merged = createMemo(() => {
    const vars = normalizeProps({ style: colorVariables(color()) }) as { style?: object }
    return mergeProps(
      {
        ref: setEl,
        "data-value": key(),
        "aria-label": local["aria-label"] ? `${name()}, ${local["aria-label"]}` : name(),
        style: vars.style,
      },
      { ...rest, style: local.style },
    )
  })
  return (
    <ItemContext.Provider value={color}>
      <RadioGroup.Item value={key()} disabled={local.disabled === true} textValue={name()}>
        <RadioGroup.ItemControl {...merged()}>{local.children}</RadioGroup.ItemControl>
      </RadioGroup.Item>
    </ItemContext.Provider>
  )
}

/** The item's colour: a decorative Color Swatch (the item's name carries the colour). */
function Swatch(props: JSX.HTMLAttributes<HTMLDivElement>) {
  const [, rest] = splitProps(props, ["children"])
  const color = useContext(ItemContext)
  if (!color) throw new Error("ColorSwatchPicker.Swatch must be inside ColorSwatchPicker.Item")
  const swatch = useSwatchProps({ color, decorative: true })
  const merged = createMemo(() =>
    mergeProps(normalizeProps(swatch().api.root(COLOR_PICKER_SCOPE, "swatch")), rest),
  )
  return renderPart(
    undefined,
    merged,
    {},
    () => undefined,
    (p) => <div {...p} />,
  )
}

/** Mounted only while the item is checked: the one selected mark, decorative. */
function Indicator(props: Parameters<typeof RadioGroup.ItemIndicator>[0]) {
  return <RadioGroup.ItemIndicator aria-hidden="true" {...props} />
}

export const ColorSwatchPicker = { Root, Item, Swatch, Indicator }
