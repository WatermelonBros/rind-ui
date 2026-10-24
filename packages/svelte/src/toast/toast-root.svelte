<script lang="ts">
import { measureToast, trackSwipe } from "@rind-ui/core"
import { stripMarker } from "@rind-ui/core/internal"
import { untrack } from "svelte"
import { DEV } from "../dev"
import { elementRef } from "../element-ref.svelte"
import { joinHandlers, mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { useEnvironment } from "../provider"
import { useModality } from "../use-modality.svelte"
import { usePresence } from "../use-presence.svelte"
import { toastHost } from "./context.svelte"
import type { ToastRootProps } from "./types"

const { child, children, ...rest }: ToastRootProps = $props()
const ctx = toastHost.get()
const env = useEnvironment()
const store = ctx.region.store
const toast = $derived(ctx.toast())
const service = $derived(store.service(toast.instance))
const el = elementRef("li")
let focused = $state(false)
const modality = useModality(env.modality, () => focused)
const open = $derived(toast.state !== "dismissed")
const presence = usePresence(
  () => open,
  () => el.current,
  // The exit ended: the record goes (presses during the exit keep nothing: mui/base-ui#5135).
  { onExitComplete: () => store.remove(untrack(() => toast.instance)) },
)
// Before it becomes inert for its exit, focus inside moves on (mui/base-ui#3466).
$effect.pre(() => {
  const node = el.current
  if (!open && node instanceof HTMLElement) untrack(() => ctx.region.leaving(node))
})
// Its layout height, unscaled, on mount and on every resize.
$effect(() => {
  const node = el.current
  const s = service
  if (!(node instanceof HTMLElement) || !s) return
  return untrack(() => measureToast(node, (height) => s.send({ type: "MEASURED", height })))
})
// The swipe: discrete events only; it pauses the toast while in progress.
const dismissible = $derived(toast.data.dismissible !== false)
$effect(() => {
  const s = service
  if (!s || !dismissible || !open) return
  void ctx.region.swipeDirections()
  return untrack(() => {
    const tracker = trackSwipe(env, {
      element: () => el.current as HTMLElement | null,
      directions: () => ctx.region.swipeDirections(),
      prefix: "toast",
      onStart: (e) => {
        s.send({ type: "PAUSE", reason: "swipe" })
        s.send({ type: "SWIPE.START", modality: e.modality })
        ctx.region.setSwiping(true)
      },
      onEnd: (e) => {
        s.send({ type: "SWIPE", ...e })
        s.send({ type: "RESUME", reason: "swipe" })
        ctx.region.setSwiping(false)
        if (s.getSnapshot().state !== "dismissed") tracker.reset()
      },
      onCancel: () => {
        s.send({ type: "SWIPE.CANCEL" })
        s.send({ type: "RESUME", reason: "swipe" })
        ctx.region.setSwiping(false)
      },
    })
    return () => tracker.stop()
  })
})
// Development: a persistent toast without a close trigger strands touch screen readers.
$effect(() => {
  const node = el.current
  if (!DEV || !node || toast.state !== "persistent") return
  if (!node.querySelector('[data-part="close-trigger"]')) {
    console.warn(
      `[rind-ui] toast "${toast.data.id}": a persistent toast without Toast.CloseTrigger; touch screen-reader users cannot press Escape or swipe`,
    )
  }
})
const merged = $derived.by(() => {
  const own = normalizeProps(
    ctx.region.api().root(toast, { rendered: ctx.rendered(), focused, modality: modality.current }),
  )
  return stripMarker(
    mergeProps(
      {
        ...joinHandlers(own, {
          onkeydown: service ? ctx.region.api().onRootKeyDown(service.send) : undefined,
          // The toast itself, not its buttons: data-focus(-visible) on the root.
          onfocusin: (e: FocusEvent) => {
            focused = e.target === e.currentTarget
          },
          onfocusout: () => {
            focused = false
          },
        }),
        ...el.props,
      },
      rest,
    ),
  )
})
</script>

{#if presence.mounted && service}
  {#if child}
    {@render child({ props: merged, state: toast })}
  {:else}
    <li {...attrs(merged)}>{@render children?.(toast)}</li>
  {/if}
{/if}
