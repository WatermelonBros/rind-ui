<script lang="ts">
import { stripMarker } from "@rind-ui/core/internal"
import { joinHandlers, mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { floatingPanelContext } from "./context"
import type { FloatingPanelResizeTriggerProps } from "./types"

/** A pointer handle on an edge or corner (`axis`); hidden from assistive technology. */
const { axis, child, children, ...rest }: FloatingPanelResizeTriggerProps = $props()
const ctx = floatingPanelContext.get()
const merged = $derived(
  stripMarker(
    mergeProps(
      joinHandlers(normalizeProps(ctx.api().resizeTrigger(axis)), {
        onpointerdown: (e: PointerEvent) => ctx.startDrag(e, axis),
      }),
      rest,
    ),
  ),
)
</script>

{#if child}
  {@render child({ props: merged, state: ctx.state() })}
{:else}
  <div {...attrs(merged)}>{@render children?.(ctx.state())}</div>
{/if}
