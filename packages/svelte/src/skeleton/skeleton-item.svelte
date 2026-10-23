<script lang="ts">
import { stripMarker } from "@rind-ui/core/internal"
import { mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { skeletonContext } from "./context"
import type { SkeletonItemProps } from "./types"

const { loading, animate, child, children, ...rest }: SkeletonItemProps = $props()
const ctx = skeletonContext.get()
// Stale content when there are children; none: a placeholder.
const own = $derived(ctx.connect().item({ loading, animate, hasChildren: children !== undefined }))
const merged = $derived(stripMarker(mergeProps(normalizeProps(own), rest)))
const current = $derived({ loading: own["data-state"] === "loading" })
</script>

{#if child}
  {@render child({ props: merged, state: current })}
{:else}
  <span {...attrs(merged)}>{@render children?.(current)}</span>
{/if}
