<script lang="ts">
import { stripMarker } from "@rind-ui/core/internal"
import { mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { scrollAreaContext } from "./context"
import type { ScrollAreaPartProps } from "./types"

/** Rendered only when both Scrollbars are. */
const { child, children, ...rest }: ScrollAreaPartProps = $props()
const ctx = scrollAreaContext.get()
const shown = $derived(ctx.bars().has("vertical") && ctx.bars().has("horizontal"))
const merged = $derived(stripMarker(mergeProps(normalizeProps(ctx.connect().corner()), rest)))
const current = $derived({ state: ctx.input().state })
</script>

{#if shown}
  {#if child}
    {@render child({ props: merged, state: current })}
  {:else}
    <div {...attrs(merged)}>{@render children?.(current)}</div>
  {/if}
{/if}
