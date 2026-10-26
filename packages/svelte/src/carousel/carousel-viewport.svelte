<script lang="ts">
import { stripMarker } from "@rind-ui/core/internal"
import { elementRef } from "../element-ref.svelte"
import { joinHandlers, mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { carouselContext } from "./context"
import type { CarouselPartProps } from "./types"

/** The scroll-snap container; scrolling natively settles the page. */
const { child, children, ...rest }: CarouselPartProps = $props()
const ctx = carouselContext.get()
const el = elementRef("div")
$effect(() => {
  const node = el.current
  ctx.viewport.current = node instanceof HTMLElement ? node : null
})
const merged = $derived(
  stripMarker(
    mergeProps(joinHandlers(normalizeProps(ctx.api().viewport()), { onscroll: ctx.onScroll }), {
      ...el.props,
      ...rest,
    }),
  ),
)
</script>

{#if child}
  {@render child({ props: merged, state: ctx.state() })}
{:else}
  <div {...attrs(merged)}>{@render children?.(ctx.state())}</div>
{/if}
