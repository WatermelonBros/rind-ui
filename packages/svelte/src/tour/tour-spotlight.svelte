<script lang="ts">
import type { TourContext } from "@rind-ui/core"
import { stripMarker } from "@rind-ui/core/internal"
import { elementRef } from "../element-ref.svelte"
import { keepStyle } from "../keep-style"
import { mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { usePresence } from "../use-presence.svelte"
import { tourApi, tourHost } from "./context.svelte"
import type { TourSpotlightProps } from "./types"

const { child, children, ...rest }: TourSpotlightProps = $props()
const ctx = tourHost.get()
const el = elementRef("div")
const t = $derived(tourApi(ctx))
const presence = usePresence(
  () => t.state === "active" && !t.api.centered,
  () => el.current,
)
const changing = $derived((ctx.tour.view.context as TourContext).stepChanging)
// The step change ends with the spotlight's own transition, or with the first scroll or resize
// once nothing animates any more (the step's own scrollIntoView does not end it).
$effect(() => {
  const node = el.current as HTMLElement | null
  if (!changing || !presence.mounted || !node) return
  const settle = () => ctx.tour.service.send({ type: "SPOTLIGHT.SETTLED" })
  const view = node.ownerDocument.defaultView
  const onTransition = (e: Event) => {
    if (e.target === node) settle()
  }
  const onMove = () => {
    if (!node.getAnimations?.().length) settle()
  }
  node.addEventListener("transitionend", onTransition)
  node.addEventListener("transitioncancel", onTransition)
  view?.addEventListener("scroll", onMove, { capture: true, passive: true })
  view?.addEventListener("resize", onMove)
  return () => {
    node.removeEventListener("transitionend", onTransition)
    node.removeEventListener("transitioncancel", onTransition)
    view?.removeEventListener("scroll", onMove, { capture: true })
    view?.removeEventListener("resize", onMove)
  }
})
// Positioning writes to this element's style too.
const kept = keepStyle()
const merged = $derived(
  kept(stripMarker(mergeProps({ ...normalizeProps(t.api.spotlight()), ...el.props }, rest))),
)
</script>

{#if presence.mounted}
  {#if child}
    {@render child({ props: merged, state: undefined })}
  {:else}
    <div {...attrs(merged)}>{@render children?.()}</div>
  {/if}
{/if}
