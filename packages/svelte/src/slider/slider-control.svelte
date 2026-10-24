<script lang="ts">
import { stripMarker } from "@rind-ui/core/internal"
import { joinHandlers, mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { useEnvironment } from "../provider"
import { sliderContext } from "./context"
import type { SliderPartProps } from "./types"

/** The pointer surface: a press moves the nearest thumb there and starts a drag. */
const { child, children, ...rest }: SliderPartProps = $props()
const ctx = sliderContext.get()
const env = useEnvironment()
// The modality tracker must see the pointerdown that comes before the thumb's focus.
$effect(() => env.modality.subscribe(() => {}))
const capture = (node: Element) => {
  ctx.control.current = node
  return () => {
    if (ctx.control.current === node) ctx.control.current = null
  }
}
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
  <div {...attrs(merged)} {@attach capture}>{@render children?.(ctx.state())}</div>
{/if}
