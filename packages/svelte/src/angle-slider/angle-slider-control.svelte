<script lang="ts">
import { stripMarker } from "@rind-ui/core/internal"
import { joinHandlers, mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { angleSliderContext } from "./context"
import type { AngleSliderPartProps } from "./types"

/** The round surface: a press sets the angle around its centre and drags. */
const { child, children, ...rest }: AngleSliderPartProps = $props()
const ctx = angleSliderContext.get()
const merged = $derived(
  stripMarker(
    mergeProps(
      joinHandlers(normalizeProps(ctx.api().control()), { onpointerdown: ctx.press }),
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
