<script lang="ts">
import { stripMarker } from "@rind-ui/core/internal"
import { mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { tocContext } from "./context"
import type { TableOfContentsIndicatorProps } from "./types"

const { child, children, ...rest }: TableOfContentsIndicatorProps = $props()
const ctx = tocContext.get()
const merged = $derived(stripMarker(mergeProps(normalizeProps(ctx.api().indicator()), rest)))
</script>

{#if child}
  {@render child({ props: merged, state: ctx.state() })}
{:else}
  <span {...attrs(merged)}>{@render children?.(ctx.state())}</span>
{/if}
