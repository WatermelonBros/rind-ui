<script lang="ts">
import { stripMarker } from "@rind-ui/core/internal"
import { mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { scrollAreaContext, scrollbarOrientation } from "./context"
import type { ScrollAreaPartProps } from "./types"

const { child, children, ...rest }: ScrollAreaPartProps = $props()
const ctx = scrollAreaContext.get()
const orientation = scrollbarOrientation.maybe() ?? (() => "vertical" as const)
const merged = $derived(
  stripMarker(mergeProps(normalizeProps(ctx.connect().thumb(orientation())), rest)),
)
const current = $derived({ state: ctx.input().state })
</script>

{#if child}
  {@render child({ props: merged, state: current })}
{:else}
  <div {...attrs(merged)}>{@render children?.(current)}</div>
{/if}
