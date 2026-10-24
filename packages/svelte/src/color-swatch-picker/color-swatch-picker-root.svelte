<script lang="ts">
// Color Swatch Picker parts (design §7): a Radio Group whose value is the key of the swatch
// matching the colour. Wiring only: matching is core's `matchSwatch`, every keyboard, focus and
// form rule is the Radio Group's.
import { type Color, toSpace } from "@rind-ui/core"
import {
  colorSwatchPickerMessages,
  matchSwatch,
  pickedColor,
  swatchGroupNaming,
} from "@rind-ui/core/internal"
import { untrack } from "svelte"
import { useColorProp } from "../color-input"
import { useLocale, useMessages } from "../provider"
import { radioGroupNaming } from "../radio-group/context"
import RadioGroupRoot from "../radio-group/radio-group-root.svelte"
import type { RadioGroupRootProps } from "../radio-group/types"
import { type Registered, swatchPicker } from "./context"
import type { ColorSwatchPickerRootProps } from "./types"

let {
  value = $bindable(),
  defaultValue,
  onValueChange,
  locale: ownLocale,
  messages: ownMessages,
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledBy,
  children,
  ...rest
}: ColorSwatchPickerRootProps = $props()
const loc = useLocale(() => ownLocale)
const messages = useMessages("color-swatch-picker", colorSwatchPickerMessages, () => ownMessages)
const parsed = useColorProp(() => value ?? undefined, "value", "color-swatch-picker")
const parsedDefault = useColorProp(
  () => defaultValue ?? undefined,
  "defaultValue",
  "color-swatch-picker",
)
const controlled = untrack(() => value !== undefined)
let internal = $state.raw<Color | null>(untrack(() => parsedDefault() ?? null))
const color = $derived(controlled ? (value === null ? null : (parsed() ?? null)) : internal)
let items = $state.raw<readonly Registered[]>([])
const register = (item: Registered) =>
  untrack(() => {
    items = [...items.filter((i) => i.key !== item.key), item]
    return () =>
      untrack(() => {
        items = items.filter((i) => i.key !== item.key)
      })
  })
/** The registered items in document order (a re-registered item would otherwise move last). */
const ordered = $derived(
  [...items].sort((a, b) => {
    const x = a.el()
    const y = b.el()
    if (!x || !y) return 0
    return x.compareDocumentPosition(y) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1
  }),
)
let lastKey: string | null = null
const checked = $derived(matchSwatch(ordered, color, lastKey))
swatchPicker.set({ register, messages, locale: () => loc.current.locale })
radioGroupNaming.set(swatchGroupNaming)
const onChange = (key: string | null, details: { reason: string; cancel(): void }) => {
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
  lastKey = key
  if (controlled) value = emitted
  else internal = emitted
}
</script>

<RadioGroupRoot
  orientation="horizontal"
  {...rest as RadioGroupRootProps}
  aria-label={ariaLabelledBy === undefined ? (ariaLabel ?? messages().swatchPickerLabel) : ariaLabel}
  aria-labelledby={ariaLabelledBy}
  value={checked}
  onValueChange={onChange as never}
  {children}
/>
