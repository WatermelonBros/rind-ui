<script lang="ts">
import { stripMarker } from "@rind-ui/core/internal"
import { elementRef } from "../element-ref.svelte"
import { mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { colorWheelContext } from "./context"
import type { ColorWheelPartProps } from "./types"

/** The handle, rotated by the hue; shows the input's focus. */
const { child, children, ...rest }: ColorWheelPartProps = $props()
const ctx = colorWheelContext.get()
const el = elementRef("div")
$effect(() => {
  const node = el.current
  ctx.thumb.current = node instanceof HTMLElement ? node : null
})
const merged = $derived(
  stripMarker(mergeProps(normalizeProps(ctx.api().thumb()), { ...el.props, ...rest })),
)
</script>

{#if child}
  {@render child({ props: merged, state: ctx.state() })}
{:else}
  <div {...attrs(merged)}>{@render children?.(ctx.state())}</div>
{/if}
