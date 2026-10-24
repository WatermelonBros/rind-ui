<script lang="ts">
import { makeColor, resolveColorName } from "@rind-ui/core"
import { colorVariables, swatchColor, swatchKey } from "@rind-ui/core/internal"
import { untrack } from "svelte"
import { elementRef } from "../element-ref.svelte"
import { normalizeProps } from "../normalize-props"
import RadioGroupItem from "../radio-group/radio-group-item.svelte"
import RadioGroupItemControl from "../radio-group/radio-group-item-control.svelte"
import { swatchItem, swatchPicker } from "./context"
import type { ColorSwatchPickerItemProps } from "./types"

// One swatch: a Radio Group item and its control (`role="radio"`), named by its colour.
const {
  color: input,
  value,
  disabled = false,
  colorName,
  "aria-label": ariaLabel,
  style,
  children,
  ...rest
}: ColorSwatchPickerItemProps = $props()
const ctx = swatchPicker.maybe()
if (!ctx) throw new Error("ColorSwatchPicker.Item must be inside ColorSwatchPicker.Root")
const color = $derived(swatchColor(input))
const key = $derived(value ?? swatchKey(color))
const colorKey = $derived(swatchKey(color))
const el = elementRef("button")
swatchItem.set(() => color)
// The colour is compared by its key: a fresh object for the same colour re-registers nothing.
$effect(() => {
  void colorKey
  const k = key
  const off = disabled
  return untrack(() => ctx.register({ key: k, color, disabled: off, el: () => el.current }))
})
const name = $derived.by(() => {
  const opaque = makeColor(color.space, color.channels, 1)
  return resolveColorName(color.alpha < 1 ? color : opaque, ctx.messages(), ctx.locale(), colorName)
})
const vars = $derived(
  (normalizeProps({ style: colorVariables(color) }) as { style?: string }).style ?? "",
)
</script>

<RadioGroupItem value={key} {disabled} textValue={name}
  ><RadioGroupItemControl
    {...rest as Record<string, unknown>}
    {...el.props}
    data-value={key}
    aria-label={ariaLabel ? `${name}, ${ariaLabel}` : name}
    style={[vars, style].filter(Boolean).join("; ")}>{@render children?.()}</RadioGroupItemControl
  ></RadioGroupItem
>
