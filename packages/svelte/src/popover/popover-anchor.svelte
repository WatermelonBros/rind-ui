<script lang="ts">
import { stripMarker } from "@rind-ui/core/internal"
import { mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { api, popoverHost } from "./context.svelte"
import type { PopoverAnchorProps } from "./types"

// Optional: positions the content against this element instead of the trigger.
const { child, children, ...rest }: PopoverAnchorProps = $props()
const ctx = popoverHost.get()
$effect(() => {
  ctx.shared.anchorRendered = true
  return () => (ctx.shared.anchorRendered = false)
})
const merged = $derived(stripMarker(mergeProps(normalizeProps(api(ctx).anchor()), rest)))
</script>

{#if child}
  {@render child({ props: merged, state: undefined })}
{:else}
  <div {...attrs(merged)}>{@render children?.()}</div>
{/if}
