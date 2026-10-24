<script lang="ts">
import { type HeadingLevel, nextHeadingLevel, popoverLayerId } from "@rind-ui/core"
import { stripMarker } from "@rind-ui/core/internal"
import { untrack } from "svelte"
import { elementRef } from "../element-ref.svelte"
import { headingLevel } from "../heading/context"
import { keepStyle } from "../keep-style"
import { provideLayer } from "../layer-context"
import { mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { useEnvironment } from "../provider"
import { useModality } from "../use-modality.svelte"
import { usePresence } from "../use-presence.svelte"
import { api, isOpen, popoverHost } from "./context.svelte"
import type { PopoverContentProps } from "./types"

const {
  "aria-label": label,
  "aria-labelledby": labelledBy,
  "aria-describedby": describedBy,
  child,
  children,
  ...rest
}: PopoverContentProps = $props()
const ctx = popoverHost.get()
const env = useEnvironment()
// Headings inside the body are one level below the title; layers opened from here are this
// popover's children.
provideLayer(
  () => popoverLayerId(ctx.root()),
  () => "popover",
)
const parentLevel = headingLevel.maybe()
headingLevel.set(() =>
  nextHeadingLevel(parentLevel?.(), Math.min(6, ctx.shared.titleLevel + 1) as HeadingLevel),
)
let focusWithin = $state(false)
let contentFocused = $state(false)
const modality = useModality(env.modality, () => contentFocused)
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
    // Focus within, from the DOM itself (as the Dialog: native events plus a frame check).
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
      ctx.shared.contentMounted = false
      env.scheduler.cancelAnimationFrame(frame)
      node.removeEventListener("focusin", sync)
      node.removeEventListener("focusout", onFocusOut)
    }
  })
})
const exiting = $derived(!open && presence.state === "exiting")
// Positioning and the scroll lock write to this element's style too.
const kept = keepStyle()
const merged = $derived(
  kept(
    stripMarker(
      mergeProps(
        {
          ...normalizeProps(
            api(ctx, { focusWithin, contentFocused, modality: modality.current }).content({
              label: label ?? undefined,
              labelledBy: labelledBy ?? undefined,
              describedBy: describedBy ?? undefined,
            }),
          ),
          hidden: !open && !exiting && ctx.keepMounted(),
          ...(exiting ? { inert: true } : {}),
          ...el.props,
        },
        rest,
      ),
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
