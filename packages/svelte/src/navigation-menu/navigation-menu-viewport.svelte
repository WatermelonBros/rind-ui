<script lang="ts">
import { stripMarker } from "@rind-ui/core/internal"
import { untrack } from "svelte"
import { elementRef } from "../element-ref.svelte"
import { mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { usePresence } from "../use-presence.svelte"
import { navLevel, useSizeSequence } from "./context.svelte"
import type { NavigationMenuViewportProps } from "./types"

// The shared panel the open content renders into, sized by the size properties.
const { child, children, ...rest }: NavigationMenuViewportProps = $props()
const ctx = navLevel.get()
const el = elementRef("div")
const open = $derived(ctx.value() !== null)
const presence = usePresence(
  () => open,
  () => el.current,
  { subtree: () => true },
)
const exiting = $derived(!open && presence.state === "exiting")
$effect(() => {
  const node = el.current
  untrack(() => {
    ctx.shared.viewport = node instanceof HTMLElement ? node : null
  })
  return () => {
    ctx.shared.viewport = null
  }
})
useSizeSequence(
  () => el.current,
  ctx.value,
  "viewport",
  () => true,
)
const merged = $derived(
  stripMarker(
    mergeProps(
      {
        ...normalizeProps(ctx.api().viewport()),
        hidden: !open && !exiting ? true : undefined,
        ...el.props,
      },
      rest,
    ),
  ),
)
</script>

{#if child}
  {@render child({ props: merged, state: undefined })}
{:else}
  <div {...attrs(merged)}>{@render children?.()}</div>
{/if}
