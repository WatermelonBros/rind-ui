<script lang="ts">
import { type HeadingLevel, nextHeadingLevel, tourLayerId } from "@rind-ui/core"
import { stripMarker } from "@rind-ui/core/internal"
import { untrack } from "svelte"
import { elementRef } from "../element-ref.svelte"
import { headingLevel } from "../heading/context"
import { provideLayer } from "../layer-context"
import { mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { useEnvironment } from "../provider"
import { useModality } from "../use-modality.svelte"
import { usePresence } from "../use-presence.svelte"
import { tourApi, tourHost } from "./context.svelte"
import type { TourContentProps } from "./types"

const {
  "aria-label": label,
  "aria-labelledby": labelledBy,
  "aria-describedby": describedBy,
  child,
  children,
  ...rest
}: TourContentProps = $props()
const ctx = tourHost.get()
const env = useEnvironment()
// Headings inside the card are one level below the title; layers opened from here are the
// tour's children.
provideLayer(
  () => tourLayerId(ctx.tour.root),
  () => "tour",
)
const parentLevel = headingLevel.maybe()
headingLevel.set(() =>
  nextHeadingLevel(parentLevel?.(), Math.min(6, ctx.shared.titleLevel + 1) as HeadingLevel),
)
let focusWithin = $state(false)
let contentFocused = $state(false)
const modality = useModality(env.modality, () => contentFocused)
const shown = $derived(ctx.tour.view.state === "active")
const el = elementRef("div")
const presence = usePresence(
  () => shown,
  () => el.current,
)
$effect(() => {
  if (!presence.mounted) return
  untrack(() => {
    ctx.shared.contentMounted = true
  })
  return () => {
    ctx.shared.contentMounted = false
  }
})
// Focus within, from the DOM itself (native events plus a frame check).
$effect(() => {
  const node = el.current as HTMLElement | null
  if (!presence.mounted || !node) return
  return untrack(() => {
    const sync = () => {
      const active = node.ownerDocument.activeElement
      focusWithin = active !== null && node.contains(active)
      contentFocused = active === node
    }
    const onFocusOut = (e: FocusEvent) => {
      const next = e.relatedTarget as Node | null
      if (next && node.contains(next)) return
      focusWithin = false
      contentFocused = false
    }
    sync()
    const frame = env.scheduler.requestAnimationFrame(sync)
    node.addEventListener("focusin", sync)
    node.addEventListener("focusout", onFocusOut)
    return () => {
      env.scheduler.cancelAnimationFrame(frame)
      node.removeEventListener("focusin", sync)
      node.removeEventListener("focusout", onFocusOut)
    }
  })
})
const t = $derived(tourApi(ctx, { focusWithin, contentFocused, modality: modality.current }))
const exiting = $derived(!shown && presence.state === "exiting")
const merged = $derived(
  stripMarker(
    mergeProps(
      {
        ...normalizeProps(
          t.api.content({
            label: label ?? undefined,
            labelledBy: labelledBy ?? undefined,
            describedBy: describedBy ?? undefined,
          }),
        ),
        // Once closing, the card is inert.
        ...(exiting ? { inert: true } : {}),
        ...el.props,
      },
      rest,
    ),
  ),
)
const current = $derived({ open: shown, stepId: t.step?.id ?? null })
</script>

{#if presence.mounted}
  {#if child}
    {@render child({ props: merged, state: current })}
  {:else}
    <div {...attrs(merged)}>{@render children?.(current)}</div>
  {/if}
{/if}
