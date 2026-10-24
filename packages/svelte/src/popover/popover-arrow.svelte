<script lang="ts">
import { stripMarker } from "@rind-ui/core/internal"
import { mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { api, popoverHost } from "./context.svelte"
import type { PopoverArrowProps } from "./types"

const { child, children, ...rest }: PopoverArrowProps = $props()
const ctx = popoverHost.get()
const merged = $derived(stripMarker(mergeProps(normalizeProps(api(ctx).arrow()), rest)))
</script>

{#if child}
  {@render child({ props: merged, state: undefined })}
{:else}
  <div {...attrs(merged)}>{@render children?.()}</div>
{/if}
