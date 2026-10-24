<script lang="ts">
import { COLOR_PICKER_SCOPE, stripMarker } from "@rind-ui/core/internal"
import type { HTMLAttributes } from "svelte/elements"
import { useSwatchProps } from "../color-swatch/context"
import { mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { swatchItem } from "./context"

// The item's colour: a decorative Color Swatch (the item's name carries the colour).
const props: HTMLAttributes<HTMLDivElement> = $props()
const color = swatchItem.maybe()
if (!color) throw new Error("ColorSwatchPicker.Swatch must be inside ColorSwatchPicker.Item")
const uid = $props.id()
const swatch = useSwatchProps({ instance: () => uid, color, decorative: true })
const merged = $derived(
  stripMarker(
    mergeProps(
      normalizeProps(swatch().api.root(COLOR_PICKER_SCOPE, "swatch")),
      props as Record<string, unknown>,
    ),
  ),
)
</script>

<div {...attrs(merged)}></div>
