<script lang="ts">
import { stripMarker } from "@rind-ui/core/internal"
import { mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { scrollAreaContext } from "./context"
import type { ScrollAreaPartProps } from "./types"

/** Your content, measured; the only element between the Viewport and your children. */
const { child, children, ...rest }: ScrollAreaPartProps = $props()
const ctx = scrollAreaContext.get()
const merged = $derived(stripMarker(mergeProps(normalizeProps(ctx.connect().content()), rest)))
const current = $derived({ state: ctx.input().state })
</script>

{#if child}
  {@render child({ props: merged, state: current })}
{:else}
  <div {...attrs(merged)}>{@render children?.(current)}</div>
{/if}
