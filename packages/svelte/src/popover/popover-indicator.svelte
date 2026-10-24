<script lang="ts">
import { stripMarker } from "@rind-ui/core/internal"
import { mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { api, popoverHost } from "./context.svelte"
import type { PopoverIndicatorProps } from "./types"

const { child, children, ...rest }: PopoverIndicatorProps = $props()
const ctx = popoverHost.get()
const merged = $derived(stripMarker(mergeProps(normalizeProps(api(ctx).indicator()), rest)))
</script>

{#if child}
  {@render child({ props: merged, state: undefined })}
{:else}
  <span {...attrs(merged)}>{@render children?.()}</span>
{/if}
