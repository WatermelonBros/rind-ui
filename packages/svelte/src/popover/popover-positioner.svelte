<script lang="ts">
import { stripMarker } from "@rind-ui/core/internal"
import { elementRef } from "../element-ref.svelte"
import { keepStyle } from "../keep-style"
import { mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { usePresence } from "../use-presence.svelte"
import { api, isOpen, popoverHost, useAnchorDir } from "./context.svelte"
import type { PopoverPositionerProps } from "./types"

const { child, children, ...rest }: PopoverPositionerProps = $props()
const ctx = popoverHost.get()
const dir = useAnchorDir(ctx)
const el = elementRef("div")
const open = $derived(isOpen(ctx))
// It holds the content: it stays while the content's exit animations run.
const presence = usePresence(
  () => open,
  () => el.current,
  { keepMounted: ctx.keepMounted, subtree: () => true },
)
// Positioning and the scroll lock write to this element's style too.
const kept = keepStyle()
const merged = $derived(
  kept(
    stripMarker(
      mergeProps(
        {
          ...normalizeProps(api(ctx, dir.current ? { dir: dir.current } : {}).positioner()),
          hidden: !open && ctx.keepMounted(),
          ...el.props,
        },
        rest,
      ),
    ),
  ),
)
</script>

{#if presence.mounted}
  {#if child}
    {@render child({ props: merged, state: undefined })}
  {:else}
    <div {...attrs(merged)}>{@render children?.()}</div>
  {/if}
{/if}
