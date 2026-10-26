<script lang="ts">
// The region of one store: rendered only while it shows toasts (zag#2988).
import {
  announcerCapability,
  type SwipeDirection,
  type ToastMessages,
  type ToastSnapshot,
  toasterConnect,
  toasterMachine,
  toastMessages,
  trackToastRegion,
  visibilityCapability,
} from "@rind-ui/core"
import { untrack } from "svelte"
import { elementRef } from "../element-ref.svelte"
import { joinHandlers } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import Portal from "../portal/portal.svelte"
import { useEnvironment, useLocale } from "../provider"
import { useMachine } from "../use-machine.svelte"
import { regionHost } from "./context.svelte"
import ToastSlot from "./toast-slot.svelte"
import type { ToasterProps } from "./types"

const { toaster, id, children, messages: own, portal = true }: ToasterProps = $props()
const env = useEnvironment(announcerCapability, visibilityCapability)
const uid = $props.id()
const instance = $derived(id ?? uid)
const locale = useLocale(() => undefined)
const messages = $derived<ToastMessages>({ ...toastMessages, ...own })
let toasts = $state.raw<readonly ToastSnapshot[]>(untrack(() => toaster.toasts()))
const machine = useMachine(toasterMachine, () => ({
  expand: toaster.options.expand,
  onReason: (reason, on) => toaster.regionReason(reason, on),
  visible: toasts.length > 0,
}))
// Bound to this environment while mounted; the announcer's regions created eagerly. The region
// renders after mount only: the server and the first client render show no toast (no
// hydration mismatch, no region before the store is bound).
let mounted = $state(false)
$effect(() => {
  const store = toaster
  return untrack(() => {
    mounted = true
    toasts = store.toasts()
    const off = store.subscribe(() => {
      toasts = store.toasts()
    })
    const stopPrepare = env.announcer.prepare()
    const detach = store.attach(env, { messages })
    return () => {
      off()
      detach()
      stopPrepare()
    }
  })
})
const region = elementRef("section")
let tracker: ReturnType<typeof trackToastRegion> | null = null
const visible = $derived(toasts.length > 0 && region.current !== null)
$effect(() => {
  if (!visible) return
  return untrack(() => {
    const t = trackToastRegion(env, {
      region: () => region.current as HTMLElement | null,
      toasts: () =>
        Array.from(
          region.current?.querySelectorAll<HTMLElement>('[data-scope="toast"][data-part="root"]') ??
            [],
        ),
      hotkey: toaster.options.hotkey,
      onEnter: () => machine.send({ type: "HOTKEY" }),
    })
    tracker = t
    return () => {
      t.stop()
      tracker = null
    }
  })
})
/** The default swipe: the placement's edge and the inline end. */
const defaultDirections = (placement: string, dir: "ltr" | "rtl"): SwipeDirection[] => {
  const edge: SwipeDirection = placement.startsWith("top") ? "up" : "down"
  return [edge, dir === "rtl" ? "left" : "right"]
}
// Stable across updates: the toasts' swipe effects depend on them (a re-run mid-drag would
// stop the gesture).
let stable: readonly SwipeDirection[] = []
const swipeDirections = $derived.by(() => {
  const next =
    toaster.options.swipeDirections ??
    defaultDirections(toaster.options.placement, locale.current.dir)
  if (next.join(",") !== stable.join(",")) stable = next
  return stable
})
const api = $derived(
  toasterConnect({
    instance,
    placement: toaster.options.placement,
    toasts,
    expanded: machine.view.matches("expanded") || toaster.options.expand,
    paused: machine.view.context.hovered || machine.view.context.focused,
    gap: toaster.options.gap,
    hotkey: toaster.options.hotkey,
    messages,
  }),
)
regionHost.set({
  store: untrack(() => toaster),
  api: () => api,
  swipeDirections: () => swipeDirections,
  setSwiping: (active) => machine.send({ type: "SWIPING", active }),
  leaving: (el) => tracker?.leaving(el),
})
const modalityOf = () => env.modality.modality()
const regionProps = $derived({
  ...joinHandlers(normalizeProps(api.region()), {
    // Mouse and pen hover pause and expand; a touch never hovers.
    onpointerenter: (e: PointerEvent) => {
      if (e.pointerType !== "touch") machine.send({ type: "HOVER.START", modality: "pointer" })
    },
    onpointerleave: (e: PointerEvent) => {
      if (e.pointerType !== "touch") machine.send({ type: "HOVER.END", modality: "pointer" })
    },
    onfocusin: (e: FocusEvent) => {
      const el = e.currentTarget as Element
      if (!el.contains(e.relatedTarget as Node | null)) {
        machine.send({ type: "FOCUS.ENTER", modality: modalityOf() })
      }
    },
    onfocusout: (e: FocusEvent) => {
      const el = e.currentTarget as Element
      if (!el.contains(e.relatedTarget as Node | null)) {
        machine.send({ type: "FOCUS.LEAVE", modality: modalityOf() })
      }
    },
  }),
  ...region.props,
  dir: locale.current.dir,
  lang: locale.current.locale,
})
</script>

{#snippet body()}
  <section {...attrs(regionProps)}>
    <ol {...attrs(normalizeProps(api.list()))}>
      {#each toasts as t (t.instance)}
        <ToastSlot toast={t} {children} />
      {/each}
    </ol>
  </section>
{/snippet}

{#if api.visible && mounted}
  {#if portal}
    <Portal>{@render body()}</Portal>
  {:else}
    {@render body()}
  {/if}
{/if}
