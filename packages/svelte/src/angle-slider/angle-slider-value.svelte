<script lang="ts">
import { stripMarker } from "@rind-ui/core/internal"
import { mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { angleSliderContext } from "./context"
import type { AngleSliderValueProps } from "./types"

/** The formatted angle and a degree sign (hidden from assistive technology). */
const { child, children, ...rest }: AngleSliderValueProps = $props()
const ctx = angleSliderContext.get()
const merged = $derived(stripMarker(mergeProps(normalizeProps(ctx.api().valuePart()), rest)))
</script>

{#if child}
  {@render child({ props: merged, state: ctx.state() })}
{:else}
  <span {...attrs(merged)}>{#if children}{@render children(ctx.state())}{:else}{ctx.api().formatted}°{/if}</span>
{/if}
