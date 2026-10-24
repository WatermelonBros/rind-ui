<script lang="ts">
import { stripMarker } from "@rind-ui/core/internal"
import { mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { colorPicker } from "./context"
import type { ColorPickerSpanProps } from "./types"

// The colour in the current format. Not a live region.
const { child, children, ...rest }: ColorPickerSpanProps = $props()
const ctx = colorPicker.get()
const merged = $derived(stripMarker(mergeProps(normalizeProps(ctx.api().valueTextPart()), rest)))
</script>

{#if child}
  {@render child({ props: merged, state: ctx.state() })}
{:else}
  <span {...attrs(merged)}
    >{#if children}{@render children(ctx.state())}{:else}{ctx.api().valueText}{/if}</span
  >
{/if}
