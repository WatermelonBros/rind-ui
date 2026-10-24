<script lang="ts">
import { accessibleNameOf, focusEvent, tooltipIds } from "@rind-ui/core"
import { stripMarker } from "@rind-ui/core/internal"
import type { HTMLButtonAttributes } from "svelte/elements"
import { DEV } from "../dev"
import { elementRef } from "../element-ref.svelte"
import { joinHandlers, mergeProps } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { useEnvironment } from "../provider"
import { useModality } from "../use-modality.svelte"
import { api, isOpen, tooltipHost } from "./context.svelte"
import type { TooltipTriggerProps } from "./types"

const {
  "aria-describedby": describedBy,
  "aria-labelledby": labelledBy,
  child,
  children,
  ...rest
}: TooltipTriggerProps = $props()
const ctx = tooltipHost.get()
const env = useEnvironment()
// The modality tracker needs a subscriber while the trigger is mounted.
$effect(() => env.modality.subscribe(() => {}))
let focused = $state(false)
let hovered = $state(false)
const modality = useModality(env.modality, () => focused)
const el = elementRef("button")
$effect(() => {
  const node = el.current
  ctx.shared.trigger = node instanceof HTMLElement ? node : null
})
// Development warnings about the trigger and the content, once the (portalled) content mounted.
$effect(() => {
  const node = ctx.shared.trigger
  if (!DEV || !node || !ctx.shared.contentMounted) return
  const name = `tooltip #${node.id}`
  if (node.matches(":disabled")) {
    console.warn(
      `[rind-ui] ${name}: the trigger is disabled, so it cannot be focused or hovered; use focusableWhenDisabled (aria-disabled)`,
    )
  } else if (node.tabIndex < 0) {
    console.warn(`[rind-ui] ${name}: the trigger is not focusable; keyboard users never see it`)
  }
  if (ctx.type() === "label" && node.hasAttribute("aria-label")) {
    console.warn(
      `[rind-ui] ${name}: aria-label on a type="label" trigger is ignored by assistive technology (aria-labelledby wins)`,
    )
  }
  const content = node.ownerDocument.getElementById(tooltipIds(ctx.root()).content)
  if (!content) return
  // Hidden closed content still holds what it will show: any tabbable descendant.
  const tabbable = content.querySelector<HTMLElement>(
    "a[href], button, input, select, textarea, [tabindex]:not([tabindex='-1'])",
  )
  if (tabbable) {
    console.warn(
      `[rind-ui] ${name}: its content contains a tabbable element (${tabbable.tagName.toLowerCase()}); tooltips are never focused — use a Hover Card or a Popover`,
    )
  }
  if (ctx.type() === "description") {
    const text = (content.textContent ?? "").trim()
    if (text !== "" && text === accessibleNameOf(node).trim()) {
      console.warn(
        `[rind-ui] ${name}: the description repeats the trigger's name; use type="label"`,
      )
    }
  }
})
const hover = ctx.hoverIntent.triggerProps((e) => ctx.service.send(e))
const merged = $derived.by(() => {
  const a = api(ctx)
  const own = normalizeProps(
    a.trigger(
      {
        focused,
        hovered,
        modality: modality.current,
        describedBy: describedBy ?? undefined,
        labelledBy: labelledBy ?? undefined,
        // A child snippet renders the consumer's element: the trigger's id stays the tooltip's.
        foreign: false,
      },
      hover,
    ),
  )
  return stripMarker(
    mergeProps(
      {
        ...joinHandlers(own, {
          onpointermove: (e: PointerEvent) => {
            if (e.pointerType === "mouse" || e.pointerType === "pen") hovered = true
          },
          onpointerleave: () => (hovered = false),
          onpointerdown: (e: PointerEvent) =>
            a.pressStart(e.pointerType === "mouse" || e.pointerType === "pen"),
          onkeydown: (e: KeyboardEvent) => {
            if (e.key === "Enter" || e.key === " ") a.pressStart(false)
          },
          // Assistive technology activates with a bare click (no pointer or key events).
          onclick: (e: MouseEvent) => {
            if (e.detail === 0) a.pressStart(false)
          },
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
  <button {...merged as HTMLButtonAttributes}>{@render children?.(current)}</button>
{/if}
