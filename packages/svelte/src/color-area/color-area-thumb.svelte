<script lang="ts">
import { stripMarker } from "@rind-ui/core/internal"
import { mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import AxisInput from "./color-area-axis-input.svelte"
import { colorArea } from "./context"
import type { ColorAreaPartProps } from "./types"

// The handle: positioned from the value; renders the x and y inputs.
const { child, children, ...rest }: ColorAreaPartProps = $props()
const ctx = colorArea.get()
const ref = (el: HTMLElement) => {
  ctx.thumb.current = el
  return () => {
    if (ctx.thumb.current === el) ctx.thumb.current = null
  }
}
const merged = $derived(stripMarker(mergeProps(normalizeProps(ctx.api().thumb()), rest)))
</script>

{#snippet content()}{@render children?.(ctx.state())}<AxisInput axis="x" /><AxisInput axis="y" />{/snippet}

{#if child}
  {@render child({ props: { ...merged, children: content }, state: ctx.state() })}
{:else}
  <div {...attrs(merged)} {@attach ref}>{@render content()}</div>
{/if}
