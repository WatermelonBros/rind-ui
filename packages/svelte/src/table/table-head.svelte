<script lang="ts">
import { stripMarker } from "@rind-ui/core/internal"
import { mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { tableHost } from "./context.svelte"
import type { TableSectionProps } from "./types"

const { child, children, ...rest }: TableSectionProps = $props()
const ctx = tableHost.get()
const merged = $derived(stripMarker(mergeProps(normalizeProps(ctx.api().head()), rest)))
</script>

{#if child}
  {@render child({ props: merged, state: ctx.state() })}
{:else}
  <thead {...attrs(merged)}>{@render children?.(ctx.state())}</thead>
{/if}
