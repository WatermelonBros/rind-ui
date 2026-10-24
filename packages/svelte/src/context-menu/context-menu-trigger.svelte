<script lang="ts">
import { claimRegionEvent, contextMenuRegionProps, longPress, type MenuPoint } from "@rind-ui/core"
import { stripMarker } from "@rind-ui/core/internal"
import { untrack } from "svelte"
import { elementRef } from "../element-ref.svelte"
import { menuLevel } from "../menu/context.svelte"
import { joinHandlers, mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { useEnvironment } from "../provider"
import { useModality } from "../use-modality.svelte"
import { usePress } from "../use-press.svelte"
import { contextMenuRegion } from "./context"
import type { ContextMenuTriggerProps } from "./types"

// The region: a right click, a long press or the context-menu key on it opens the menu.
const { child, children, ...rest }: ContextMenuTriggerProps = $props()
const ctx = menuLevel.maybe()
const region = contextMenuRegion.maybe()
if (!ctx || !region) throw new Error("ContextMenu.Trigger must be inside ContextMenu.Root")
const env = useEnvironment()
// The modality tracker classifies a contextmenu with no press before it (AT, keyboard).
$effect(() => env.modality.subscribe(() => {}))
const send = ctx.service.send
let start: MenuPoint = { x: 0, y: 0 }
let target: Element | null = null
const press = usePress({
  env,
  // Read once, when the press is created.
  longPress: longPress({ threshold: untrack(() => region.longPressDelay()), moveTolerance: 10 }),
  disabled: () => region.disabled() || !region.longPress(),
  send: (e) => {
    // Touch and pen only: a held mouse button is no long press.
    if (e.type !== "LONG_PRESS" || (e.pointerType !== "touch" && e.pointerType !== "pen")) return
    send({ type: "REGION.LONG_PRESS", point: start, target })
  },
})
const uid = $props.id()
const hintId = `${uid}-hint`
const el = elementRef("div")
// The hint only for a region the consumer made focusable.
let focusable = $state(false)
$effect(() => {
  void rest.tabindex
  focusable = el.current?.hasAttribute("tabindex") === true
})
$effect(() => {
  const node = el.current
  ctx.shared.trigger = node instanceof HTMLElement ? node : null
})
let focused = $state(false)
const modality = useModality(env.modality, () => focused)
const open = $derived(ctx.view().matches("open"))
const hint = $derived(focusable && region.longPress())
const merged = $derived.by(() => {
  const own = normalizeProps(
    contextMenuRegionProps(
      {
        instance: ctx.levelId,
        open,
        disabled: region.disabled(),
        hintId: hint ? hintId : undefined,
        focused,
        modality: modality.current,
      },
      send,
      env,
    ),
  )
  // Only the press module's pointer side (and its trailing-click and callout guards): keys on
  // the region and its rows stay the consumer's.
  const p = press.props as Record<string, ((e: never) => void) | undefined>
  const pick = {
    onclick: p["onclick"],
    oncontextmenu: p["oncontextmenu"],
    ondragstart: p["ondragstart"],
    onpointerenter: p["onpointerenter"],
    onpointerleave: p["onpointerleave"],
  }
  return stripMarker(
    mergeProps(
      {
        ...joinHandlers(own, pick, {
          // The region's own focus (a focusable region), not its rows'.
          onfocusin: (e: FocusEvent) => {
            focused = e.target === e.currentTarget
          },
          onfocusout: (e: FocusEvent) => {
            if (e.target === e.currentTarget) focused = false
          },
        }),
        onpointerdown: (e: PointerEvent) => {
          // The innermost region takes a long press; an outer one never starts its timer.
          if (e.pointerType === "mouse" || !claimRegionEvent(e)) return
          start = { x: e.clientX, y: e.clientY }
          target = e.target as Element
          p["onpointerdown"]?.(e as never)
        },
        ...el.props,
      },
      rest,
    ),
  )
})
const current = $derived({ open })
</script>

{#if child}
  {@render child({ props: merged, state: current })}
{:else}
  <div {...attrs(merged)}
    >{@render children?.(current)}{#if hint}<span id={hintId} hidden
        >{region.messages().longPressHint}</span
      >{/if}</div
  >
{/if}
