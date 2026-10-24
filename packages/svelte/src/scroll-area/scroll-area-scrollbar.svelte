<script lang="ts">
import { stripMarker } from "@rind-ui/core/internal"
import { untrack } from "svelte"
import { mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { scrollAreaContext, scrollbarOrientation } from "./context"
import type { ScrollAreaScrollbarProps } from "./types"

const { orientation = "vertical", child, children, ...rest }: ScrollAreaScrollbarProps = $props()
const ctx = scrollAreaContext.get()
$effect(() => {
  const o = orientation
  return untrack(() => ctx.register(o))
})
scrollbarOrientation.set(() => orientation)
const merged = $derived(
  stripMarker(mergeProps(normalizeProps(ctx.connect().scrollbar(ctx.send, orientation)), rest)),
)
const current = $derived({ state: ctx.input().state })
</script>

{#if child}
  {@render child({ props: merged, state: current })}
{:else}
  <div {...attrs(merged)}>{@render children?.(current)}</div>
{/if}
