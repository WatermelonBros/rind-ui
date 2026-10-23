<script lang="ts">
import { stripMarker } from "@rind-ui/core/internal"
import { DEV } from "../dev"
import { mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { marqueeContext } from "./context"
import Copy from "./marquee-copy.svelte"
import type { MarqueePartProps } from "./types"

const { child, children, ...rest }: MarqueePartProps = $props()
const ctx = marqueeContext.get()
const warnIds = (node: Element) => {
  if (DEV && node.querySelector("[id]"))
    console.warn("[rind-ui] marquee: an element with an id is in the Content; copies repeat it")
}
const merged = $derived(stripMarker(mergeProps(normalizeProps(ctx.api().content(0)), rest)))
// The consumer's id stays on the original only.
const shared = $derived.by(() => {
  const { id: _id, ...others } = rest
  return others
})
</script>

{#if child}
  {@render child({ props: merged, state: ctx.state() })}
{:else}
  <div {...attrs(merged)} {@attach warnIds}>{@render children?.(ctx.state())}</div>
{/if}
{#each Array.from({ length: ctx.copies() - 1 }, (_, i) => i + 1) as index (index)}
  <Copy {...shared} {index} {child} {children} />
{/each}
