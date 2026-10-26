<script lang="ts">
import { stripMarker } from "@rind-ui/core/internal"
import { mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { colorWheelContext } from "./context"
import type { ColorWheelValueProps } from "./types"

/** The formatted hue and a degree sign (hidden from assistive technology). */
const { child, children, ...rest }: ColorWheelValueProps = $props()
const ctx = colorWheelContext.get()
const merged = $derived(stripMarker(mergeProps(normalizeProps(ctx.api().valuePart()), rest)))
</script>

{#if child}
  {@render child({ props: merged, state: ctx.state() })}
{:else}
  <span {...attrs(merged)}>{#if children}{@render children(ctx.state())}{:else}{ctx.api().hue}°{/if}</span>
{/if}
