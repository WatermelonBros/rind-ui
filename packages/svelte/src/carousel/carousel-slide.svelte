<script lang="ts">
import { stripMarker } from "@rind-ui/core/internal"
import { elementRef } from "../element-ref.svelte"
import { mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { carouselContext } from "./context"
import type { CarouselSlideProps } from "./types"

/** A group named "2 of 6"; off the current page it is inert. */
const { index, child, children, ...rest }: CarouselSlideProps = $props()
const ctx = carouselContext.get()
const el = elementRef("div")
$effect(() => {
  const node = el.current
  if (!node) return
  return ctx.registry.register({ key: String(index), textValue: String(index), element: node })
})
const merged = $derived(
  stripMarker(mergeProps(normalizeProps(ctx.api().slide(index)), { ...el.props, ...rest })),
)
</script>

{#if child}
  {@render child({ props: merged, state: ctx.state() })}
{:else}
  <div {...attrs(merged)}>{@render children?.(ctx.state())}</div>
{/if}
