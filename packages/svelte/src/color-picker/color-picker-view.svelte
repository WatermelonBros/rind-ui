<script lang="ts">
import { stripMarker } from "@rind-ui/core/internal"
import { mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { colorPicker } from "./context"
import type { ColorPickerViewProps } from "./types"

// Renders its children only while the picker's format is `format`.
const { format, child, children, ...rest }: ColorPickerViewProps = $props()
const ctx = colorPicker.get()
const merged = $derived(stripMarker(mergeProps(normalizeProps(ctx.api().view(format)), rest)))
</script>

{#if ctx.format() === format}
  {#if child}
    {@render child({ props: merged, state: ctx.state() })}
  {:else}
    <div {...attrs(merged)}>{@render children?.(ctx.state())}</div>
  {/if}
{/if}
