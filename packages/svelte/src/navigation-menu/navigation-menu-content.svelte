<script lang="ts">
import { navigationMenuLayerId } from "@rind-ui/core"
import { stripMarker } from "@rind-ui/core/internal"
import { untrack } from "svelte"
import { createAttachmentKey } from "svelte/attachments"
import { elementRef } from "../element-ref.svelte"
import { provideLayer } from "../layer-context"
import { mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { usePresence } from "../use-presence.svelte"
import { navItem, navLevel, navPanel, useSizeSequence } from "./context.svelte"
import type { NavigationMenuContentProps } from "./types"

// The item's panel: in place, or inside the level's Viewport when one is rendered.
const { child, children, ...rest }: NavigationMenuContentProps = $props()
const ctx = navLevel.get()
const item = navItem.get()
const open = $derived(ctx.value() === item.key)
const el = elementRef("div")
const presence = usePresence(
  () => open,
  () => el.current,
)
const inViewport = $derived(ctx.shared.viewport !== null)
// In a shared viewport the outgoing panel goes at once: the viewport animates the switch.
const switchedAway = $derived(inViewport && ctx.value() !== null && !open)
const exiting = $derived(!open && !switchedAway && presence.state === "exiting")
const mounted = $derived(ctx.closedContent() === "hidden" || open || exiting)
$effect(() => {
  const m = mounted
  untrack(() => {
    item.shared.contentMounted = m
  })
  return () => {
    item.shared.contentMounted = false
  }
})
useSizeSequence(
  () => el.current,
  () => (open ? item.key : null),
  "content",
  () => !inViewport,
)
// Layers opened from a panel (a nested level, a dialog) are this level's children.
provideLayer(
  () => navigationMenuLayerId(ctx.root()),
  () => "popover",
)
navPanel.set({ item: item.key, level: ctx, parent: navPanel.maybe() ?? null })
// Inside a Viewport, the panel's element moves into it (a portal without a host element: the
// element is the block's only node, so Svelte removes it wherever it is).
const into = createAttachmentKey()
const merged = $derived(
  stripMarker(
    mergeProps(
      {
        ...normalizeProps(ctx.api().content(item.key)),
        hidden: !open && !exiting ? true : undefined,
        ...(exiting ? { inert: true } : {}),
        ...el.props,
        [into]: (node: Element) => {
          const viewport = ctx.shared.viewport
          if (!viewport || node.parentNode === viewport) return
          viewport.appendChild(node)
          // The Viewport sizes the panel there: the in-place size properties go (React mounts a
          // new element in the viewport, which never had them).
          if (node instanceof HTMLElement) {
            node.style.removeProperty("--rind-navigation-menu-content-height")
            node.style.removeProperty("--rind-navigation-menu-content-width")
          }
        },
      },
      rest,
    ),
  ),
)
const current = $derived({ open })
</script>

{#if mounted}
  {#if child}
    {@render child({ props: merged, state: current })}
  {:else}
    <div {...attrs(merged)}>{@render children?.(current)}</div>
  {/if}
{/if}
