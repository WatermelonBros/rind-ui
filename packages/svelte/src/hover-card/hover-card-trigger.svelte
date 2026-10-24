<script lang="ts">
import { focusEvent } from "@rind-ui/core"
import { stripMarker } from "@rind-ui/core/internal"
import type { HTMLAnchorAttributes } from "svelte/elements"
import { DEV } from "../dev"
import { elementRef } from "../element-ref.svelte"
import { joinHandlers, mergeProps } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { useEnvironment } from "../provider"
import { useModality } from "../use-modality.svelte"
import { api, hoverCardHost, isOpen } from "./context"
import type { HoverCardTriggerProps } from "./types"

// The link that previews: it keeps its role and href.
const { child, children, ...rest }: HoverCardTriggerProps = $props()
const ctx = hoverCardHost.get()
const env = useEnvironment()
// The modality tracker needs a subscriber while the trigger is mounted.
$effect(() => env.modality.subscribe(() => {}))
let focused = $state(false)
let hovered = $state(false)
const modality = useModality(env.modality, () => focused)
const el = elementRef("a")
$effect(() => {
  const node = el.current
  ctx.shared.trigger = node instanceof HTMLElement ? node : null
})
// Development: a hover card is a link's preview; a button wants a Popover.
$effect(() => {
  const node = el.current
  if (!DEV || !node || node.hasAttribute("href")) return
  console.warn(
    `[rind-ui] hover-card #${node.id}: the trigger is not a link (no href); a hover card is a link's preview — use a Popover for a button`,
  )
})
const hover = ctx.hoverIntent.triggerProps((e) => ctx.service.send(e))
const merged = $derived.by(() => {
  const a = api(ctx)
  const own = normalizeProps(a.trigger({ focused, hovered, modality: modality.current }, hover))
  return stripMarker(
    mergeProps(
      {
        ...joinHandlers(own, {
          onpointermove: (e: PointerEvent) => {
            if (e.pointerType === "mouse" || e.pointerType === "pen") hovered = true
          },
          onpointerleave: () => (hovered = false),
          onfocus: (e: FocusEvent) => {
            focused = true
            const f = focusEvent(e.currentTarget as Element, env.modality)
            a.focus(f.modality, f.cause)
          },
          onblur: () => {
            focused = false
            a.blur()
          },
        }),
        ...el.props,
      },
      rest,
    ),
  )
})
const current = $derived({ open: isOpen(ctx) })
</script>

{#if child}
  {@render child({ props: merged, state: current })}
{:else}
  <a {...merged as HTMLAnchorAttributes}>{@render children?.(current)}</a>
{/if}
