<script lang="ts">
import { stripMarker } from "@rind-ui/core/internal"
import { elementRef } from "../element-ref.svelte"
import { mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { angleSliderContext } from "./context"
import type { AngleSliderPartProps } from "./types"

/** The handle, rotated by the angle; shows the input's focus. */
const { child, children, ...rest }: AngleSliderPartProps = $props()
const ctx = angleSliderContext.get()
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
