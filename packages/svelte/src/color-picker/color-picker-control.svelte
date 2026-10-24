<script lang="ts">
import { stripMarker } from "@rind-ui/core/internal"
import { mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import PopoverAnchor from "../popover/popover-anchor.svelte"
import { colorPicker } from "./context"
import type { ColorPickerDivProps } from "./types"

// `role="group"`: the Popover's anchor.
const { child, children, ...rest }: ColorPickerDivProps = $props()
const ctx = colorPicker.get()
const merged = $derived(stripMarker(mergeProps(normalizeProps(ctx.api().control()), rest)))
// The Popover finds its anchor by the anchor's own id: an `id` here would replace it.
const anchor = $derived.by(() => {
  const { id: _anchorOwnsTheId, ...a } = merged as Record<string, unknown>
  return a
})
</script>

{#snippet content()}{@render children?.(ctx.state())}{/snippet}

{#if ctx.inline}
  {#if child}
    {@render child({ props: merged, state: ctx.state() })}
  {:else}
    <div {...attrs(merged)}>{@render content()}</div>
  {/if}
{:else}
  <PopoverAnchor {...anchor}>{@render content()}</PopoverAnchor>
{/if}
