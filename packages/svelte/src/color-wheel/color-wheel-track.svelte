<script lang="ts">
import { stripMarker } from "@rind-ui/core/internal"
import { joinHandlers, mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { colorWheelContext } from "./context"
import type { ColorWheelPartProps } from "./types"

/** The hue ring: a press on the ring sets the hue and drags. */
const { child, children, ...rest }: ColorWheelPartProps = $props()
const ctx = colorWheelContext.get()
const merged = $derived(
  stripMarker(
    mergeProps(joinHandlers(normalizeProps(ctx.api().track()), { onpointerdown: ctx.press }), rest),
  ),
)
</script>

{#if child}
  {@render child({ props: merged, state: ctx.state() })}
{:else}
  <div {...attrs(merged)}>{@render children?.(ctx.state())}</div>
{/if}
