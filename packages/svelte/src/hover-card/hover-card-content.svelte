<script lang="ts">
import { hoverCardLayerId } from "@rind-ui/core"
import { stripMarker } from "@rind-ui/core/internal"
import { untrack } from "svelte"
import { elementRef } from "../element-ref.svelte"
import { provideLayer } from "../layer-context"
import { mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { useEnvironment } from "../provider"
import { usePresence } from "../use-presence.svelte"
import { api, hoverCardHost, isOpen } from "./context"
import type { HoverCardContentProps } from "./types"

const {
  "aria-label": label,
  "aria-labelledby": labelledBy,
  child,
  children,
  ...rest
}: HoverCardContentProps = $props()
const ctx = hoverCardHost.get()
const env = useEnvironment()
// Layers opened from here (a select, a nested card) are this card's children.
provideLayer(
  () => hoverCardLayerId(ctx.root()),
  () => "popover",
)
let focusWithin = $state(false)
const el = elementRef("div")
const open = $derived(isOpen(ctx))
const presence = usePresence(
  () => open,
  () => el.current,
  { keepMounted: ctx.keepMounted },
)
$effect(() => {
  const node = presence.mounted ? el.current : null
  return untrack(() => {
    ctx.shared.contentMounted = node !== null
    if (!(node instanceof HTMLElement)) return
    // Focus within, from the DOM (native events plus a frame check), reported to the machine.
    let inside = false
    const report = (now: boolean) => {
      if (now === inside) return
      inside = now
      focusWithin = now
      ctx.service.send({ type: now ? "FOCUS_WITHIN.ENTER" : "FOCUS_WITHIN.LEAVE" })
    }
    const sync = () => {
      const active = node.ownerDocument.activeElement
      report(active !== null && node.contains(active))
    }
    const onFocusOut = (e: FocusEvent) => {
      const next = e.relatedTarget as Node | null
      if (next && node.contains(next)) return
      report(false)
    }
    sync()
    const frame = env.scheduler.requestAnimationFrame(sync)
    node.addEventListener("focusin", sync)
    node.addEventListener("focusout", onFocusOut)
    return () => {
      ctx.shared.contentMounted = false
      env.scheduler.cancelAnimationFrame(frame)
      node.removeEventListener("focusin", sync)
      node.removeEventListener("focusout", onFocusOut)
    }
  })
})
const exiting = $derived(!open && presence.state === "exiting")
const merged = $derived(
  stripMarker(
    mergeProps(
      {
        ...normalizeProps(
          api(ctx, { focusWithin }).content({
            label: label ?? undefined,
            labelledBy: labelledBy ?? undefined,
          }),
        ),
        hidden: !open && !exiting && ctx.keepMounted(),
        ...(exiting ? { inert: true } : {}),
        ...el.props,
      },
      rest,
    ),
  ),
)
const current = $derived({ open })
</script>

{#if presence.mounted}
  {#if child}
    {@render child({ props: merged, state: current })}
  {:else}
    <div {...attrs(merged)}>{@render children?.(current)}</div>
  {/if}
{/if}
