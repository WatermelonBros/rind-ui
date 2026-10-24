<script lang="ts">
import { stripMarker } from "@rind-ui/core/internal"
import { mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { navLevel } from "./context.svelte"
import type { NavigationMenuListProps } from "./types"

// The level's items.
const { child, children, ...rest }: NavigationMenuListProps = $props()
const ctx = navLevel.get()
const merged = $derived(stripMarker(mergeProps(normalizeProps(ctx.api().list()), rest)))
</script>

{#if child}
  {@render child({ props: merged, state: undefined })}
{:else}
  <ul {...attrs(merged)}>{@render children?.()}</ul>
{/if}
