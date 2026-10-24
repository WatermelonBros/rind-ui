<script lang="ts">
import { stripMarker } from "@rind-ui/core/internal"
import { mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { imageContext } from "./context"
import type { ImageFallbackProps } from "./types"

const { child, children, ...rest }: ImageFallbackProps = $props()
const ctx = imageContext.get()
const merged = $derived(stripMarker(mergeProps(normalizeProps(ctx.api().fallback()), rest)))
const current = $derived(ctx.state())
</script>

{#if ctx.fallback()}
  {#if child}
    {@render child({ props: merged, state: current })}
  {:else}
    <span {...attrs(merged)}>{@render children?.(current)}</span>
  {/if}
{/if}
