<script lang="ts">
import { stripMarker } from "@rind-ui/core/internal"
import { untrack } from "svelte"
import { DEV } from "../dev"
import { elementRef } from "../element-ref.svelte"
import { keepStyle } from "../keep-style"
import { mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { usePresence } from "../use-presence.svelte"
import { popupHost } from "./context"
import type { ComboboxPositionerProps } from "./types"

const { child, children, ...rest }: ComboboxPositionerProps = $props()
const host = popupHost.get()
// Inline: popup parts render nothing (combobox "Anatomy").
$effect(() => {
  if (host.inline && DEV)
    console.warn(`[rind-ui] ${host.name}: an inline combobox renders no Positioner.`)
})
const el = elementRef("div")
// It holds the popup: it stays while the popup's exit animations run.
const presence = usePresence(
  () => host.open(),
  () => el.current,
  { keepMounted: host.keepMounted, subtree: () => true },
)
$effect(() => {
  const m = presence.mounted
  untrack(() => host.setPresent(m))
})
// Into the top layer while mounted (`popover="manual"`): above every stacking context of the
// page, with no portal. Engines without the Popover API keep it in place.
$effect(() => {
  const node = el.current as (HTMLElement & { showPopover?: () => void }) | null
  if (!presence.mounted || !host.topLayer() || !node || typeof node.showPopover !== "function")
    return
  untrack(() => {
    try {
      if (!node.matches(":popover-open")) node.showPopover()
    } catch {
      // Already shown, or not connected yet: the next update retries.
    }
  })
  return () => {
    try {
      if (node.matches(":popover-open")) node.hidePopover()
    } catch {
      // Removed with its subtree.
    }
  }
})
// Positioning writes to this element's style too.
const kept = keepStyle()
const merged = $derived.by(() => {
  const own = normalizeProps(host.api().positioner())
  return kept(
    stripMarker(
      mergeProps(
        {
          ...own,
          hidden: own["hidden"] === true || (!host.open() && host.keepMounted()) || undefined,
          ...el.props,
        },
        rest,
      ),
    ),
  )
})
</script>

{#if presence.mounted && !host.inline}
  {#if child}
    {@render child({ props: merged, state: undefined })}
  {:else}
    <div {...attrs(merged)}>{@render children?.()}</div>
  {/if}
{/if}
