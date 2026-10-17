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
  type ColorSwatchPickerMessages,
  colorSwatchPickerMessages,
  colorVariables,
  matchSwatch,
  pickedColor,
  type SwatchItem,
  swatchColor,
  swatchKey,
} from "@rind-ui/core/internal"
import {
  type ComponentPropsWithRef,
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react"
import { useColorProp } from "../color-input"
import { useSwatchProps } from "../color-swatch/color-swatch"
import { mergeProps } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { useLocale, useMessages } from "../provider"
import { RadioGroup, type RadioGroupRootProps } from "../radio-group/radio-group"
import { renderPart } from "../render"

declare module "../provider" {
  interface RindMessageScopes {
    "color-swatch-picker": ColorSwatchPickerMessages
  }
}

const useIsoLayoutEffect = typeof document === "undefined" ? useEffect : useLayoutEffect

export interface ColorSwatchPickerChangeDetails extends ColorChangeDetails {
  /** The checked item's key. */
  readonly value: string
  readonly index: number
}

type Registered = SwatchItem & { readonly el: () => Element | null }

interface Ctx {
  readonly register: (item: Registered) => () => void
  readonly messages: ColorSwatchPickerMessages
  readonly locale: string
  readonly checked: string | null
}
const PickerContext = createContext<Ctx | null>(null)
function usePicker(part: string): Ctx {
  const ctx = useContext(PickerContext)
  if (!ctx) throw new Error(`ColorSwatchPicker.${part} must be inside ColorSwatchPicker.Root`)
  return ctx
}

interface ItemCtx {
  readonly color: Color
}
const ItemContext = createContext<ItemCtx | null>(null)

export type ColorSwatchPickerRootProps = Omit<
  RadioGroupRootProps,
  "value" | "defaultValue" | "onValueChange"
> & {
  readonly value?: ColorInput | null
  /** Default `null`: no swatch checked. */
  readonly defaultValue?: ColorInput | null
  readonly onValueChange?: (color: Color, details: ColorSwatchPickerChangeDetails) => void
  readonly locale?: string
  readonly messages?: MessageOverrides<ColorSwatchPickerMessages>
  readonly children?: ReactNode
}

/** A palette of colour swatches: at most one matches the colour (a Radio Group). */
function Root({
  value: valueProp,
  defaultValue: defaultProp,
  onValueChange,
  locale: ownLocale,
  messages: ownMessages,
  children,
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledBy,
  ...rest
}: ColorSwatchPickerRootProps) {
  const { locale } = useLocale(ownLocale)
  const messages = useMessages("color-swatch-picker", colorSwatchPickerMessages, ownMessages)
  const parsed = useColorProp(valueProp ?? undefined, "value", "color-swatch-picker")
  const parsedDefault = useColorProp(
    defaultProp ?? undefined,
    "defaultValue",
    "color-swatch-picker",
  )
  const controlled = valueProp !== undefined
  const [internal, setInternal] = useState<Color | null>(parsedDefault ?? null)
  const color = controlled ? (valueProp === null ? null : (parsed ?? null)) : internal
  const [items, setItems] = useState<readonly Registered[]>([])
  const [register] = useState(() => (item: Registered) => {
    setItems((prev) => [...prev.filter((i) => i.key !== item.key), item])
    return () => setItems((prev) => prev.filter((i) => i.key !== item.key))
  })
  const ordered = inDocumentOrder(items)
  const lastKey = useRef<string | null>(null)
  const checked = matchSwatch(ordered, color, lastKey.current)
  const ctx: Ctx = { register, messages, locale, checked }
  return (
    <PickerContext value={ctx}>
      <RadioGroup.Root
        orientation="horizontal"
        {...rest}
        data-color-swatch-picker=""
        aria-label={
          ariaLabelledBy === undefined ? (ariaLabel ?? messages.swatchPickerLabel) : ariaLabel
        }
        aria-labelledby={ariaLabelledBy}
        value={checked}
        onValueChange={(key, details) => {
          const index = ordered.findIndex((i) => i.key === key)
          const item = ordered[index]
          if (!item || key === null) return
          const next = pickedColor(item.color, color)
          const emitted = color ? toSpace(next, color.space) : next
          let cancelled = false
          onValueChange?.(emitted, {
            reason: details.reason,
            space: emitted.space,
            value: key,
            index,
            cancel: () => {
              cancelled = true
              details.cancel()
            },
          })
          if (cancelled) return
          lastKey.current = key
          if (!controlled) setInternal(emitted)
        }}
      >
        {children}
      </RadioGroup.Root>
    </PickerContext>
  )
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

export type ColorSwatchPickerItemProps = Omit<
  ComponentPropsWithRef<"button">,
  "value" | "color"
> & {
  readonly color: ColorInput
  /** The item's key (default the canonical `#RRGGBBAA`). */
  readonly value?: string
  readonly disabled?: boolean
  readonly colorName?: ColorNameProp
}

/** One swatch: a Radio Group item and its control (`role="radio"`), named by its colour. */
function Item({
  color: input,
  value,
  disabled,
  colorName,
  children,
  style,
  "aria-label": ariaLabel,
  ...rest
}: ColorSwatchPickerItemProps) {
  const ctx = usePicker("Item")
  const color = swatchColor(input)
  const key = value ?? swatchKey(color)
  const { register } = ctx
  const colorKey = swatchKey(color)
  const el = useRef<HTMLButtonElement | null>(null)
  useIsoLayoutEffect(
    () => register({ key, color, disabled, el: () => el.current }),
    // The colour is compared by its key: a fresh object for the same colour re-registers nothing.
    [register, key, colorKey, disabled],
  )
  const opaque = makeColor(color.space, color.channels, 1)
  const name = resolveColorName(
    color.alpha < 1 ? color : opaque,
    ctx.messages,
    ctx.locale,
    colorName,
  )
  const vars = normalizeProps({ style: colorVariables(color) }) as { style?: object }
  return (
    <ItemContext value={{ color }}>
      <RadioGroup.Item
        value={key}
        disabled={disabled === true}
        textValue={name}
        data-color-swatch-picker=""
      >
        <RadioGroup.ItemControl
          {...rest}
          ref={el}
          data-value={key}
          data-color-swatch-picker=""
          aria-label={ariaLabel ? `${name}, ${ariaLabel}` : name}
          style={{ ...vars.style, ...style }}
        >
          {children}
        </RadioGroup.ItemControl>
      </RadioGroup.Item>
    </ItemContext>
  )
}

/** The item's colour: a decorative Color Swatch (the item's name carries the colour). */
function Swatch(rest: ComponentPropsWithRef<"div">) {
  const item = useContext(ItemContext)
  if (!item) throw new Error("ColorSwatchPicker.Swatch must be inside ColorSwatchPicker.Item")
  const { api } = useSwatchProps({ color: item.color, decorative: true })
  return renderPart("div", mergeProps(normalizeProps(api.root()), { ...rest }), undefined, {})
}

/** Mounted only while the item is checked: the one selected mark, decorative. */
function Indicator(props: ComponentPropsWithRef<typeof RadioGroup.ItemIndicator>) {
  return <RadioGroup.ItemIndicator aria-hidden="true" data-color-swatch-picker="" {...props} />
}

export const ColorSwatchPicker = { Root, Item, Swatch, Indicator }
