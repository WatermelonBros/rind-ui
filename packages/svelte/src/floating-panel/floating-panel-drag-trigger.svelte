<script lang="ts">
import { describeKey, floatingPanelKeyEvent } from "@rind-ui/core"
import { stripMarker } from "@rind-ui/core/internal"
import type { HTMLButtonAttributes } from "svelte/elements"
import { elementRef } from "../element-ref.svelte"
import { joinHandlers, mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { useEnvironment } from "../provider"
import { useModality } from "../use-modality.svelte"
import { floatingPanelContext } from "./context"
import type { FloatingPanelButtonProps } from "./types"

/** Drag to move; arrows move, Alt+arrows resize, Enter maximises. */
const { child, children, ...rest }: FloatingPanelButtonProps = $props()
const ctx = floatingPanelContext.get()
const env = useEnvironment()
// Tracks the modality from mount, so the first keyboard focus is already visible.
$effect(() => env.modality.subscribe(() => {}))
let focused = $state(false)
const modality = useModality(env.modality, () => focused)
const el = elementRef("button")
$effect(() => {
  const node = el.current
  ctx.dragTrigger.current = node instanceof HTMLElement ? node : null
})
const merged = $derived(
  stripMarker(
    mergeProps(
      {
        ...joinHandlers(
          normalizeProps(
            ctx.api().dragTrigger({ tag: el.tag, focused, modality: modality.current }),
          ),
          {
            onpointerdown: (e: PointerEvent) => ctx.startDrag(e),
            onkeydown: (e: KeyboardEvent) => {
              const s = ctx.state()
              const event = floatingPanelKeyEvent(describeKey(e, env), {
                dir: ctx.dir(),
                dragging: s.dragging || s.resizing,
              })
              if (!event) return
              e.preventDefault()
              // Escape ends the drag only: the panel stays open.
              if (event.type === "DRAG.CANCEL") {
                e.stopPropagation()
                if (!ctx.cancelDrag()) ctx.send(event)
                return
              }
              ctx.send(event)
            },
            onfocus: () => (focused = true),
            onblur: () => (focused = false),
          },
        ),
        ...el.props,
      },
      rest,
    ),
  ),
)
const hint = $derived(normalizeProps(ctx.api().dragHint()))
</script>

{#if child}
  {@render child({ props: merged, state: ctx.state() })}
{:else}
  <button {...merged as HTMLButtonAttributes}>{@render children?.(ctx.state())}<span {...attrs(hint)}>{ctx.api().hintText}</span></button>
{/if}
