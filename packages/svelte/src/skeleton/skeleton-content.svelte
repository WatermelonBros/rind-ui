<script lang="ts">
import { stripMarker } from "@rind-ui/core/internal"
import { mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { skeletonContext } from "./context"
import type { SkeletonContentProps } from "./types"

const { child, children, ...rest }: SkeletonContentProps = $props()
const ctx = skeletonContext.get()
const merged = $derived(stripMarker(mergeProps(normalizeProps(ctx.connect().content()), rest)))
const current = $derived({ loading: ctx.loading() })
</script>

{#if child}
  {@render child({ props: merged, state: current })}
{:else}
  <div {...attrs(merged)}>{@render children?.(current)}</div>
{/if}
